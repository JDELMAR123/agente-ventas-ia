import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../db/prisma.js";
import { getSettings, getSettingsRow, updateSettings } from "../settings/index.js";
import { requireBasicAuth } from "../lib/basicAuth.js";
import { htmlPage, esc } from "../lib/htmlPage.js";

type SettingsBody = {
  businessName?: string;
  brandTone?: string;
  aiProvider?: string;
  aiApiKey?: string;
  aiApiKey__clear?: string;
  aiBusinessContext?: string;
  maxDescuentoPct?: string;
  slackWebhookUrl?: string;
  escalationEmail?: string;
  metaVerifyToken?: string;
  waToken?: string;
  waPhoneId?: string;
};

type ProductBody = {
  name?: string;
  category?: string;
  description?: string;
  price?: string;
  sku?: string;
  keywords?: string;
  active?: string;
};

function renderAdminPage(opts: {
  settings: Awaited<ReturnType<typeof getSettings>>;
  row: Awaited<ReturnType<typeof getSettingsRow>>;
  products: Awaited<ReturnType<typeof prisma.product.findMany>>;
  saved?: string;
}) {
  const { settings, row, products, saved } = opts;

  const productsRows = products
    .map(
      (p) => `<tr>
        <td>${esc(p.name)}</td>
        <td>${p.category ? esc(p.category) : "—"}</td>
        <td>${p.price != null ? "$" + p.price : "—"}</td>
        <td><span class="pill">${p.active ? "activo" : "inactivo"}</span></td>
        <td class="row-actions">
          <a href="/admin/products/${p.id}">Editar</a>
          &nbsp;
          <form method="post" action="/admin/products/${p.id}/delete" onsubmit="return confirm('¿Eliminar ${esc(p.name)}?')">
            <button class="danger" type="submit" style="margin-top:0;padding:4px 8px;font-size:12px;">Eliminar</button>
          </form>
        </td>
      </tr>`
    )
    .join("");

  const body = `
${saved ? `<div class="flash">${esc(saved)}</div>` : ""}
<h1>Ajustes</h1>
<p class="hint">Todo lo que necesitas configurar para tu negocio, sin tocar código.</p>

<section class="card">
  <h2>Negocio</h2>
  <form method="post" action="/admin/settings">
    <label>Nombre del negocio</label>
    <input type="text" name="businessName" value="${esc(settings.businessName)}" required>

    <label>Tono de marca</label>
    <textarea name="brandTone">${esc(settings.brandTone)}</textarea>

    <label>Contexto del negocio (para la IA)</label>
    <textarea name="aiBusinessContext">${esc(settings.ai.businessContext)}</textarea>

    <label>% de descuento máximo autorizado (0 = ninguno)</label>
    <input type="number" name="maxDescuentoPct" min="0" max="100" value="${settings.maxDescuentoPct}">

    <button type="submit">Guardar</button>
  </form>
</section>

<section class="card">
  <h2>Motor de IA</h2>
  <form method="post" action="/admin/settings">
    <input type="hidden" name="businessName" value="${esc(settings.businessName)}">
    <input type="hidden" name="brandTone" value="${esc(settings.brandTone)}">
    <input type="hidden" name="aiBusinessContext" value="${esc(settings.ai.businessContext)}">
    <input type="hidden" name="maxDescuentoPct" value="${settings.maxDescuentoPct}">

    <label>Proveedor</label>
    <select name="aiProvider">
      <option value="rules" ${settings.ai.configuredProvider === "rules" ? "selected" : ""}>Motor gratuito (reglas)</option>
      <option value="anthropic" ${settings.ai.configuredProvider === "anthropic" ? "selected" : ""}>Claude (Anthropic) — requiere tu propia clave</option>
    </select>

    <label>Clave de API de Anthropic ${row.aiApiKey ? "(ya configurada — deja vacío para no cambiarla)" : ""}</label>
    <input type="password" name="aiApiKey" placeholder="${row.aiApiKey ? "••••••••" : "sk-ant-..."}">
    ${row.aiApiKey ? `<label style="font-weight:400;font-size:12px;"><input type="checkbox" name="aiApiKey__clear" style="width:auto;"> Quitar la clave y volver al motor gratuito</label>` : ""}

    <button type="submit">Guardar</button>
  </form>
</section>

<section class="card">
  <h2>Escalamiento a humano</h2>
  <form method="post" action="/admin/settings">
    <input type="hidden" name="businessName" value="${esc(settings.businessName)}">
    <input type="hidden" name="brandTone" value="${esc(settings.brandTone)}">
    <input type="hidden" name="aiBusinessContext" value="${esc(settings.ai.businessContext)}">
    <input type="hidden" name="maxDescuentoPct" value="${settings.maxDescuentoPct}">
    <input type="hidden" name="aiProvider" value="${settings.ai.configuredProvider}">

    <label>Webhook de Slack (Incoming Webhook URL)</label>
    <input type="url" name="slackWebhookUrl" value="${esc(settings.escalation.slackWebhookUrl ?? "")}" placeholder="https://hooks.slack.com/services/...">

    <label>Correo de respaldo</label>
    <input type="email" name="escalationEmail" value="${esc(settings.escalation.email ?? "")}">

    <button type="submit">Guardar</button>
  </form>
</section>

<section class="card">
  <h2>WhatsApp (Meta Cloud API)</h2>
  <form method="post" action="/admin/settings">
    <input type="hidden" name="businessName" value="${esc(settings.businessName)}">
    <input type="hidden" name="brandTone" value="${esc(settings.brandTone)}">
    <input type="hidden" name="aiBusinessContext" value="${esc(settings.ai.businessContext)}">
    <input type="hidden" name="maxDescuentoPct" value="${settings.maxDescuentoPct}">
    <input type="hidden" name="aiProvider" value="${settings.ai.configuredProvider}">

    <label>Token de verificación del webhook</label>
    <input type="text" name="metaVerifyToken" value="${esc(row.metaVerifyToken ?? "")}" placeholder="invéntate una cadena secreta">

    <label>Token de acceso de WhatsApp ${row.waToken ? "(configurado)" : ""}</label>
    <input type="password" name="waToken" placeholder="${row.waToken ? "••••••••" : "EAAG..."}">

    <label>Phone Number ID</label>
    <input type="text" name="waPhoneId" value="${esc(row.waPhoneId ?? "")}">

    <button type="submit">Guardar</button>
  </form>
</section>

<section class="card">
  <h2>Productos / catálogo</h2>
  <p class="hint">El agente SOLO conoce lo que pongas aquí — nunca inventa precios.</p>
  <table>
    <thead><tr><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Estado</th><th></th></tr></thead>
    <tbody>${productsRows || `<tr><td colspan="5" class="hint">Aún no hay productos.</td></tr>`}</tbody>
  </table>
  <p><a href="/admin/products/new">+ Nuevo producto</a></p>
</section>
`;
  return htmlPage("Ajustes — Agente de Ventas", "admin", body);
}

