import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const connectionString =
  process.env.DATABASE_URL_POOLED ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Falta DATABASE_URL. Copia .env.example a .env y pon tu conexión a Postgres."
  );
}

const adapter = new PrismaPg({ connectionString });

// Solo lecturas: reintentar una escritura (create/update/upsert/delete) ante
// una conexión caída es peligroso — el servidor pudo haber confirmado la
// escritura antes de que el cliente perdiera la conexión, y un reintento la
// duplicaría (mensajes repetidos, logs duplicados). Las lecturas son
// idempotentes por naturaleza, así que ahí sí es seguro reintentar.
const READ_OPERATIONS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

/**
 * Cliente de Prisma con reintento ante errores transitorios de conexión
 * (frecuentes en Postgres serverless bajo carga concurrente, p. ej. Neon) —
 * solo para operaciones de lectura, ver comentario de READ_OPERATIONS.
 */
function makeClient() {
  return new PrismaClient({ adapter }).$extends({
    query: {
      async $allOperations({ operation, args, query }) {
        if (!READ_OPERATIONS.has(operation)) {
          return query(args);
        }
        const RETRYABLE = ["08P01", "P2024", "P2039"];
        let lastError: unknown;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            return await query(args);
          } catch (err) {
            lastError = err;
            const code = (err as { code?: string })?.code;
            const message = String((err as Error)?.message ?? "");
            const transient =
              (code && RETRYABLE.includes(code)) ||
              /connection terminated|closed/i.test(message);
            if (!transient) throw err;
            await new Promise((r) => setTimeout(r, 60 * (attempt + 1)));
          }
        }
        throw lastError;
      },
    },
  });
}

export const prisma = makeClient();
