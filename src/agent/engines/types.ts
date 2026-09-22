import type { ResolvedSettings } from "../../settings/index.js";
import type { ChannelType } from "../../channels/types.js";

export type EngineInput = {
  settings: ResolvedSettings;
  contactId: string;
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
