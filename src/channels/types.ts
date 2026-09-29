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
  /**
   * Envía un mensaje de texto libre. En WhatsApp, esto SOLO funciona dentro
   * de la ventana de 24h desde el último mensaje del cliente — fuera de eso,
   * Meta lo rechaza. Quien llame a esto es responsable de esa comprobación
   * (ver src/jobs/followUps.ts).
   */
  enviarMensaje(externalConversationId: string, body: string): Promise<void>;
  /**
   * Envía una plantilla pre-aprobada por Meta — el único tipo de mensaje
   * permitido fuera de la ventana de 24h. Opcional porque no todos los
   * canales tienen este concepto (o esta implementación); si un canal no lo
   * soporta, quien llame debe tratarlo como "no se puede enviar" en vez de
   * asumir que existe.
   */
  enviarPlantilla?(
    externalConversationId: string,
    templateName: string,
    lang: string
  ): Promise<void>;
}
