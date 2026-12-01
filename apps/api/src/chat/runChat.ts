import { isChatToolName, type ChatSourceDto, type ChatStreamEvent, type ChatToolCallDto } from "@briefklar/shared";
import type { ChatPart, ChatTurn, LLMProvider } from "../llm/LLMProvider";
import { logCall, logFailedAttempts, logFailure } from "../llm/logCall";
import { CHAT_TOOLS, runTool, toolDeclarations, type ChatTool, type ToolContext } from "./tools";

/** Tool rounds before the model must answer with what it has */
export const MAX_TOOL_ROUNDS = 5;

export interface RunChatOptions {
  provider: LLMProvider;
  system: string;
  promptVersion: string;
  /** Earlier messages of the conversation */
  history: ChatTurn[];
  message: string;
  context: ToolContext;
  tools?: ChatTool<unknown>[];
  onEvent: (event: Extract<ChatStreamEvent, { type: "tool" | "delta" }>) => void;
}

export interface ChatAnswer {
  text: string;
  toolCalls: ChatToolCallDto[];
  sources: ChatSourceDto[];
  /** The model that wrote the final answer */
  model: string;
}

/**
 * The tool loop: the model gets the conversation and the tool declarations. When it asks for
 * tool calls, they run here and their results go back to it, until it answers with text.
 * Each round is one logged model call.
 */
export async function runChat(options: RunChatOptions): Promise<ChatAnswer> {
  const { provider, system, promptVersion, context, onEvent } = options;
  const tools = options.tools ?? CHAT_TOOLS;
  const declarations = toolDeclarations(tools);
  const logContext = { provider, purpose: "chat", promptVersion, documentId: context.documentId };

  const turns: ChatTurn[] = [...options.history, { role: "user", parts: [{ type: "text", text: options.message }] }];
  const toolCalls: ChatToolCallDto[] = [];
  const sources = new Map<string, ChatSourceDto>();
  let text = "";

  for (let round = 0; ; round++) {
    // Text from an earlier round (e.g. "Let me check the date") is separated from the answer
    let roundStarted = false;
    const onDelta = (delta: string) => {
      if (!roundStarted && text && !text.endsWith("\n\n")) {
        text += "\n\n";
        onEvent({ type: "delta", text: "\n\n" });
      }
      roundStarted = true;
      text += delta;
      onEvent({ type: "delta", text: delta });
    };

    const startedAt = Date.now();
    let result;
    try {
      result = await provider.chatRound(
        {
          system,
          turns,
          tools: declarations,
          toolChoice: round < MAX_TOOL_ROUNDS ? "auto" : "none",
          signal: context.signal,
        },
        onDelta,
      );
    } catch (err) {
      await logFailure(logContext, err, startedAt, context.signal?.aborted ? "Aborted by the client" : undefined);
      throw err;
    }
    await logFailedAttempts(logContext, result.failedAttempts);
    await logCall({
      ...logContext,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: result.latencyMs,
      success: true,
    });

    turns.push({ role: "model", parts: result.parts, model: result.model });
    const calls = result.parts.filter((part) => part.type === "toolCall");
    if (calls.length === 0 || round >= MAX_TOOL_ROUNDS) {
      return { text: text.trim(), toolCalls, sources: [...sources.values()], model: result.model };
    }

    // Independent calls in one round (e.g. two dates to check) run in parallel
    const results = await Promise.all(
      calls.map(async (call): Promise<ChatPart> => {
        const name = isChatToolName(call.name) ? call.name : null;
        if (name) onEvent({ type: "tool", name, status: "running" });
        let output;
        try {
          output = await runTool(call.name, call.args, context, tools);
        } catch (err) {
          if (context.signal?.aborted) throw err;
          console.error(`Chat tool ${call.name} failed:`, err);
          output = { ok: false, result: { error: "The tool failed. Answer without it or suggest trying again." } };
        }
        if (name) {
          onEvent({ type: "tool", name, status: output.ok ? "done" : "failed" });
          toolCalls.push({ name, ok: output.ok });
        }
        for (const source of output.sources ?? []) sources.set(source.url, source);
        return { type: "toolResult", id: call.id, name: call.name, result: output.result };
      }),
    );
    turns.push({ role: "user", parts: results });
  }
}
