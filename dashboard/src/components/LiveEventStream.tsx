'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SIMULATION_BASE } from '@/lib/config';
import { getVideoTitle } from '@/lib/videos';
import { motion, AnimatePresence } from 'framer-motion';

interface StreamEvent {
  userId: string;
  videoId: string;
  timestamp: number;
}

interface LiveEventStreamProps {
  embedded?: boolean;
}

const MAX_EVENTS_EMBEDDED = 20;
const MAX_EVENTS_FULL = 200;
const POLL_MS = 250;

export function LiveEventStream({ embedded }: LiveEventStreamProps) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const maxEvents = embedded ? MAX_EVENTS_EMBEDDED : MAX_EVENTS_FULL;

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${SIMULATION_BASE}/v1/events/stream`);
      const json = await res.json();
      const list = Array.isArray(json.events) ? json.events : [];
      setEvents(list.slice(0, maxEvents));
    } catch {
      setEvents([]);
    }
  }, [maxEvents]);

  useEffect(() => {
    fetchEvents();
    const id = setInterval(fetchEvents, POLL_MS);
    return () => clearInterval(id);
  }, [fetchEvents]);

  const containerClass = embedded
    ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
    : 'rounded-lg border border-gray-700 bg-gray-800/80 p-3 shadow-lg';

  const listClass = embedded
    ? 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden'
    : 'h-[280px] min-h-[200px] overflow-y-auto overflow-x-hidden';

  const renderedEvents = useMemo(() => [...events].reverse(), [events]);

  // Keep latest events visible in full console view.
  useEffect(() => {
    if (embedded) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [embedded, renderedEvents]);

  return (
    <div className={containerClass}>
      <h3 className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {embedded ? 'Live Event Stream' : 'LIVE EVENT STREAM'}
      </h3>
      <div ref={listRef} className={listClass}>
        <AnimatePresence mode="popLayout" initial={false}>
          {events.length === 0 ? (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-gray-500"
            >
              No events yet
            </motion.p>
          ) : (
            renderedEvents.map((e, i) => (
              <motion.div
                key={`${e.timestamp}-${e.userId}-${e.videoId}-${i}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="mb-1.5 text-xs font-mono text-gray-400"
              >
                <span className="text-gray-500">
                  {new Date(e.timestamp).toLocaleTimeString()}
                </span>{' '}
                User {e.userId} → {getVideoTitle(e.videoId)} (+1)
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
