export interface LlmClient {
  complete(input: { system: string; user: string }): Promise<string>;
}

export interface OpenAiCompatibleConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export function createOpenAiCompatibleClient(config: OpenAiCompatibleConfig): LlmClient {
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 8_000;
  const baseUrl = config.baseUrl.replace(/\/$/, '');

  return {
    async complete({ system, user }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config.model,
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`LLM HTTP ${response.status}`);
        }
        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim()) {
          throw new Error('LLM empty completion');
        }
        return content;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function parseLlmJson(raw: string): { text: string; followUpChips: string[] } {
  const parsed = JSON.parse(raw) as { text?: unknown; followUpChips?: unknown };
  if (typeof parsed.text !== 'string' || !parsed.text.trim()) {
    throw new Error('LLM JSON missing text');
  }
  const followUpChips = Array.isArray(parsed.followUpChips)
    ? parsed.followUpChips.filter((chip): chip is string => typeof chip === 'string')
    : [];
  return { text: parsed.text.trim(), followUpChips };
}
