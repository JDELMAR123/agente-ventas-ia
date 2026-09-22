import cron from "node-cron";
import { prisma } from "../db/prisma.js";
import { getAdapter } from "../channels/registry.js";

/**
 * Cada hora revisa los seguimientos pendientes cuya fecha ya llegó, y les
 * manda un mensaje de seguimiento por el canal correspondiente — el lead no
 * se pierde solo porque nadie se acordó de escribirle de nuevo.
 */
export async function runFollowUps(): Promise<void> {
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

    const texto = `¡Hola de nuevo! Solo quería darte seguimiento — ¿sigues interesado? Cualquier cosa me dices 😊`;
    try {
      await getAdapter(conversation.channel).enviarMensaje(conversation.externalId, texto);
      await prisma.message.create({
        data: { conversationId: conversation.id, direction: "SALIENTE", sender: "AGENTE", body: texto },
      });
      await prisma.followUp.update({
        where: { id: followUp.id },
        data: { status: "ENVIADO", sentAt: new Date() },
      });
      console.log(`[follow-up] enviado a conversación ${conversation.id} (motivo: ${followUp.reason})`);
    } catch (err) {
      console.error(`[follow-up] no se pudo enviar para conversación ${conversation.id}:`, err);
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
