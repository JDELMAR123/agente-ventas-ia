import {
  buscarCliente,
  consultarCatalogo,
  crearOActualizarLead,
  escalarAHumano,
  programarSeguimiento,
} from "../tools/index.js";
import { logToolCall } from "../../lib/logger.js";
import type { Engine, EngineInput } from "./types.js";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const has = (text: string, words: string[]) => words.some((w) => text.includes(norm(w)));

type CatalogoResult = { encontrados: number; productos: { nombre: string; precio: number | null }[] };

/**
 * Motor gratuito: heurística local en español, sin llamadas a ningún
 * modelo de lenguaje ni coste. Dispara las mismas tools que el motor de
 * Claude, solo que decide cuál llamar con reglas en vez de razonamiento.
 * Cuando el comprador active Claude con su propia clave, este motor deja
 * de usarse.
 */
export const ruleEngine: Engine = {
  name: "rules",

  async handle({ contactId, conversationId, channel, history, incomingText }: EngineInput) {
    const ctx = { contactId, conversationId, channel };
    const text = norm(incomingText);
    const isFirstTurn = history.length === 0;

    if (isFirstTurn) {
      const result = await buscarCliente
        .execute({ telefono: contactId }, ctx)
        .catch((err: unknown) => ({ error: String(err) }));
      await logToolCall({
        conversationId,
        engine: "rules",
        toolName: buscarCliente.name,
        args: { telefono: contactId },
        result,
        ok: true,
      });
    }

    // --- Queja/reclamo o negociación fuera de rango → escalar de inmediato ---
    const quejaWords = ["queja", "reclamo", "estafa", "terrible", "pesimo", "no funciona", "mal servicio", "devuelvan mi dinero"];
    const negociacionWords = ["descuento", "rebaja", "mas barato", "bajame el precio", "negociar el precio"];
    if (has(text, quejaWords) || has(text, negociacionWords)) {
      const motivo = has(text, quejaWords) ? "Queja o reclamo del cliente" : "Cliente pide negociar el precio";
      const result = await escalarAHumano.execute({ motivo }, ctx);
      await logToolCall({ conversationId, engine: "rules", toolName: escalarAHumano.name, args: { motivo }, result, ok: true });
      return {
        reply: "Entiendo — te voy a poner en contacto con alguien de nuestro equipo para que te ayude mejor con esto. Un momento, por favor 🙏",
        escalated: true,
      };
    }

    // --- Consulta de catálogo o precio ---
    const priceWords = ["precio", "cuanto cuesta", "vale", "cuanto vale", "menu", "catalogo", "tienen"];
    if (has(text, priceWords)) {
      const result = (await consultarCatalogo.execute({ query: incomingText }, ctx)) as CatalogoResult;
      await logToolCall({ conversationId, engine: "rules", toolName: consultarCatalogo.name, args: { query: incomingText }, result, ok: true });

      if (result.productos.length > 0) {
        const lista = result.productos
          .slice(0, 5)
          .map((p) => `• ${p.nombre}${p.precio != null ? ` — $${p.precio}` : ""}`)
          .join("\n");
        await crearOActualizarLead.execute({ etapa: "CONTACTADO", interes: incomingText }, ctx);
        return { reply: `Claro, esto es lo que tenemos:\n${lista}\n\n¿Te gustaría alguno?`, escalated: false };
      }
      return {
        reply: "Por ahora no encuentro eso exacto en el catálogo — ¿me puedes decir un poco más qué buscas?",
        escalated: false,
      };
    }

    // --- Intención de compra ---
    const buyWords = ["quiero", "lo compro", "me lo llevo", "como pago", "confirmo"];
    if (has(text, buyWords)) {
      const result = await crearOActualizarLead.execute({ etapa: "NEGOCIANDO", interes: incomingText }, ctx);
      await logToolCall({ conversationId, engine: "rules", toolName: crearOActualizarLead.name, args: { etapa: "NEGOCIANDO" }, result, ok: true });
      return { reply: "¡Genial! Dame un momento para confirmarte los detalles y cómo seguimos con el pago.", escalated: false };
    }

    // --- Duda / lo va a pensar → programar seguimiento ---
    const hesitationWords = ["lo pienso", "despues te digo", "mañana te digo", "lo consulto"];
    if (has(text, hesitationWords)) {
      const fecha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const result = await programarSeguimiento.execute(
        { fecha, motivo: "El cliente dijo que lo iba a pensar" },
        ctx
      );
      await logToolCall({ conversationId, engine: "rules", toolName: programarSeguimiento.name, args: { fecha }, result, ok: true });
      return { reply: "Perfecto, sin problema. Cualquier duda me escribes 🙌", escalated: false };
    }

    // --- Genérico ---
    return {
      reply:
        "¡Hola! Gracias por escribirnos 😊 ¿En qué te puedo ayudar? Puedo contarte de nuestros productos, precios o ayudarte a hacer tu pedido.",
      escalated: false,
    };
  },
};
