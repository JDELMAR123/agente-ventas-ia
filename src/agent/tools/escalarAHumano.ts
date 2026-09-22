import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { getSettings } from "../../settings/index.js";
import { notifySlack } from "../../lib/slack.js";
import type { ToolDefinition } from "./types.js";

const schema = z.object({
  motivo: z
    .string()
    .describe(
      "Por qué se escala: queja/reclamo, negociación de precio fuera de rango, o baja " +
        "confianza en la respuesta"
    ),
});

export const escalarAHumano: ToolDefinition<typeof schema> = {
  name: "escalar_a_humano",
  description:
    "Pausa el agente en esta conversación y avisa a un vendedor humano. Úsala SIEMPRE " +
    "ante una queja o reclamo, una negociación de precio fuera de lo autorizado, o " +
    "cuando no tengas confianza real en tu propia respuesta. No sigas respondiendo tú " +
    "después de llamar a esta tool.",
  schema,
  inputSchema: {
    type: "object",
    properties: { motivo: { type: "string" } },
    required: ["motivo"],
  },
  async execute({ motivo }, ctx) {
    const [settings, conversation] = await Promise.all([
      getSettings(),
      prisma.conversation.update({
        where: { id: ctx.conversationId },
        data: { status: "PAUSADA" },
        include: { contact: true },
      }),
    ]);

    const nombre = conversation.contact.name ?? conversation.contact.phone ?? "cliente";
    await notifySlack(
      settings.escalation.slackWebhookUrl,
      `🚨 *${settings.businessName}* — conversación escalada a un humano\n` +
        `Cliente: ${nombre} (${ctx.channel})\n` +
        `Motivo: ${motivo}\n` +
        `Conversación: ${ctx.conversationId}`
    );

    return { ok: true, pausado: true };
  },
};
