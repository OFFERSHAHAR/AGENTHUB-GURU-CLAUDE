// ─── Agent-to-Agent communication bus ────────────────────────────────────────
// Singleton event bus shared between JARVIS and גבר

export type AgentId = "jarvis" | "gabar";
export type MsgType =
  | "task"        // delegate a task
  | "result"      // task completed
  | "approve_req" // request approval for high-risk action
  | "approved"    // approval granted
  | "rejected"    // approval denied
  | "chat"        // idle chatter between agents
  | "greeting"    // special greeting event (e.g. Or detected)
  | "alert";      // system alert

export interface AgentMsg {
  id: string;
  from: AgentId;
  to: AgentId | "all";
  type: MsgType;
  text: string;
  risk?: "low" | "high";
  taskId?: string;
  payload?: unknown;
  ts: number;
}

type Listener = (msg: AgentMsg) => void;

class AgentEventBus {
  private subs = new Set<Listener>();
  private history: AgentMsg[] = [];

  subscribe(fn: Listener): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  publish(msg: Omit<AgentMsg, "id" | "ts">): AgentMsg {
    const full: AgentMsg = {
      ...msg,
      id: Math.random().toString(36).slice(2),
      ts: Date.now(),
    };
    this.history = [...this.history.slice(-30), full];
    this.subs.forEach((fn) => {
      try { fn(full); } catch {}
    });
    return full;
  }

  getHistory(): AgentMsg[] {
    return this.history;
  }
}

export const agentBus = new AgentEventBus();
