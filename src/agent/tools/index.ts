import { buscarCliente } from "./buscarCliente.js";
import { crearOActualizarLead } from "./crearOActualizarLead.js";
import { consultarCatalogo } from "./consultarCatalogo.js";
import { registrarInteraccion } from "./registrarInteraccion.js";
import { programarSeguimiento } from "./programarSeguimiento.js";
import { escalarAHumano } from "./escalarAHumano.js";
import type { AnyToolDefinition } from "./types.js";

export const tools: AnyToolDefinition[] = [
  buscarCliente,
  crearOActualizarLead,
  consultarCatalogo,
  registrarInteraccion,
  programarSeguimiento,
  escalarAHumano,
];

export const toolsByName = new Map(tools.map((t) => [t.name, t]));

export {
  buscarCliente,
  crearOActualizarLead,
  consultarCatalogo,
  registrarInteraccion,
  programarSeguimiento,
  escalarAHumano,
};
export type { ToolDefinition, ToolContext } from "./types.js";
