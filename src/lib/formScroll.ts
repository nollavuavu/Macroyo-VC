/**
 * Scrolls a form to its first invalid field when Save is pressed, so a blocked save never looks like nothing
 * happened. Screens report positions through onLayout: `group()` for a container (its y inside its parent) and
 * `field()` for a field (its y inside its group). The scroll itself is delayed a moment so the error texts that
 * were just added have been laid out and every position is current.
 */
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { fieldOffset, firstErrorKey, scrollTargetY, type ScrollGroup } from './scroll';

type Scrollable = { scrollTo: (options: { x?: number; y?: number; animated?: boolean }) => void };

export function useFormScroll<K extends string>(scrollRef: RefObject<Scrollable | null>, margin: number, delayMs = 60) {
  const groups = useRef<Record<string, ScrollGroup | undefined>>({});
  const fields = useRef<Partial<Record<K, { y: number; group?: string }>>>({});
  const revealed = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return useMemo(() => {
    const reveal = (key: K | null): boolean => {
      if (key == null) return false;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const field = fields.current[key];
        if (!field) return;
        scrollRef.current?.scrollTo({ y: scrollTargetY(0, fieldOffset(groups.current, field), margin), animated: true });
      }, delayMs);
      return true;
    };
    // A warning's onLayout fires again on rotation, font-scale changes and so on. Scroll once per appearance: the
    // key is remembered until the screen calls `forget` (when the warning goes away).
    const revealOnce = (key: K): boolean => {
      if (revealed.current.has(key)) return false;
      revealed.current.add(key);
      return reveal(key);
    };
    return {
      revealOnce,
      forget: (key: K) => { revealed.current.delete(key); },
      group: (name: string, parent?: string) => (event: LayoutChangeEvent) => {
        groups.current[name] = { y: event.nativeEvent.layout.y, parent };
      },
      field: (key: K, group?: string) => (event: LayoutChangeEvent) => {
        fields.current[key] = { y: event.nativeEvent.layout.y, group };
      },
      reveal,
      revealFirst: (order: readonly K[], errors: Partial<Record<K, unknown>>): K | null => {
        const key = firstErrorKey(order, errors);
        reveal(key);
        return key;
      },
    };
  }, [scrollRef, margin, delayMs]);
}
