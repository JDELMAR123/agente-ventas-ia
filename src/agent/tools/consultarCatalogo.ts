import { z } from "zod";
import { searchCatalog } from "../../catalog/products.js";
import type { ToolDefinition } from "./types.js";

const schema = z.object({
  query: z.string().describe("Qué producto o servicio busca el cliente"),
});

export const consultarCatalogo: ToolDefinition<typeof schema> = {
  name: "consultar_catalogo",
  description:
    "Busca un producto o servicio en el catálogo real del negocio (nombre, precio, " +
    "descripción, disponibilidad). Úsala SIEMPRE que el cliente pregunte por un " +
    "producto o un precio — NUNCA inventes precios ni disponibilidad de memoria.",
  schema,
  inputSchema: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
  },
  async execute({ query }) {
    const results = await searchCatalog(query);
    if (results.length === 0) return { encontrados: 0, productos: [] };
    return {
      encontrados: results.length,
      productos: results.map((p) => ({
        nombre: p.name,
        categoria: p.category,
        precio: p.price,
        descripcion: p.description,
      })),
    };
  },
};