function productForm(product: {
  id?: string;
  name?: string;
  category?: string | null;
  description?: string | null;
  price?: number | null;
  sku?: string | null;
  keywords?: string[];
  active?: boolean;
} = {}) {
  const isEdit = Boolean(product.id);
  const body = `
<h1>${isEdit ? "Editar producto" : "Nuevo producto"}</h1>
<section class="card">
  <form method="post" action="${isEdit ? `/admin/products/${product.id}` : "/admin/products"}">
    <label>Nombre *</label>
    <input type="text" name="name" value="${esc(product.name ?? "")}" required>

    <label>Categoría</label>
    <input type="text" name="category" value="${esc(product.category ?? "")}">

    <label>Precio</label>
    <input type="number" step="0.01" name="price" value="${product.price ?? ""}">

    <label>SKU / referencia</label>
    <input type="text" name="sku" value="${esc(product.sku ?? "")}">

    <label>Descripción</label>
    <textarea name="description">${esc(product.description ?? "")}</textarea>

    <label>Palabras clave (separadas por comas)</label>
    <input type="text" name="keywords" value="${esc((product.keywords ?? []).join(", "))}">

    <label style="font-weight:400;"><input type="checkbox" name="active" ${product.active !== false ? "checked" : ""} style="width:auto;"> Activo (visible para el agente)</label>

    <button type="submit">Guardar</button>
    <a href="/admin" style="margin-left:12px;">Cancelar</a>
  </form>
</section>`;
  return htmlPage(isEdit ? "Editar producto" : "Nuevo producto", "admin", body);
}

