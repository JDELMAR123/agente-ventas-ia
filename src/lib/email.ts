import nodemailer from "nodemailer";
import type { ResolvedSettings } from "../settings/index.js";

/**
 * Manda un correo de escalamiento por SMTP. Si no hay credenciales SMTP
 * configuradas, no hace nada (silencioso a propósito, igual que
 * notifySlack sin webhook) — Slack sigue siendo el aviso principal; esto es
 * solo un respaldo cuando el negocio configuró explícitamente su SMTP.
 */
export async function notifyEmail(
  settings: ResolvedSettings,
  subject: string,
  text: string
): Promise<void> {
  const smtp = settings.escalation.smtp;
  if (!smtp || !settings.escalation.email) return;

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: smtp.user, pass: smtp.password },
    });
    await transporter.sendMail({
      from: smtp.from || smtp.user,
      to: settings.escalation.email,
      subject,
      text,
    });
  } catch (err) {
    console.error("[email] no se pudo enviar el correo de escalamiento:", err);
  }
}
