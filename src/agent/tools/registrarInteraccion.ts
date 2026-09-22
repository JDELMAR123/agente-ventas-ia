import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import type { ToolDefinition } from "./types.js";

const schema = z.object({
  resumen: z.string().describe("Resumen de la conversación en 1-2 frases"),
});

export const registrarInteraccion: ToolDefinition<typeof schema> = {
  name: "registrar_interaccion",
  description:
    "Guarda un resumen de esta conversación en el historial del lead. Úsala al final " +
    "de un intercambio significativo, para que quede registrado sin tener que releer " +
    "todos los mensajes la próxima vez.",
  schema,
  inputSchema: {
    type: "object",
    properties: { resumen: { type: "string" } },
    required: ["resumen"],
  },
  async execute({ resumen }, ctx) {
    await prisma.lead.upsert({
      where: { contactId: ctx.contactId },
      update: { interes: resumen },
      create: { contactId: ctx.contactId, interes: resumen },
    });
    await prisma.conversation.update({
      where: { id: ctx.conversationId },
      data: { lastMessagePreview: resumen.slice(0, 140) },
    });
    return { ok: true };
  },
};
