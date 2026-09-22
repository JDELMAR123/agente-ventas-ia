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

export async function registerWebhookRoutes(app: FastifyInstance) {
  // --- WhatsApp ---
  app.get("/webhooks/whatsapp", async (req: FastifyRequest<{ Querystring: VerifyQuery }>, reply: FastifyReply) => {
    const settings = await getSettings();
    const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;
    if (mode === "subscribe" && token && settings.channels.verifyToken && token === settings.channels.verifyToken) {
      return reply.send(challenge);
    }
    return reply.code(403).send("Token de verificación inválido");
  });

  app.post("/webhooks/whatsapp", async (req: FastifyRequest, reply: FastifyReply) => {
    // Responder rápido: Meta desactiva webhooks que tardan o fallan.
    reply.code(200).send("ok");

    try {
      const adapter = getAdapter("WHATSAPP");
      const inbound = adapter.recibirMensaje(req.body);
      for (const msg of inbound) {
        await processInboundMessage(msg).catch((err) =>
          req.log.error({ err }, "error procesando mensaje de WhatsApp")
        );
      }
    } catch (err) {
      req.log.error({ err }, "error parseando webhook de WhatsApp");
    }
  });

  // --- Instagram / Messenger: mismas rutas, adaptadores stub por ahora ---
  for (const [path, channel] of [
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
      reply.code(200).send("ok");
      const adapter = getAdapter(channel);
      const inbound = adapter.recibirMensaje(req.body);
      for (const msg of inbound) {
        await processInboundMessage(msg).catch((err) =>
          req.log.error({ err }, `error procesando mensaje de ${channel}`)
        );
      }
    });
  }
}
