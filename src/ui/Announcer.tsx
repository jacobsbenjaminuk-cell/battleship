import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../core';
import { announce } from './announce';

type Spoken = { readonly id: number; readonly text: string };

/**
 * A visually hidden live region. Each announcement is rendered as a fresh node
 * so that repeating the same sentence (a second rejected shot, say) is still
 * spoken.
 */
export function Announcer({ state }: { readonly state: GameState }) {
  const previous = useRef(state);
  const [spoken, setSpoken] = useState<Spoken>({ id: 0, text: '' });

  useEffect(() => {
    const text = announce(previous.current, state);
    previous.current = state;
    if (text) setSpoken((last) => ({ id: last.id + 1, text }));
  }, [state]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      <p key={spoken.id}>{spoken.text}</p>
    </div>
  );
}
