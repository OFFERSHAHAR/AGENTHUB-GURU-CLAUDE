import { useEffect, useRef } from "react";

// ─── useTriggerStream — app-wide SSE push channel for live trigger updates ───
// Mirrors the web `useTriggerStream` hook: subscribes to the API server's GLOBAL
// trigger stream and calls `onEvent` whenever ANY trigger changes status —
// including fires that originate outside AgentHub (e.g. an external n8n call).
//
// EventSource only exists in React Native Web. On native iOS/Android there is no
// EventSource, so this hook becomes a no-op and the per-card react-query polling
// (which also polls from idle) is the live fallback — same contract as the web
// dashboard, which keeps polling as the graceful fallback when the stream drops.

const STREAM_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

export type TriggerStreamEvent = {
  clientId: number;
  assignmentId: number;
  triggerId: number;
  agentStatus: string;
  firedAt: string;
};

export function useTriggerStream(onEvent: (event: TriggerStreamEvent) => void) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    if (typeof EventSource === "undefined") return;

    const url = `${STREAM_BASE}/api/trigger/stream`;
    const source = new EventSource(url);
    source.addEventListener("trigger", (e) => {
      try {
        callbackRef.current(JSON.parse((e as MessageEvent).data));
      } catch {
        // Malformed frame — ignore; per-card polling fallback still covers us.
      }
    });

    return () => source.close();
  }, []);
}
