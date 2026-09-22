import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Para migraciones conviene una conexión directa (sin pooler). Si usas
    // Neon con Vercel, esa integración expone DATABASE_URL_UNPOOLED.
    // "||" (no "??"): una variable presente pero vacía ("") en el .env de un
    // comprador debe caer al siguiente respaldo igual que si no existiera.
    url:
      process.env["DATABASE_URL_UNPOOLED"] ||
      process.env["POSTGRES_URL_NON_POOLING"] ||
      process.env["DATABASE_URL"],
  },
});
