'use client';

import { useEffect, useRef, useState } from 'react';

/** Ticks elapsed seconds while `running`; freezes when stopped. */
export function useElapsed(running: boolean, stopped: boolean): number {
  const [seconds, setSeconds] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running || stopped) return;
    if (startRef.current == null) startRef.current = Date.now();
    const id = setInterval(() => {
      if (startRef.current != null) {
        setSeconds(Math.floor((Date.now() - startRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running, stopped]);

  return seconds;
}
