'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { CF_AI_BASE } from '@/lib/config';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function AIChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist a random userId in localStorage so conversation history survives page refreshes.
  useEffect(() => {
    const stored = localStorage.getItem('ai_chat_user_id');
    const id = stored ?? `user_${Math.random().toString(36).slice(2, 9)}`;
    if (!stored) localStorage.setItem('ai_chat_user_id', id);
    setUserId(id);
  }, []);

  // Auto-scroll to latest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !userId) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`${CF_AI_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message: trimmed }),
      });

      const data = (await res.json()) as { response?: string; error?: string };
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.response ?? data.error ?? 'No response received.',
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error: could not reach AI service.' },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, userId]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-[480px] rounded-lg border border-violet-700/40 bg-gray-900/60 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-2 border-b border-gray-700 bg-gray-900 px-4 py-3">
        <div className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.8)]" />
        <span className="text-sm font-semibold text-gray-200">AI Assistant</span>
        <span className="ml-1 rounded bg-violet-900/50 px-2 py-0.5 text-xs text-violet-300">
          Llama 3 · Workers AI
        </span>
        <span className="ml-auto font-mono text-xs text-gray-600">{userId}</span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin">
        {messages.length === 0 && (
          <p className="mt-12 text-center text-xs text-gray-600">
            Ask about video rankings, velocity spikes, or engagement trends.
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[82%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-violet-700/80 text-gray-100 rounded-br-sm'
                  : 'bg-gray-800 text-gray-200 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-2">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div className="border-t border-gray-700 bg-gray-900/80 p-3 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about rankings or video trends…"
          disabled={isLoading}
          className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-violet-500 disabled:opacity-50 transition-colors"
        />
        <button
          onClick={() => void sendMessage()}
          disabled={isLoading || !input.trim()}
          className="rounded-lg bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:opacity-40 px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
