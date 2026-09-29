import type { ResolvedSettings } from "../../settings/index.js";
import type { ChannelType } from "../../channels/types.js";

export type EngineInput = {
  settings: ResolvedSettings;
  /** Id interno del contacto en nuestra base (cuid). */
  contactId: string;
  /** Teléfono o id del contacto EN EL CANAL (p. ej. el número de WhatsApp) —
   *  esto es lo que espera la tool buscar_cliente, no el id interno. */
  externalContactId: string;
  conversationId: string;
  channel: ChannelType;
  /** Mensajes previos de esta conversación, del más viejo al más nuevo. */
  history: { direction: "ENTRANTE" | "SALIENTE"; body: string }[];
  incomingText: string;
};

export type EngineOutput = {
  /** Borrador a enviar al cliente. null si no hay que responder nada (p. ej. tras escalar). */
  reply: string | null;
  escalated: boolean;
};

export interface Engine {
  name: "rules" | "anthropic";
  handle(input: EngineInput): Promise<EngineOutput>;
}
