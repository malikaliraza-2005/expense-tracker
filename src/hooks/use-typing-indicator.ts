'use client';

import * as React from 'react';

import { createClient } from '@/lib/supabase/client';

/**
 * Live "X is typing…" over Realtime **Broadcast** — shared by DMs and per-expense chat.
 *
 * Design choices that matter:
 *
 *  - **Ephemeral, never persisted.** Typing rides broadcast, not the database, so a
 *    keystroke never writes a row. Only the fact "someone is typing" is exchanged; no
 *    message content, and no display name (see below).
 *  - **Its own channel, isolated from message delivery.** DMs deliver messages on
 *    `dm-thread:<id>` (postgres_changes, public); typing runs on a *separate* private
 *    channel `dm-typing:<id>`. If typing authorization is ever misconfigured, only
 *    typing degrades — message delivery is untouched.
 *  - **Private channel.** `{ private: true }` means Realtime authorizes every
 *    subscribe/broadcast against `realtime.messages` RLS (migration 0030), so only the
 *    thread's participants can send or see typing. `realtime.setAuth` (called before
 *    subscribe, as the chat clients already do) supplies the JWT.
 *  - **No name in the payload.** Only the sender's `userId` is broadcast; the receiver
 *    maps it to *their own* roster name (names are roster-relative everywhere else in
 *    the app). So this hook tracks ids; the component resolves names.
 *
 * Returns the set of other users currently typing (ids), plus `notifyTyping` (call on
 * each keystroke — throttled internally) and `stopTyping` (call on send). `clearFrom`
 * lets a caller drop a user the instant their message arrives, rather than waiting out
 * the expiry.
 */

/** While actively typing, re-announce at most this often (ms). */
const THROTTLE_MS = 2_000;
/** After this long with no keystroke, tell the other side we stopped (ms). */
const IDLE_STOP_MS = 3_000;
/** Drop a remote typer if we haven't heard from them within this window (ms). */
const RECEIVE_EXPIRY_MS = 5_000;

type TypingPayload = { userId: string };

export function useTypingIndicator({
  topic,
  meId,
  enabled = true,
}: {
  /** The private channel topic, e.g. `dm-typing:<threadId>`. */
  topic: string;
  /** The current account id — filtered out of the result and echoes. */
  meId: string;
  /** Gate (e.g. the chat participant gate). When false the hook is inert. */
  enabled?: boolean;
}) {
  const [typingUserIds, setTypingUserIds] = React.useState<string[]>([]);

  const channelRef = React.useRef<ReturnType<
    ReturnType<typeof createClient>['channel']
  > | null>(null);
  const readyRef = React.useRef(false);
  const lastSentRef = React.useRef(0);
  const idleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Per-remote-user expiry timers, so a typer auto-clears if their refreshes stop.
  const expiryTimersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const clearFrom = React.useCallback((userId: string) => {
    const timer = expiryTimersRef.current.get(userId);
    if (timer) clearTimeout(timer);
    expiryTimersRef.current.delete(userId);
    setTypingUserIds((prev) => prev.filter((id) => id !== userId));
  }, []);

  // Subscribe once per (topic, enabled). setAuth-then-subscribe mirrors the chat
  // clients so RLS applies to the socket.
  React.useEffect(() => {
    if (!enabled || !topic) return;
    const supabase = createClient();
    let cancelled = false;
    const expiryTimers = expiryTimersRef.current;

    const markTyping = (userId: string) => {
      if (userId === meId) return; // never show our own typing
      setTypingUserIds((prev) =>
        prev.includes(userId) ? prev : [...prev, userId],
      );
      const existing = expiryTimers.get(userId);
      if (existing) clearTimeout(existing);
      expiryTimers.set(
        userId,
        setTimeout(() => clearFrom(userId), RECEIVE_EXPIRY_MS),
      );
    };

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      const channel = supabase
        .channel(topic, { config: { private: true, broadcast: { self: false } } })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          markTyping((payload as TypingPayload).userId);
        })
        .on('broadcast', { event: 'stop' }, ({ payload }) => {
          clearFrom((payload as TypingPayload).userId);
        })
        .subscribe((status) => {
          // On a clean join we can send; on error/timeout we stay inert (typing just
          // won't show) rather than retry-looping or surfacing an error to the user.
          readyRef.current = status === 'SUBSCRIBED';
        });

      channelRef.current = channel;
    })();

    return () => {
      cancelled = true;
      readyRef.current = false;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      expiryTimers.forEach((t) => clearTimeout(t));
      expiryTimers.clear();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setTypingUserIds([]);
    };
  }, [topic, meId, enabled, clearFrom]);

  const stopTyping = React.useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    lastSentRef.current = 0; // let the next keystroke announce immediately
    if (readyRef.current && channelRef.current) {
      void channelRef.current.send({
        type: 'broadcast',
        event: 'stop',
        payload: { userId: meId } satisfies TypingPayload,
      });
    }
  }, [meId]);

  const notifyTyping = React.useCallback(() => {
    if (!enabled) return;

    // Throttle the "still typing" announcements so a fast typist sends a few small
    // events, not one per keystroke.
    const now = Date.now();
    if (readyRef.current && channelRef.current && now - lastSentRef.current > THROTTLE_MS) {
      lastSentRef.current = now;
      void channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: meId } satisfies TypingPayload,
      });
    }

    // Reset the idle timer: once the user pauses for IDLE_STOP_MS, announce a stop.
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(stopTyping, IDLE_STOP_MS);
  }, [enabled, meId, stopTyping]);

  return {
    typingUserIds: typingUserIds.filter((id) => id !== meId),
    notifyTyping,
    stopTyping,
    clearFrom,
  };
}
