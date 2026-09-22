import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import type { ToolDefinition } from "./types.js";

const schema = z.object({
  telefono: z.string().describe("Teléfono o id del contacto en el canal (WhatsApp, etc.)"),
});

export const buscarCliente: ToolDefinition<typeof schema> = {
  name: "buscar_cliente",
  description:
    "Busca si el contacto ya existe en el CRM y trae su historial: etapa del lead, " +
    "resumen de interés y últimas conversaciones. Úsala SIEMPRE al empezar una " +
    "conversación nueva, antes de responder nada, para tener contexto real del cliente.",
  schema,
  inputSchema: {
    type: "object",
    properties: {
      telefono: { type: "string", description: "Teléfono o id del contacto en el canal" },
    },
    required: ["telefono"],
  },
  async execute({ telefono }) {
    const contact = await prisma.contact.findFirst({
      where: {
        OR: [{ phone: telefono }, { whatsappId: telefono }, { instagramId: telefono }, { messengerId: telefono }],
      },
      include: {
        leads: true,
        conversations: {
          orderBy: { lastMessageAt: "desc" },
          take: 1,
          include: { messages: { orderBy: { createdAt: "desc" }, take: 5 } },
        },
      },
    });

    if (!contact) {
      return { existe: false };
    }

    const lead = contact.leads[0] ?? null;
    const ultimaConversacion = contact.conversations[0] ?? null;

    return {
      existe: true,
      contactId: contact.id,
      nombre: contact.name,
      etapa: lead?.stage ?? "NUEVO",
      interes: lead?.interes ?? null,
      ultimosMensajes:
        ultimaConversacion?.messages
          .slice()
          .reverse()
          .map((m) => `${m.direction === "ENTRANTE" ? "Cliente" : "Nosotros"}: ${m.body}`) ?? [],
    };
  },
};
