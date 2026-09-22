import type { z } from "zod";
import type { ChannelType } from "../../channels/types.js";

export type ToolContext = {
  contactId: string;
  conversationId: string;
  channel: ChannelType;
};

export type ToolDefinition<Schema extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  description: string;
  schema: Schema;
  /** Esquema en formato JSON Schema, para pasárselo a Claude tal cual. */
  inputSchema: Record<string, unknown>;
  execute: (args: z.infer<Schema>, ctx: ToolContext) => Promise<unknown>;
};

/**
 * Versión "con el tipo borrado" de ToolDefinition, para guardar tools con
 * distintos esquemas de Zod en una misma colección (un array/mapa de
 * ToolDefinition<A> | ToolDefinition<B> | ... no se deja, por varianza de
 * genéricos en la posición de función de `execute`). Cada tool individual
 * se sigue escribiendo con su Schema concreto — esto es solo para el
 * registro compartido en tools/index.ts.
 */
export type AnyToolDefinition = {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  inputSchema: Record<string, unknown>;
  execute: (args: never, ctx: ToolContext) => Promise<unknown>;
};
