import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import type { ToolDefinition } from "./types.js";

const schema = z.object({
  fecha: z.string().describe("Fecha y hora del seguimiento, en formato ISO 8601"),
  motivo: z.string().describe("Por qué se hace este seguimiento"),
});

export const programarSeguimiento: ToolDefinition<typeof schema> = {
  name: "programar_seguimiento",
  description:
    "Crea un recordatorio para volver a escribirle al cliente en una fecha futura si " +
    "no responde o quedó pendiente algo. El job automático lo dispara solo.",
  schema,
  inputSchema: {
    type: "object",
    properties: {
      fecha: { type: "string", description: "ISO 8601, p. ej. 2026-09-25T15:00:00.000Z" },
      motivo: { type: "string" },
    },
    required: ["fecha", "motivo"],
  },
  async execute({ fecha, motivo }, ctx) {
    const scheduledFor = new Date(fecha);
    if (Number.isNaN(scheduledFor.getTime())) {
      return { ok: false, error: "Fecha inválida" };
    }
    const followUp = await prisma.followUp.create({
      data: { conversationId: ctx.conversationId, scheduledFor, reason: motivo },
    });
    return { ok: true, followUpId: followUp.id, scheduledFor: scheduledFor.toISOString() };
  },
};
