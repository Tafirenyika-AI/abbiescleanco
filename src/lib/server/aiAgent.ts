import { getIntegrationValue } from "@/lib/server/integrationSettings";

/**
 * A small, shared Claude tool-calling loop used by all three Abbie AI tiers (admin/customer/guest).
 * The model decides which real tool(s) to call and composes the final reply; it never invents data
 * itself -- every fact in the reply has to come from a tool's real return value, because the model
 * has no other source of truth in this conversation (no browsing, no memory of other users' data).
 * Structural safety: each tier only ever receives the tool set appropriate to it (e.g. the guest
 * tier's tools have no way to read any customer/lead/booking data at all, so there's no path for
 * the model to leak it even if asked) -- see each tier's own tool list.
 */

export interface AgentTool {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  run: (input: Record<string, unknown>) => Promise<unknown>;
}

export interface AgentResult {
  text: string;
  /** Every tool call the model actually made this turn, in order -- callers use this to detect a
   *  specific tool (e.g. an action-proposal tool) having fired, rather than string-matching the reply. */
  toolCalls: { name: string; input: Record<string, unknown>; result: unknown }[];
  /** True only when no Anthropic key is configured -- callers should show a clear setup message. */
  notConfigured?: boolean;
}

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

const MAX_TOOL_ITERATIONS = 4;

export async function runAgent(opts: { systemPrompt: string; tools: AgentTool[]; userMessage: string }): Promise<AgentResult> {
  const apiKey = await getIntegrationValue("anthropicApiKey", "ANTHROPIC_API_KEY");
  if (!apiKey) return { text: "Abbie AI needs an Anthropic API key configured in Settings → Integrations before it can chat.", toolCalls: [], notConfigured: true };

  const baseUrl = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  const toolDefs = opts.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));

  const messages: { role: "user" | "assistant"; content: string | ContentBlock[] }[] = [{ role: "user", content: opts.userMessage }];
  const toolCalls: AgentResult["toolCalls"] = [];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    let data: { content?: ContentBlock[]; stop_reason?: string };
    try {
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 800, system: opts.systemPrompt, tools: toolDefs, messages }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
      data = await res.json();
    } catch {
      return { text: "I'm having trouble reaching the AI service right now. Please try again in a moment.", toolCalls };
    }

    const blocks = data.content ?? [];
    const toolUseBlocks = blocks.filter((b) => b.type === "tool_use");

    if (toolUseBlocks.length === 0) {
      const text = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n\n").trim();
      return { text: text || "I don't have an answer for that.", toolCalls };
    }

    messages.push({ role: "assistant", content: blocks });
    const toolResults: ContentBlock[] = [];
    for (const block of toolUseBlocks) {
      const tool = opts.tools.find((t) => t.name === block.name);
      const input = block.input ?? {};
      let result: unknown;
      try {
        result = tool ? await tool.run(input) : { error: "Unknown tool" };
      } catch {
        result = { error: "That lookup failed. Please try again." };
      }
      toolCalls.push({ name: block.name!, input, result });
      toolResults.push({ type: "tool_result", id: block.id, text: JSON.stringify(result) } as ContentBlock);
    }
    messages.push({
      role: "user",
      content: toolResults.map((r) => ({ type: "tool_result", tool_use_id: r.id, content: r.text }) as unknown as ContentBlock),
    });
  }

  return { text: "That took more steps than I can handle in one go -- could you ask in a simpler way?", toolCalls };
}
