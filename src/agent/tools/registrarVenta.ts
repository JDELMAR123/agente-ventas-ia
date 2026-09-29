import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { getSettings } from "../../settings/index.js";
import { notifySlack } from "../../lib/slack.js";
import { crearOActualizarLead } from "./crearOActualizarLead.js";
import type { ToolDefinition } from "./types.js";

const itemSchema = z.object({
  nombre: z.string().describe("Nombre del producto/servicio vendido, tal como está en el catálogo"),
  cantidad: z.number().positive(),
  precioUnitario: z.number().nonnegative(),
});

const schema = z.object({
  items: z.array(itemSchema).min(1).describe("Productos/servicios que compró el cliente"),
  metodoPago: z.string().optional().describe("Cómo pagó el cliente, si se sabe (efectivo, transferencia, etc.)"),
});

export const registrarVenta: ToolDefinition<typeof schema> = {
  name: "registrar_venta",
  description:
    "Registra una venta CERRADA de verdad (no una intención): qué compró el cliente, " +
    "cuánto y cómo pagó. Úsala cuando el cliente confirme la compra en firme — no antes. " +
    "Marca el lead como GANADO automáticamente y cierra la conversación (el seguimiento " +
    "automático deja de insistirle a alguien que ya compró).",
  schema,
  inputSchema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            nombre: { type: "string" },
            cantidad: { type: "number" },
            precioUnitario: { type: "number" },
          },
          required: ["nombre", "cantidad", "precioUnitario"],
        },
      },
      metodoPago: { type: "string" },
    },
    required: ["items"],
  },
  async execute({ items, metodoPago }, ctx) {
    const total = items.reduce((sum, it) => sum + it.cantidad * it.precioUnitario, 0);

    const [settings, sale] = await Promise.all([
      getSettings(),
      prisma.sale.create({
        data: {
          contactId: ctx.contactId,
          conversationId: ctx.conversationId,
          items: JSON.stringify(items),
          total,
          metodoPago: metodoPago ?? null,
        },
      }),
    ]);

    // Reusa la lógica de "GANADO cierra la conversación" que ya vive en
    // crear_o_actualizar_lead, en vez de duplicarla aquí.
    await crearOActualizarLead.execute({ etapa: "GANADO", valorEstimado: total }, ctx);

    const detalle = items
      .map((it) => `• ${it.cantidad}x ${it.nombre} — $${(it.cantidad * it.precioUnitario).toFixed(2)}`)
      .join("\n");
    await notifySlack(
      settings.escalation.slackWebhookUrl,
      `🎉 ${settings.businessName} — nueva venta: $${total.toFixed(2)}` +
        `${metodoPago ? ` (${metodoPago})` : ""}\n${detalle}`
    );

    return { ok: true, saleId: sale.id, total };
  },
};
