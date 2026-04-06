/**
 * ConversationHistory — Durable Object
 *
 * One instance per userId (keyed by name).
 * Persists the last MAX_MESSAGES messages so the LLM gets conversation context
 * on every subsequent chat request.
 */

const MAX_MESSAGES = 10; // 5 user + 5 assistant pairs

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export class ConversationHistory {
  private state: DurableObjectState;
  private history: Message[] = [];
  private loaded = false;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  // Lazy-load from storage on first request to this DO instance.
  private async load(): Promise<void> {
    if (this.loaded) return;
    this.history = (await this.state.storage.get<Message[]>('history')) ?? [];
    this.loaded = true;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    await this.load();

    // GET /history — return current history for LLM context
    if (request.method === 'GET' && url.pathname === '/history') {
      return Response.json(this.history);
    }

    // POST /history — append a new user+assistant exchange, trim to MAX_MESSAGES
    if (request.method === 'POST' && url.pathname === '/history') {
      const { userMessage, assistantMessage } = await request.json<{
        userMessage: string;
        assistantMessage: string;
      }>();

      this.history.push({ role: 'user', content: userMessage });
      this.history.push({ role: 'assistant', content: assistantMessage });

      if (this.history.length > MAX_MESSAGES) {
        this.history = this.history.slice(-MAX_MESSAGES);
      }

      await this.state.storage.put('history', this.history);
      return Response.json({ saved: true, count: this.history.length });
    }

    // DELETE /history — clear conversation (useful for testing)
    if (request.method === 'DELETE' && url.pathname === '/history') {
      this.history = [];
      await this.state.storage.delete('history');
      return Response.json({ cleared: true });
    }

    return new Response('Not found', { status: 404 });
  }
}
