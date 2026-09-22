import type { $Enums } from "../generated/prisma/client.js";

export type ChannelType = $Enums.ChannelType;

/** Un mensaje entrante, ya normalizado — el agente no sabe de qué canal vino. */
export type InboundMessage = {
  channel: ChannelType;
  /** id externo de la conversación/hilo en el canal (p. ej. el número de WhatsApp) */
  externalConversationId: string;
  /** id externo del contacto en el canal */
  externalContactId: string;
  contactName: string | null;
  body: string;
  externalMessageId: string | null;
};

/**
 * Todo canal (WhatsApp, Instagram, Messenger...) implementa esta misma
 * interfaz. El core del agente (AgentCore) solo habla con esto — nunca sabe
 * ni le importa de qué canal concreto vino un mensaje.
 */
export interface ChannelAdapter {
  readonly channel: ChannelType;
  /** ¿Están puestas las credenciales de este canal? */
  isConfigured(): Promise<boolean>;
  /**
   * Convierte el payload crudo del webhook de este canal (formato propio de
   * cada proveedor) en uno o varios InboundMessage normalizados. El core del
   * agente nunca ve el formato original — cada adaptador es el único que lo
   * conoce.
   */
  recibirMensaje(payload: unknown): InboundMessage[];
  /** Envía un mensaje de texto saliente al contacto de ese hilo. */
  enviarMensaje(externalConversationId: string, body: string): Promise<void>;
}
