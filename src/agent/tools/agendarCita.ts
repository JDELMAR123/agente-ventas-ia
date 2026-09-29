import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import type { ToolDefinition } from "./types.js";

const schema = z.object({
  fecha: z.string().describe("Fecha y hora de la cita, en formato ISO 8601"),
  servicio: z.string().optional().describe("Qué servicio o motivo es la cita"),
  duracionMin: z.number().positive().optional().describe("Duración estimada en minutos (por defecto 60)"),
});

export const agendarCita: ToolDefinition<typeof schema> = {
  name: "agendar_cita",
  description:
    "Reserva una cita/turno real con el cliente (mesa, servicio, etc.) a una fecha y hora " +
    "concretas — distinto de programar_seguimiento, que es solo un recordatorio interno. " +
    "Si el horario ya está tomado, devuelve un error: ofrécele otro horario al cliente, no " +
    "insistas con el mismo.",
  schema,
  inputSchema: {
    type: "object",
    properties: {
      fecha: { type: "string", description: "ISO 8601, p. ej. 2026-09-25T15:00:00.000Z" },
      servicio: { type: "string" },
      duracionMin: { type: "number" },
    },
    required: ["fecha"],
  },
  async execute({ fecha, servicio, duracionMin }, ctx) {
    const scheduledFor = new Date(fecha);
    if (Number.isNaN(scheduledFor.getTime())) {
      return { ok: false, error: "Fecha inválida" };
    }
    const duracion = duracionMin ?? 60;
    const inicioNueva = scheduledFor.getTime();
    const finNueva = inicioNueva + duracion * 60_000;

    // Protección básica contra doble reserva: solo se comparan citas del
    // mismo día (volumen bajo para un negocio chico, no hace falta más).
    const inicioDia = new Date(scheduledFor);
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date(scheduledFor);
    finDia.setHours(23, 59, 59, 999);

    const delDia = await prisma.appointment.findMany({
      where: { status: "CONFIRMADA", scheduledFor: { gte: inicioDia, lte: finDia } },
    });
    const solapa = delDia.some((a) => {
      const aInicio = a.scheduledFor.getTime();
      const aFin = aInicio + a.durationMin * 60_000;
      return inicioNueva < aFin && aInicio < finNueva;
    });
    if (solapa) {
      return {
        ok: false,
        error: "Ya hay una cita confirmada que se cruza con ese horario. Ofrece otro horario.",
      };
    }

    const appointment = await prisma.appointment.create({
      data: {
        contactId: ctx.contactId,
        conversationId: ctx.conversationId,
        scheduledFor,
        durationMin: duracion,
        servicio: servicio ?? null,
      },
    });
    return { ok: true, appointmentId: appointment.id, scheduledFor: scheduledFor.toISOString() };
  },
};
