import "dotenv/config";
import Fastify from "fastify";
import formbody from "@fastify/formbody";
import { registerWebhookRoutes } from "./routes/webhooks.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { scheduleFollowUpJob } from "./jobs/followUps.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Cuerpo crudo (bytes) del request JSON — necesario para validar la
     *  firma X-Hub-Signature-256 de Meta, que se calcula sobre los bytes
     *  exactos recibidos, no sobre el JSON re-serializado. */
    rawBody?: Buffer;
  }
}

const app = Fastify({ logger: true });

await app.register(formbody); // para los formularios HTML de /admin

// Parser de JSON a medida: guarda el cuerpo crudo en req.rawBody antes de
// parsearlo, para poder validar la firma de Meta sobre los bytes exactos.
app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
  req.rawBody = body as Buffer;
  if ((body as Buffer).length === 0) {
    done(null, {});
    return;
  }
  try {
    done(null, JSON.parse((body as Buffer).toString("utf8")));
  } catch (err) {
    done(err as Error, undefined);
  }
});

app.get("/", async () => ({
  ok: true,
  service: "agente-ventas-ia",
  admin: "/admin",
  dashboard: "/dashboard",
}));
app.get("/health", async () => ({ ok: true }));

await registerWebhookRoutes(app);
await registerAdminRoutes(app);
await registerDashboardRoutes(app);

const port = Number(process.env.PORT ?? 3300);

try {
  await app.listen({ port, host: "0.0.0.0" });
  scheduleFollowUpJob();
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
