import Anthropic from "@anthropic-ai/sdk";
import { tools, toolsByName } from "../tools/index.js";
import { buildSystemPrompt } from "../systemPrompt.js";
import { logToolCall } from "../../lib/logger.js";
import type { Engine, EngineInput } from "./types.js";

const MAX_TOOL_ROUNDS = 6;

/**
 * Motor de pago: Claude decide de verdad qué tool llamar y cuándo, vía
 * tool use / function calling real (no prompts sueltos). Se usa solo
 * cuando el comprador puso su propia clave de Anthropic en /admin.
 */
export const claudeEngine: Engine = {
  name: "anthropic",

  async handle({ settings, contactId, conversationId, channel, history, incomingText }: EngineInput) {
    if (!settings.ai.apiKey) {
      throw new Error("claudeEngine llamado sin clave de Anthropic configurada");
    }
    const ctx = { contactId, conversationId, channel };
    const client = new Anthropic({ apiKey: settings.ai.apiKey });

    const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
    }));

    const messages: Anthropic.MessageParam[] = [
      ...history.map((m) => ({
        role: (m.direction === "ENTRANTE" ? "user" : "assistant") as "user" | "assistant",
        content: m.body,
      })),
      { role: "user", content: incomingText },
    ];

    let escalated = false;
    let finalText: string | null = null;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.messages.create({
        model: settings.ai.model,
        max_tokens: 1024,
        system: buildSystemPrompt(settings),
        tools: anthropicTools,
        messages,
      });

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text"
      );
      finalText = textBlocks.map((b) => b.text).join("\n").trim() || null;

      if (toolUses.length === 0) break;

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const call of toolUses) {
        const tool = toolsByName.get(call.name);
        let result: unknown;
        let ok = true;
        try {
          if (!tool) throw new Error(`Tool desconocida: ${call.name}`);
          const parsed = tool.schema.parse(call.input) as never;
          result = await tool.execute(parsed, ctx);
        } catch (err) {
          ok = false;
          result = { error: err instanceof Error ? err.message : String(err) };
        }
        await logToolCall({
          conversationId,
          engine: "anthropic",
          toolName: call.name,
          args: call.input,
          result,
          ok,
        });
        if (call.name === "escalar_a_humano" && ok) escalated = true;

        toolResults.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(result),
          is_error: !ok,
        });
      }

      messages.push({ role: "user", content: toolResults });

      if (escalated) break;
      if (response.stop_reason !== "tool_use") break;
    }

    return { reply: finalText, escalated };
  },
};
