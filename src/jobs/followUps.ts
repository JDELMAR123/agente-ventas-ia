import cron from "node-cron";
import { prisma } from "../db/prisma.js";
import { getAdapter } from "../channels/registry.js";
import { getSettings } from "../settings/index.js";
import { notifySlack } from "../lib/slack.js";
import { notifyEmail } from "../lib/email.js";

const VENTANA_24H_MS = 24 * 60 * 60 * 1000;

/**
 * Cada hora revisa los seguimientos pendientes cuya fecha ya llegó, y les
 * manda un mensaje por el canal correspondiente — el lead no se pierde solo
 * porque nadie se acordó de escribirle de nuevo.
 *
 * WhatsApp solo permite texto libre dentro de las 24h desde el último
 * mensaje DEL CLIENTE (Conversation.lastMessageAt — ver core.ts, se
 * actualiza únicamente con mensajes entrantes, nunca con las respuestas del
 * agente). Fuera de esa ventana, Meta rechaza el texto libre: hay que usar
 * una plantilla pre-aprobada. Si el negocio no configuró una en /admin, NO
 * se manda nada — se avisa por Slack en vez de fallar en silencio.
 */
export async function runFollowUps(): Promise<void> {
  const settings = await getSettings();
  const due = await prisma.followUp.findMany({
    where: { status: "PENDIENTE", scheduledFor: { lte: new Date() } },
    include: { conversation: { include: { contact: true } } },
  });

  for (const followUp of due) {
    const { conversation } = followUp;
    if (conversation.status !== "ACTIVA") {
      // Pausada o cerrada: no le insistas al cliente, cancela el seguimiento.
      await prisma.followUp.update({ where: { id: followUp.id }, data: { status: "CANCELADO" } });
      continue;
    }

    const nombre = conversation.contact.name ?? conversation.contact.phone ?? conversation.id;
    const dentroDeVentana = Date.now() - conversation.lastMessageAt.getTime() < VENTANA_24H_MS;

    try {
      const adapter = getAdapter(conversation.channel);

      if (dentroDeVentana) {
        const texto = "¡Hola de nuevo! Solo quería darte seguimiento — ¿sigues interesado? Cualquier cosa me dices 😊";
        await adapter.enviarMensaje(conversation.externalId, texto);
        await prisma.message.create({
          data: { conversationId: conversation.id, direction: "SALIENTE", sender: "AGENTE", body: texto },
        });
      } else {
        if (!settings.followUpTemplate || !adapter.enviarPlantilla) {
          throw new Error(
            "Ya pasaron más de 24h desde el último mensaje del cliente y no hay una " +
              "plantilla de WhatsApp aprobada configurada en /admin — fuera de esa " +
              "ventana, Meta no permite texto libre (hay que registrar y esperar la " +
              "aprobación de una plantilla en Meta Business Manager, ver docs/META_SETUP.md)."
          );
        }
        await adapter.enviarPlantilla(
          conversation.externalId,
          settings.followUpTemplate.name,
          settings.followUpTemplate.lang
        );
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            direction: "SALIENTE",
            sender: "AGENTE",
            body: `[plantilla "${settings.followUpTemplate.name}"] seguimiento automático`,
          },
        });
      }

      await prisma.followUp.update({
        where: { id: followUp.id },
        data: { status: "ENVIADO", sentAt: new Date() },
      });
      console.log(`[follow-up] enviado a conversación ${conversation.id} (motivo: ${followUp.reason})`);
    } catch (err) {
      await prisma.followUp.update({ where: { id: followUp.id }, data: { status: "FALLIDO" } });
      console.error(`[follow-up] no se pudo enviar para conversación ${conversation.id}:`, err);
      // Aviso real, no solo un log: el dueño del negocio se entera aunque no
      // esté revisando la consola del servidor. Distinto del aviso de
      // escalar_a_humano — esto es un fallo del sistema, no un cliente que
      // necesita atención.
      const mensaje =
        `⚠️ ${settings.businessName} — fallo de sistema (seguimiento automático)\n` +
        `Cliente: ${nombre}\n` +
        `Conversación: ${conversation.id}\n` +
        `Motivo del seguimiento: ${followUp.reason}\n` +
        `Error: ${err instanceof Error ? err.message : String(err)}`;
      await Promise.allSettled([
        notifySlack(settings.escalation.slackWebhookUrl, mensaje),
        notifyEmail(settings, `${settings.businessName}: fallo de sistema`, mensaje),
      ]);
    }
  }
}

/** Arranca el job programado. Se llama una vez al iniciar el servidor. */
export function scheduleFollowUpJob(): void {
  // Cada hora en punto. Ajusta el cron si quieres otra frecuencia.
  cron.schedule("0 * * * *", () => {
    runFollowUps().catch((err) => console.error("[follow-up] error en el job:", err));
  });
  console.log("[follow-up] job programado: revisa seguimientos pendientes cada hora");
}
