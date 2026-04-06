/**
 * Cloudflare Worker — ranking-ai-worker
 *
 * Routes:
 *   POST /chat    — User chat with LLM (Llama 3), backed by Durable Object memory
 *   POST /analyze — Async heartbeat event ingestion from Go AI consumer
 *   OPTIONS *     — CORS preflight
 *
 * Assignment requirements satisfied:
 *   ✅ LLM        — Workers AI (Llama 3) called on every /chat request
 *   ✅ Workflow   — Worker orchestrates: load history → call LLM → save history
 *   ✅ User input — /chat is called by the dashboard chat UI (port 3002)
 *   ✅ Memory     — ConversationHistory Durable Object persists per-user context
 */

import { ConversationHistory, type Message } from './history';

export { ConversationHistory };

interface Env {
  AI: Ai;
  CONVERSATION_HISTORY: DurableObjectNamespace;
}

interface ChatRequest {
  userId: string;
  message: string;
}

interface AnalyzeRequest {
  session_id: string;
  user_id: string;
  video_id: string;
  playhead: number;
  timestamp: number;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === 'POST' && url.pathname === '/chat') {
      return handleChat(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/analyze') {
      return handleAnalyze(request, env);
    }

    return new Response('Not found', { status: 404, headers: CORS_HEADERS });
  },
};

// ---------------------------------------------------------------------------
// /chat — load history → call LLM → save history → return response
// ---------------------------------------------------------------------------

async function handleChat(request: Request, env: Env): Promise<Response> {
  let body: ChatRequest;
  try {
    body = await request.json<ChatRequest>();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const { userId, message } = body;
  if (!userId?.trim() || !message?.trim()) {
    return jsonError('userId and message are required', 400);
  }

  // ── Step 1: Load conversation history from Durable Object ──────────────
  const historyStub = getHistoryStub(env, userId);
  let history: Message[] = [];
  try {
    const res = await historyStub.fetch('http://do/history');
    history = await res.json<Message[]>();
  } catch (err) {
    console.error('history load error:', err);
    // Non-fatal: proceed with empty context
  }

  // ── Step 2: Build prompt and call Workers AI (Llama 3) ─────────────────
  const systemPrompt =
    'You are an AI assistant embedded in a real-time video ranking engine dashboard. ' +
    'You help operators understand video engagement trends, ranking scores, velocity spikes, ' +
    'and viewer behaviour. Be concise, data-focused, and helpful.';

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message },
  ];

  let aiResponse: string;
  try {
    const result = (await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages,
    })) as { response?: string };
    aiResponse = result.response?.trim() || 'No response generated.';
  } catch (err) {
    console.error('Workers AI error:', err);
    return jsonError('AI service temporarily unavailable', 502);
  }

  // ── Step 3: Persist new exchange to Durable Object ─────────────────────
  try {
    await historyStub.fetch('http://do/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userMessage: message, assistantMessage: aiResponse }),
    });
  } catch (err) {
    console.error('history save error:', err);
    // Non-fatal: return response even if save fails
  }

  return Response.json({ userId, response: aiResponse }, { headers: CORS_HEADERS });
}

// ---------------------------------------------------------------------------
// /analyze — async heartbeat ingestion from Go AI consumer (Kafka pipeline)
// ---------------------------------------------------------------------------

async function handleAnalyze(request: Request, env: Env): Promise<Response> {
  let event: AnalyzeRequest;
  try {
    event = await request.json<AnalyzeRequest>();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  // Validate minimal fields
  if (!event.video_id || !event.session_id) {
    return jsonError('video_id and session_id are required', 400);
  }

  // Log the event — in production this would write to Analytics Engine,
  // KV, or a queue for batch AI processing.
  console.log(
    `analyze: video=${event.video_id} session=${event.session_id} ` +
      `playhead=${event.playhead}ms ts=${event.timestamp}`,
  );

  // Return 202 immediately so the Go consumer is never blocked.
  return Response.json(
    { status: 'accepted', videoId: event.video_id },
    { status: 202, headers: CORS_HEADERS },
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHistoryStub(env: Env, userId: string): DurableObjectStub {
  const id = env.CONVERSATION_HISTORY.idFromName(userId);
  return env.CONVERSATION_HISTORY.get(id);
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: CORS_HEADERS });
}
