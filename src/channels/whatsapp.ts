import { getSettings } from "../settings/index.js";
import type { ChannelAdapter, InboundMessage } from "./types.js";

const GRAPH_API_VERSION = "v21.0";

/** Forma del payload que manda Meta al webhook de WhatsApp (Cloud API). */
type WhatsAppWebhookPayload = {
  entry?: {
    changes?: {
      value?: {
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        messages?: {
          id?: string;
          from?: string;
          text?: { body?: string };
          type?: string;
        }[];
      };
    }[];
  }[];
};

export class WhatsAppAdapter implements ChannelAdapter {
  readonly channel = "WHATSAPP" as const;

  async isConfigured(): Promise<boolean> {
    const settings = await getSettings();
    return settings.channels.whatsapp != null;
  }

  recibirMensaje(payload: unknown): InboundMessage[] {
    const body = payload as WhatsAppWebhookPayload;
    const out: InboundMessage[] = [];

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value?.messages) continue;

        const contactByWaId = new Map(
          (value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null])
        );

        for (const msg of value.messages) {
          // Solo texto por ahora — audios/imágenes se pueden sumar después
          // sin tocar el core, es exactamente para esto que existe el adaptador.
          if (msg.type !== "text" || !msg.from) continue;

          out.push({
            channel: "WHATSAPP",
            externalConversationId: msg.from,
            externalContactId: msg.from,
            contactName: contactByWaId.get(msg.from) ?? null,
            body: msg.text?.body ?? "",
            externalMessageId: msg.id ?? null,
          });
        }
      }
    }

    return out;
  }

  async enviarMensaje(externalConversationId: string, text: string): Promise<void> {
    const settings = await getSettings();
    const wa = settings.channels.whatsapp;
    if (!wa) {
      console.warn("[whatsapp] canal no configurado, no se envía el mensaje");
      return;
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${wa.phoneId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${wa.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: externalConversationId,
        type: "text",
        text: { body: text },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`WhatsApp API respondió ${res.status}: ${detail}`);
    }
  }
}
