import type { FastifyInstance } from "fastify";
import { prisma } from "../db/prisma.js";
import { requireBasicAuth } from "../lib/basicAuth.js";
import { htmlPage, esc } from "../lib/htmlPage.js";

const STAGE_LABEL: Record<string, string> = {
  NUEVO: "Nuevo",
  CONTACTADO: "Contactado",
  NEGOCIANDO: "Negociando",
  GANADO: "Ganado",
  PERDIDO: "Perdido",
};

export async function registerDashboardRoutes(root: FastifyInstance) {
  await root.register(async (app: FastifyInstance) => {
  // Hook con scope al plugin encapsulado (ver mismo comentario en admin.ts).
  app.addHook("preHandler", requireBasicAuth);

  app.get("/dashboard", async (_req, reply) => {
    const [conversations, stageCounts, recentToolCalls] = await Promise.all([
      prisma.conversation.findMany({
        orderBy: { lastMessageAt: "desc" },
        take: 30,
        include: { contact: { include: { leads: true } } },
      }),
      prisma.lead.groupBy({ by: ["stage"], _count: true }),
      prisma.toolCallLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    ]);

    const countFor = (stage: string) => stageCounts.find((s) => s.stage === stage)?._count ?? 0;

    const stageCards = Object.entries(STAGE_LABEL)
      .map(
        ([stage, label]) => `<div class="card" style="text-align:center;padding:14px;">
          <div style="font-size:1.4rem;font-weight:700;">${countFor(stage)}</div>
          <div class="hint" style="margin:0;">${label}</div>
        </div>`
      )
      .join("");

    const conversationRows = conversations
      .map((c) => {
        const lead = c.contact.leads[0];
        const nombre = c.contact.name ?? c.contact.phone ?? c.contactId;
        return `<tr>
          <td>${esc(nombre)}</td>
          <td>${esc(c.channel)}</td>
          <td><span class="pill">${c.status === "PAUSADA" ? "⏸ pausada (humano)" : c.status === "CERRADA" ? "cerrada" : "activa"}</span></td>
          <td>${lead ? `<span class="pill">${STAGE_LABEL[lead.stage] ?? lead.stage}</span>` : "—"}</td>
          <td class="hint">${esc(c.lastMessagePreview ?? "—")}</td>
          <td class="hint">${c.lastMessageAt.toLocaleString("es-ES")}</td>
        </tr>`;
      })
      .join("");

    const toolRows = recentToolCalls
      .map(
        (t) => `<tr>
          <td>${t.createdAt.toLocaleString("es-ES")}</td>
          <td><span class="pill">${esc(t.engine)}</span></td>
          <td>${esc(t.toolName)}</td>
          <td>${t.ok ? "✅" : "❌"}</td>
        </tr>`
      )
      .join("");

    const body = `
<h1>Dashboard</h1>
<p class="hint">Conversaciones activas y en qué etapa está cada lead.</p>

<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:24px;">
  ${stageCards}
</div>

<section class="card">
  <h2>Conversaciones recientes</h2>
  <table>
    <thead><tr><th>Contacto</th><th>Canal</th><th>Estado</th><th>Etapa</th><th>Último mensaje</th><th>Cuándo</th></tr></thead>
    <tbody>${conversationRows || `<tr><td colspan="6" class="hint">Sin conversaciones todavía.</td></tr>`}</tbody>
  </table>
</section>

<section class="card">
  <h2>Últimas llamadas a tools (observabilidad)</h2>
  <table>
    <thead><tr><th>Cuándo</th><th>Motor</th><th>Tool</th><th>Ok</th></tr></thead>
    <tbody>${toolRows || `<tr><td colspan="4" class="hint">Sin actividad todavía.</td></tr>`}</tbody>
  </table>
</section>
`;
    reply.type("text/html").send(htmlPage("Dashboard — Agente de Ventas", "dashboard", body));
  });
  });
}
