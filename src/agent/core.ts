import { prisma } from "../db/prisma.js";
import { getSettings } from "../settings/index.js";
import { getAdapter } from "../channels/registry.js";
import { ruleEngine } from "./engines/ruleEngine.js";
import { claudeEngine } from "./engines/claudeEngine.js";
import type { InboundMessage } from "../channels/types.js";
import type { Engine } from "./engines/types.js";
import type { Prisma } from "../generated/prisma/client.js";

async function findOrCreateContact(msg: InboundMessage) {
  const where: Prisma.ContactWhereInput =
    msg.channel === "WHATSAPP"
      ? { whatsappId: msg.externalContactId }
      : msg.channel === "INSTAGRAM"
        ? { instagramId: msg.externalContactId }
        : { messengerId: msg.externalContactId };

  const existing = await prisma.contact.findFirst({ where });
  if (existing) {
    if (msg.contactName && !existing.name) {
      return prisma.contact.update({ where: { id: existing.id }, data: { name: msg.contactName } });
    }
    return existing;
  }

  const createData: Prisma.ContactCreateInput = {
    name: msg.contactName,
    ...(msg.channel === "WHATSAPP" ? { whatsappId: msg.externalContactId, phone: msg.externalContactId } : {}),
    ...(msg.channel === "INSTAGRAM" ? { instagramId: msg.externalContactId } : {}),
    ...(msg.channel === "MESSENGER" ? { messengerId: msg.externalContactId } : {}),
  };
  return prisma.contact.create({ data: createData });
}

async function findOrCreateConversation(contactId: string, msg: InboundMessage) {
  const existing = await prisma.conversation.findUnique({
    where: { channel_externalId: { channel: msg.channel, externalId: msg.externalConversationId } },
  });
  if (existing) return existing;
  return prisma.conversation.create({
    data: { channel: msg.channel, externalId: msg.externalConversationId, contactId },
  });
}

function pickEngine(provider: "rules" | "anthropic"): Engine {
  return provider === "anthropic" ? claudeEngine : ruleEngine;
}

/**
 * Punto de entrada único del agente, agnóstico de canal: cualquier
 * adaptador (WhatsApp, Instagram, Messenger...) llama aquí con un
 * InboundMessage ya normalizado. El agente no sabe ni le importa por qué
 * canal llegó.
 */
export async function processInboundMessage(msg: InboundMessage): Promise<void> {
  if (!msg.body.trim()) return;

  const settings = await getSettings();
  const contact = await findOrCreateContact(msg);
  const conversation = await findOrCreateConversation(contact.id, msg);

  // El mensaje entrante se guarda SIEMPRE, incluso si la conversación está
  // pausada — así el humano ve el hilo completo cuando entre.
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "ENTRANTE",
      sender: "CLIENTE",
      body: msg.body,
      externalId: msg.externalMessageId,
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), lastMessagePreview: msg.body.slice(0, 140) },
  });

  // Si ya se escaló a un humano, el agente deja de responder en esta conversación.
  if (conversation.status === "PAUSADA") return;

  const previousMessages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 31, // 30 de historial + el que acabamos de guardar
  });
  const history = previousMessages
    .slice(0, -1)
    .map((m) => ({ direction: m.direction, body: m.body }));

  const engine = pickEngine(settings.ai.provider);
  let output: { reply: string | null; escalated: boolean };
  try {
    output = await engine.handle({
      settings,
      contactId: contact.id,
      conversationId: conversation.id,
      channel: msg.channel,
      history,
      incomingText: msg.body,
    });
  } catch (err) {
    console.error(`[agent:${engine.name}] error procesando el mensaje:`, err);
    output = {
      reply: "Perdona, tuve un problema procesando tu mensaje. Ya le aviso a alguien de nuestro equipo.",
      escalated: true,
    };
    await prisma.conversation.update({ where: { id: conversation.id }, data: { status: "PAUSADA" } });
  }

  if (output.reply) {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "SALIENTE",
        sender: "AGENTE",
        body: output.reply,
      },
    });
    try {
      await getAdapter(msg.channel).enviarMensaje(msg.externalConversationId, output.reply);
    } catch (err) {
      console.error(`[channel:${msg.channel}] no se pudo enviar el mensaje:`, err);
    }
  }
}