export async function registerAdminRoutes(root: FastifyInstance) {
  await root.register(async (app: FastifyInstance) => {
  // Hook con scope: solo afecta a las rutas registradas dentro de este
  // plugin encapsulado, no a toda la app (si se usara app.addHook en la
  // instancia raíz, también protegería "/", "/health" y el webhook de Meta).
  app.addHook("preHandler", requireBasicAuth);

  app.get("/admin", async (req: FastifyRequest<{ Querystring: { saved?: string } }>, reply: FastifyReply) => {
    const [settings, row, products] = await Promise.all([
      getSettings(),
      getSettingsRow(),
      prisma.product.findMany({ orderBy: { name: "asc" } }),
    ]);
    reply.type("text/html").send(renderAdminPage({ settings, row, products, saved: req.query.saved }));
  });

  app.post("/admin/settings", async (req: FastifyRequest<{ Body: SettingsBody }>, reply: FastifyReply) => {
    const b = req.body;
    const apiKey =
      b.aiApiKey__clear === "on" ? null : b.aiApiKey?.trim() ? b.aiApiKey.trim() : undefined;

    await updateSettings({
      businessName: b.businessName?.trim() || "Mi negocio",
      brandTone: b.brandTone?.trim() || "",
      aiBusinessContext: b.aiBusinessContext?.trim() || "",
      maxDescuentoPct: Number(b.maxDescuentoPct) || 0,
      ...(b.aiProvider ? { aiProvider: b.aiProvider === "anthropic" ? "anthropic" : "rules" } : {}),
      ...(apiKey !== undefined ? { aiApiKey: apiKey } : {}),
      ...(b.slackWebhookUrl !== undefined ? { slackWebhookUrl: b.slackWebhookUrl.trim() || null } : {}),
      ...(b.escalationEmail !== undefined ? { escalationEmail: b.escalationEmail.trim() || null } : {}),
      ...(b.metaVerifyToken !== undefined ? { metaVerifyToken: b.metaVerifyToken.trim() || null } : {}),
      ...(b.waToken?.trim() ? { waToken: b.waToken.trim() } : {}),
      ...(b.waPhoneId !== undefined ? { waPhoneId: b.waPhoneId.trim() || null } : {}),
    });
    reply.redirect("/admin?saved=Guardado");
  });

  app.get("/admin/products/new", async (_req, reply) => {
    reply.type("text/html").send(productForm());
  });

  app.post("/admin/products", async (req: FastifyRequest<{ Body: ProductBody }>, reply: FastifyReply) => {
    const b = req.body;
    const keywords = (b.keywords ?? "")
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
    await prisma.product.create({
      data: {
        name: (b.name ?? "").trim(),
        category: b.category?.trim() || null,
        description: b.description?.trim() || null,
        price: b.price ? Number(b.price) : null,
        sku: b.sku?.trim() || null,
        keywords: JSON.stringify(keywords),
        active: b.active === "on",
      },
    });
    reply.redirect("/admin?saved=Producto creado");
  });

  app.get("/admin/products/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return reply.code(404).send("No encontrado");
    let keywords: string[] = [];
    try {
      keywords = JSON.parse(product.keywords);
    } catch {
      keywords = [];
    }
    reply.type("text/html").send(productForm({ ...product, keywords }));
  });

  app.post(
    "/admin/products/:id",
    async (req: FastifyRequest<{ Params: { id: string }; Body: ProductBody }>, reply: FastifyReply) => {
      const b = req.body;
      const keywords = (b.keywords ?? "")
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
      await prisma.product.update({
        where: { id: req.params.id },
        data: {
          name: (b.name ?? "").trim(),
          category: b.category?.trim() || null,
          description: b.description?.trim() || null,
          price: b.price ? Number(b.price) : null,
          sku: b.sku?.trim() || null,
          keywords: JSON.stringify(keywords),
          active: b.active === "on",
        },
      });
      reply.redirect("/admin?saved=Producto actualizado");
    }
  );

  app.post(
    "/admin/products/:id/delete",
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await prisma.product.delete({ where: { id: req.params.id } });
      reply.redirect("/admin?saved=Producto eliminado");
    }
  );
  });
}
