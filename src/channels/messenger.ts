import type { ChannelAdapter, InboundMessage } from "./types.js";

/**
 * Stub: misma interfaz que WhatsAppAdapter, listo para implementarse cuando
 * haga falta (Messenger Platform, página de Facebook) sin tocar el core del
 * agente ni ningún otro canal.
 */
export class MessengerAdapter implements ChannelAdapter {
  readonly channel = "MESSENGER" as const;

  async isConfigured(): Promise<boolean> {
    return false;
  }

  recibirMensaje(_payload: unknown): InboundMessage[] {
    console.warn("[messenger] adaptador aún no implementado");
    return [];
  }

  async enviarMensaje(_externalConversationId: string, _body: string): Promise<void> {
    throw new Error("El canal de Messenger todavía no está implementado.");
  }
}
