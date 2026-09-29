import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getSettings } from "../settings/index.js";
import { getAdapter } from "../channels/registry.js";
import { processInboundMessage } from "../agent/core.js";

/** Meta manda la verificación del webhook como querystring. */
type VerifyQuery = {
  "hub.mode"?: string;
  "hub.verify_token"?: string;
  "hub.challenge"?: string;
};

/**
 * Valida que el POST venga de verdad de Meta, comparando la firma
 * X-Hub-Signature-256 (HMAC-SHA256 del cuerpo crudo con el App Secret)
 * contra la que calculamos nosotros. Sin esto, cualquiera que conozca la
 * URL del webhook puede mandar mensajes falsos que el agente procesaría
 * como si fueran de un cliente real.
 */
function firmaMetaValida(appSecret: string, rawBody: Buffer, header: string | string[] | undefined): boolean {
  const valor = Array.isArray(header) ? header[0] : header;
  if (!valor?.startsWith("sha256=")) return false;

  const esperada = crypto.createHmac("sha256", appSecret).update(rawBody).digest();
  let recibida: Buffer;
  try {
    recibida = Buffer.from(valor.slice("sha256=".length), "hex");
  } catch {
    return false;
  }
  if (esperada.length !== recibida.length) return false;
  return crypto.timingSafeEqual(esperada, recibida);
}

export async function registerWebhookRoutes(app: FastifyInstance) {
  for (const [path, channel] of [
    ["/webhooks/whatsapp", "WHATSAPP"],
    ["/webhooks/instagram", "INSTAGRAM"],
    ["/webhooks/messenger", "MESSENGER"],
  ] as const) {
    app.get(path, async (req: FastifyRequest<{ Querystring: VerifyQuery }>, reply: FastifyReply) => {
      const settings = await getSettings();
      const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;
      if (mode === "subscribe" && token && settings.channels.verifyToken && token === settings.channels.verifyToken) {
        return reply.send(challenge);
      }
      return reply.code(403).send("Token de verificación inválido");
    });

    app.post(path, async (req: FastifyRequest, reply: FastifyReply) => {
      const settings = await getSettings();

      // Fail-closed a propósito: sin App Secret configurado no hay forma de
      // distinguir un mensaje real de uno falso, así que no se procesa nada.
      if (!settings.channels.appSecret) {
        req.log.error(`[webhooks:${channel}] falta configurar el App Secret de Meta en /admin`);
        return reply.code(500).send("Falta configurar el App Secret de Meta en /admin");
      }
      if (!req.rawBody || !firmaMetaValida(settings.channels.appSecret, req.rawBody, req.headers["x-hub-signature-256"])) {
        req.log.warn(`[webhooks:${channel}] firma de Meta inválida, se rechaza el request`);
        return reply.code(401).send("Firma inválida");
      }

      // Responder rápido: Meta desactiva webhooks que tardan o fallan.
      reply.code(200).send("ok");

      try {
        const adapter = getAdapter(channel);
        const inbound = adapter.recibirMensaje(req.body);
        for (const msg of inbound) {
          await processInboundMessage(msg).catch((err) =>
            req.log.error({ err }, `error procesando mensaje de ${channel}`)
          );
        }
      } catch (err) {
        req.log.error({ err }, `error parseando webhook de ${channel}`);
      }
    });
  }
}
