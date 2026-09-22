import { WhatsAppAdapter } from "./whatsapp.js";
import { InstagramAdapter } from "./instagram.js";
import { MessengerAdapter } from "./messenger.js";
import type { ChannelAdapter, ChannelType } from "./types.js";

const adapters: Record<ChannelType, ChannelAdapter> = {
  WHATSAPP: new WhatsAppAdapter(),
  INSTAGRAM: new InstagramAdapter(),
  MESSENGER: new MessengerAdapter(),
};

export function getAdapter(channel: ChannelType): ChannelAdapter {
  return adapters[channel];
}
