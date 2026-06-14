import { useEffect, useRef } from "react";

// ─── useTriggerStream — app-wide SSE push channel for live trigger updates ───
// Subscribes to the API server's GLOBAL trigger stream while mounted and calls
// `onEvent` whenever ANY trigger anywhere in the system fires or changes status
// — including fires that originate outside AgentHub (e.g. an external n8n call).
// This powers the Clients list, Dashboard activity feed, and Logs page so they
// update instantly. Falls back silently to each page's existing polling/refetch
// when the browser or connection can't keep a stream open.

const STREAM_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

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
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    const url = `${STREAM_BASE}/api/trigger/stream`;
    const source = new EventSource(url);
    source.addEventListener("trigger", (e) => {
      try {
        callbackRef.current(JSON.parse((e as MessageEvent).data));
      } catch {
        // Malformed frame — ignore; each page's polling fallback still covers us.
      }
    });

    return () => source.close();
  }, []);
}
