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

/**
 * Cliente de Prisma con reintento ante errores transitorios de conexión
 * (frecuentes en Postgres serverless bajo carga concurrente, p. ej. Neon).
 */
function makeClient() {
  return new PrismaClient({ adapter }).$extends({
    query: {
      async $allOperations({ args, query }) {
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
