import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

async function init() {
  const root = createRoot(document.getElementById("root")!);
  const params = new URLSearchParams(window.location.search);
  const convId  = params.get("c");
  const agentId = params.get("agent");

  if (convId) {
    // Direct conversation link — open chat immediately
    const { default: ChatPage } = await import("./pages/ChatPage");
    root.render(
      <React.StrictMode>
        <ChatPage convId={convId} />
      </React.StrictMode>
    );
  } else if (agentId) {
    // Public agent link — create a fresh conversation, then open chat
    const { default: ChatPage } = await import("./pages/ChatPage");

    root.render(
      <React.StrictMode>
        <ChatPage convId="__loading__" />
      </React.StrictMode>
    );

    try {
      const res  = await fetch("/api/public/chat/start", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ agentId: parseInt(agentId, 10) }),
      });
      const data = await res.json() as { convId: number; agentName: string };
      if (data.convId) {
        // Replace URL so a refresh reuses the same conversation
        const newUrl = `${window.location.pathname}?c=${data.convId}`;
        window.history.replaceState(null, "", newUrl);
        root.render(
          <React.StrictMode>
            <ChatPage convId={String(data.convId)} agentName={data.agentName} />
          </React.StrictMode>
        );
      }
    } catch {
      root.render(
        <React.StrictMode>
          <ChatPage convId="" />
        </React.StrictMode>
      );
    }
  } else {
    const { default: App } = await import("./App");
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
}

init();
