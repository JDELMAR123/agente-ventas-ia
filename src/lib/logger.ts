import { prisma } from "../db/prisma.js";

/**
 * Observabilidad: cada vez que el agente llama a una tool, queda registrado
 * (qué tool, con qué argumentos, qué devolvió) — consultable desde /admin.
 */
export async function logToolCall(params: {
  conversationId: string | null;
  engine: "rules" | "anthropic";
  toolName: string;
  args: unknown;
  result: unknown;
  ok: boolean;
}): Promise<void> {
  try {
    await prisma.toolCallLog.create({
      data: {
        conversationId: params.conversationId,
        engine: params.engine,
        toolName: params.toolName,
        args: JSON.stringify(params.args),
        result: JSON.stringify(params.result).slice(0, 4000),
        ok: params.ok,
      },
    });
  } catch (err) {
    // El registro de observabilidad nunca debe tumbar la conversación real.
    console.error("[logToolCall] no se pudo guardar el registro:", err);
  }
  // Además, log en consola para desarrollo/depuración inmediata.
  const status = params.ok ? "OK" : "ERROR";
  console.log(
    `[tool:${status}] ${params.toolName} conv=${params.conversationId ?? "-"} args=${JSON.stringify(params.args)}`
  );
}
