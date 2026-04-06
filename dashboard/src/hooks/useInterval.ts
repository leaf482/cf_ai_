'use client';

import { useEffect, useRef } from 'react';

/**
 * Runs a callback at a fixed interval.
 * @param callback - Function to run each interval
 * @param delayMs - Interval in milliseconds (null = paused)
 */
export function useInterval(callback: () => void | Promise<void>, delayMs: number | null) {
  const savedCallback = useRef(callback);
  const savedDelay = useRef(delayMs);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    savedDelay.current = delayMs;
  }, [delayMs]);

  useEffect(() => {
    if (delayMs === null) return;

    const tick = () => {
      void savedCallback.current();
    };

    const id = setInterval(tick, delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}
