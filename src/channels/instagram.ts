import type { ChannelAdapter, InboundMessage } from "./types.js";

/**
 * Stub: misma interfaz que WhatsAppAdapter, listo para implementarse cuando
 * haga falta (Instagram Messaging vía la página de Facebook vinculada) sin
 * tocar el core del agente ni ningún otro canal.
 */
export class InstagramAdapter implements ChannelAdapter {
  readonly channel = "INSTAGRAM" as const;

  async isConfigured(): Promise<boolean> {
    return false;
  }

  recibirMensaje(_payload: unknown): InboundMessage[] {
    console.warn("[instagram] adaptador aún no implementado");
    return [];
  }

  async enviarMensaje(_externalConversationId: string, _body: string): Promise<void> {
    throw new Error("El canal de Instagram todavía no está implementado.");
  }
}
