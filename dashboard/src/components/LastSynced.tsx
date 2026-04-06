'use client';

import { useEffect, useState } from 'react';

interface LastSyncedProps {
  /** Timestamp when last fetch succeeded (ms) */
  lastSyncedAt: number | null;
  className?: string;
}

export function LastSynced({ lastSyncedAt, className = '' }: LastSyncedProps) {
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);

  useEffect(() => {
    if (lastSyncedAt === null) {
      setSecondsAgo(null);
      return;
    }

    const update = () => {
      const sec = Math.floor((Date.now() - lastSyncedAt) / 1000);
      setSecondsAgo(sec);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lastSyncedAt]);

  if (lastSyncedAt === null) return null;

  return (
    <span className={`text-xs text-gray-500 ${className}`}>
      Last synced: {secondsAgo ?? 0}s ago
    </span>
  );
}
