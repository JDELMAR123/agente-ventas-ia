/** Manda un aviso a Slack (Incoming Webhook). Si no hay URL configurada, no hace nada. */
export async function notifySlack(webhookUrl: string | null, text: string): Promise<void> {
  if (!webhookUrl) return;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error(`[slack] respuesta ${res.status} al notificar`);
    }
  } catch (err) {
    console.error("[slack] no se pudo notificar:", err);
  }
}
