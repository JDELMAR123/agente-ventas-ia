import { prisma } from "../db/prisma.js";

export const DEFAULT_BUSINESS_NAME = "Mi negocio";
export const DEFAULT_BRAND_TONE = "cercano y profesional, sin exagerar con emojis";
export const DEFAULT_AI_MODEL = "claude-sonnet-5";
export const DEFAULT_BUSINESS_CONTEXT = `
Los clientes escriben para preguntar por nuestros productos o servicios:
disponibilidad, precios, condiciones, o para resolver dudas antes de comprar.

Objetivo: identificar qué quiere el cliente (según el catálogo configurado),
calificarlo como lead y avanzarlo hacia el cierre de la venta.
`.trim();

export type ResolvedSettings = {
  businessName: string;
  brandTone: string;
  maxDescuentoPct: number;
  ai: {
    /** Proveedor EFECTIVO: "anthropic" solo si hay clave configurada. */
    provider: "rules" | "anthropic";
    configuredProvider: "rules" | "anthropic";
    apiKey: string | null;
    model: string;
    businessContext: string;
  };
  escalation: {
    slackWebhookUrl: string | null;
    email: string | null;
  };
  channels: {
    verifyToken: string | null;
    whatsapp: { token: string; phoneId: string } | null;
    instagram: { token: string; accountId: string } | null;
    messenger: { token: string; pageId: string } | null;
  };
};

type SettingsRow = Awaited<ReturnType<typeof prisma.settings.findUnique>>;

// Caché en memoria de la instancia: se lee en cada mensaje entrante, se
// escribe rara vez (solo desde /admin). Ventana corta, se invalida al guardar.
let rowCache: { row: NonNullable<SettingsRow>; at: number } | null = null;
const ROW_TTL_MS = 30_000;

async function loadRow(): Promise<NonNullable<SettingsRow>> {
  if (rowCache && Date.now() - rowCache.at < ROW_TTL_MS) return rowCache.row;

  let row = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (!row) {
    row = await prisma.settings.create({
      data: {
        id: "singleton",
        businessName: DEFAULT_BUSINESS_NAME,
        brandTone: DEFAULT_BRAND_TONE,
        aiModel: DEFAULT_AI_MODEL,
        aiBusinessContext: DEFAULT_BUSINESS_CONTEXT,
      },
    });
  }
  rowCache = { row, at: Date.now() };
  return row;
}

export async function getSettings(): Promise<ResolvedSettings> {
  const row = await loadRow();

  const configuredProvider = row.aiProvider === "anthropic" ? "anthropic" : "rules";
  const apiKey = row.aiApiKey || process.env.ANTHROPIC_API_KEY || null;
  const provider = configuredProvider === "anthropic" && apiKey ? "anthropic" : "rules";

  const verifyToken = row.metaVerifyToken || process.env.META_WEBHOOK_VERIFY_TOKEN || null;
  const waToken = row.waToken || process.env.META_WHATSAPP_TOKEN || null;
  const waPhoneId = row.waPhoneId || process.env.META_WHATSAPP_PHONE_ID || null;
  const igToken = row.igToken || process.env.META_INSTAGRAM_TOKEN || null;
  const igAccountId = row.igAccountId || process.env.META_INSTAGRAM_ACCOUNT_ID || null;
  const msgToken = row.messengerToken || process.env.META_MESSENGER_TOKEN || null;
  const msgPageId = row.messengerPageId || process.env.META_MESSENGER_PAGE_ID || null;

  return {
    businessName: row.businessName || DEFAULT_BUSINESS_NAME,
    brandTone: row.brandTone || DEFAULT_BRAND_TONE,
    maxDescuentoPct: row.maxDescuentoPct,
    ai: {
      provider,
      configuredProvider,
      apiKey,
      model: row.aiModel || process.env.ANTHROPIC_MODEL || DEFAULT_AI_MODEL,
      businessContext: row.aiBusinessContext?.trim() || DEFAULT_BUSINESS_CONTEXT,
    },
    escalation: {
      slackWebhookUrl: row.slackWebhookUrl || process.env.SLACK_WEBHOOK_URL || null,
      email: row.escalationEmail || process.env.ESCALATION_EMAIL || null,
    },
    channels: {
      verifyToken,
      whatsapp: waToken && waPhoneId ? { token: waToken, phoneId: waPhoneId } : null,
      instagram: igToken && igAccountId ? { token: igToken, accountId: igAccountId } : null,
      messenger: msgToken && msgPageId ? { token: msgToken, pageId: msgPageId } : null,
    },
  };
}

export async function getSettingsRow() {
  return loadRow();
}

export async function updateSettings(
  data: Parameters<typeof prisma.settings.update>[0]["data"]
) {
  await loadRow();
  const row = await prisma.settings.update({ where: { id: "singleton" }, data });
  rowCache = { row, at: Date.now() };
  return row;
}
