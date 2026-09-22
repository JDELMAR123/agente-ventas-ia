import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import type { ToolDefinition } from "./types.js";

const schema = z.object({
  etapa: z
    .enum(["NUEVO", "CONTACTADO", "NEGOCIANDO", "GANADO", "PERDIDO"])
    .describe("Etapa del lead en el embudo de ventas"),
  interes: z.string().optional().describe("Qué quiere el cliente, resumen corto"),
  valorEstimado: z.number().optional().describe("Valor estimado de la venta, si se conoce"),
});

export const crearOActualizarLead: ToolDefinition<typeof schema> = {
  name: "crear_o_actualizar_lead",
  description:
    "Crea el lead de este contacto si no existe, o actualiza su etapa/interés si ya " +
    "existe. Úsala cada vez que el cliente avance (o retroceda) en el proceso de compra.",
  schema,
  inputSchema: {
    type: "object",
    properties: {
      etapa: {
        type: "string",
        enum: ["NUEVO", "CONTACTADO", "NEGOCIANDO", "GANADO", "PERDIDO"],
      },
      interes: { type: "string" },
      valorEstimado: { type: "number" },
    },
    required: ["etapa"],
  },
  async execute({ etapa, interes, valorEstimado }, ctx) {
    const lead = await prisma.lead.upsert({
      where: { contactId: ctx.contactId },
      update: {
        stage: etapa,
        ...(interes !== undefined ? { interes } : {}),
        ...(valorEstimado !== undefined ? { valorEst: valorEstimado } : {}),
      },
      create: {
        contactId: ctx.contactId,
        stage: etapa,
        interes: interes ?? null,
        valorEst: valorEstimado ?? null,
      },
    });
    return { ok: true, leadId: lead.id, etapa: lead.stage };
  },
};
