import "dotenv/config";
import Fastify from "fastify";
import formbody from "@fastify/formbody";
import { registerWebhookRoutes } from "./routes/webhooks.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { scheduleFollowUpJob } from "./jobs/followUps.js";

const app = Fastify({ logger: true });

await app.register(formbody); // para los formularios HTML de /admin

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
