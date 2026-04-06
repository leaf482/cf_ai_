# AI Prompts Used

This file documents how I used AI assistance (GPT -> Cursor) while building the Cloudflare AI layer on top of this project. This prompt is also made by AI.

---

## Background

I already had a working Go + Kafka + Redis ranking pipeline. I wanted to extend it with Cloudflare Workers AI without breaking what I had. I used Claude as a coding assistant throughout — asking questions, getting explanations, and iterating on errors.

---

## Prompt 1 — Understanding the existing codebase

> i have this go kafka system already working, can u just look at the code and explain how the consumer works? like what does the event payload look like too. dont want to break anything

**What I learned:** The existing consumer uses group ID `contents-ranking-worker`. The payload is `HeartbeatEvent` — `session_id`, `video_id`, `playhead`, `user_id`, `timestamp`. Most importantly: Kafka consumer groups are independent, so a second group gets the full message stream without affecting the first one at all.

---

## Prompt 2 — Adding the Kafka → Cloudflare consumer

> I want to add a new kafka consumer that sends events to cloudflare worker endpoint. DO NOT touch the existing consumers or producers. just add new stuff. should be configurable with env var for the url, and maybe some retry logic? idk keep it simple

**What I learned:** A different `GroupID` in `kafka.NewReader` is literally all you need for an independent consumer. Also didn't need any new Go dependencies — stdlib `net/http` with a timeout was enough.

---

## Prompt 3 — What even are Durable Objects

> so the assignment says i need memory or state and mentions durable objects. whats the difference between durable objects and KV? when would u use one vs the other

**What I learned:** KV is eventually consistent, good for read-heavy stuff. Durable Objects are strongly consistent with a single-instance guarantee per key — so for per-user chat history where order matters, DO is the right call. KV could lose writes under concurrent access.

---

## Prompt 4 — Building the actual worker

> build a cloudflare worker that does this:
> - POST /chat takes { userId, message }
> - load history from durable object
> - call llama 3 with history as context
> - save new messages back to DO
> - return the response
>
> also explain each step dont just give me code

**What I learned:** The Worker itself is stateless — the DO holds everything. You access the DO through a "stub" and call `fetch()` on it like it's its own tiny HTTP server. Also learned that if history loading fails it shouldn't crash the whole request — just proceed with empty context.

---

## Prompt 5 — Durable object memory question

> in the durable object, do i need to read from storage every single time fetch() is called? seems slow. or can i just cache it in memory somehow

**What I learned:** DOs stay in memory while active ("warm"). Using a `loaded` boolean flag with lazy init is the standard pattern — skips redundant storage reads when the DO is already warm, but safely loads on cold start.

---

## Prompt 6 — Chat UI in the dashboard

> the dashboard is next.js app router. i wanna add a chat panel at the bottom. should match the existing style but use a different color so it stands out. also the worker url shouldnt be exposed to the browser

**What I learned:** Next.js Route Handlers run server-side, so proxying through `/api/cf/[...path]` keeps the Worker URL out of the browser entirely. For user identity without login, `localStorage` with a random ID is simple and good enough.

---

## Prompt 7 — Deploy error with durable objects

> getting this error when i deploy:
> "In order to use Durable Objects with a free plan, you must create a namespace using a new_sqlite_classes migration. [code: 10097]"
>
> what does this mean

**What I learned:** Free Cloudflare plan only supports the newer SQLite-backed DOs. Changing `new_classes` → `new_sqlite_classes` in the `wrangler.jsonc` migrations block fixed it immediately.

---

## Prompt 8 — Another deploy error

> now getting: "You need a workers.dev subdomain in order to proceed" [code: 10063]
> is this a code problem or do i need to do something on cloudflare dashboard

**What I learned:** It was an account thing — going to the Workers & Pages section of the Cloudflare dashboard for the first time auto-creates the `*.workers.dev` subdomain.

---

## Prompt 9 — Realizing the LLM is hallucinating

> wait the ai chat is working but its making up video titles lol. "Top 10 Funniest Moments" is not in my system. how do i make it actually read from my redis/ranking data

**What I learned:** The Worker runs on Cloudflare's edge — it can't reach my Docker network (`http://go-api:8080`). Two options: pass ranking data from the frontend in the request body (simple), or expose the Go API publicly and have the Worker fetch it (more complex). The frontend approach is cleaner for a demo.

---

## Prompt 10 — PROMPTS file

> can u write a prompts.md file. include what I asked, what I learned in the chat