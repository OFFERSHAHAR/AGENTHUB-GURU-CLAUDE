export default function Slide10Roadmap() {
  return (
    <div className="w-screen h-screen overflow-hidden relative flex flex-col" style={{ background: "#F8FAFC" }}>
      <div className="absolute top-0 left-0 right-0 h-[0.5vh]" style={{ background: "#0F766E" }} />

      <div className="px-[7vw] pt-[7vh] pb-[7vh] flex-1 flex flex-col">
        <div className="mb-[4vh]">
          <div className="text-[1.6vw] font-bold uppercase tracking-widest mb-[1.5vh]" style={{ color: "#0F766E" }}>
            Roadmap
          </div>
          <div className="text-[2.6vw] font-bold leading-snug" style={{ color: "#1E293B", textWrap: "balance" }}>
            Q3 centers on mobile, global search, and enterprise tier; Q4 adds analytics and scale
          </div>
          <div className="h-[0.25vh] w-[8vw] mt-[2vh]" style={{ background: "#0F766E" }} />
        </div>

        <div className="flex-1 flex gap-[1.5vw]">
          <div className="flex-1 flex flex-col" style={{ background: "#E2E8F0", borderRadius: "0.5vw", overflow: "hidden" }}>
            <div className="px-[1.5vw] py-[1.5vh] text-[1.8vw] font-bold" style={{ background: "#94A3B8", color: "#FFFFFF" }}>
              Q1 2026 — Done
            </div>
            <div className="px-[1.5vw] py-[2vh] flex flex-col gap-[1.5vh] flex-1">
              <div className="text-[1.7vw] font-bold" style={{ color: "#1E293B" }}>Core Platform</div>
              <div className="text-[1.6vw]" style={{ color: "#64748B" }}>Agent repo, client management, assignment system</div>
              <div className="text-[1.7vw] font-bold mt-[1vh]" style={{ color: "#1E293B" }}>Workflow Canvas</div>
              <div className="text-[1.6vw]" style={{ color: "#64748B" }}>Visual drag-and-drop workflow builder</div>
              <div className="text-[1.7vw] font-bold mt-[1vh]" style={{ color: "#1E293B" }}>10 Launch Agents</div>
              <div className="text-[1.6vw]" style={{ color: "#64748B" }}>Sales, marketing, operations, finance verticals</div>
            </div>
          </div>

          <div className="flex-1 flex flex-col" style={{ background: "#E2E8F0", borderRadius: "0.5vw", overflow: "hidden" }}>
            <div className="px-[1.5vw] py-[1.5vh] text-[1.8vw] font-bold" style={{ background: "#94A3B8", color: "#FFFFFF" }}>
              Q2 2026 — Done
            </div>
            <div className="px-[1.5vw] py-[2vh] flex flex-col gap-[1.5vh] flex-1">
              <div className="text-[1.7vw] font-bold" style={{ color: "#1E293B" }}>Persistent Memory</div>
              <div className="text-[1.6vw]" style={{ color: "#64748B" }}>Full conversation history for all 11 agents</div>
              <div className="text-[1.7vw] font-bold mt-[1vh]" style={{ color: "#1E293B" }}>Telegram Integration</div>
              <div className="text-[1.6vw]" style={{ color: "#64748B" }}>Bot delivery of business analysis in Hebrew</div>
              <div className="text-[1.7vw] font-bold mt-[1vh]" style={{ color: "#1E293B" }}>N8N Workflow Architect</div>
              <div className="text-[1.6vw]" style={{ color: "#64748B" }}>Memory-aggregating automation JSON generator</div>
            </div>
          </div>

          <div className="flex-1 flex flex-col" style={{ background: "#EFF6F5", borderRadius: "0.5vw", overflow: "hidden", border: "2px solid #0F766E" }}>
            <div className="px-[1.5vw] py-[1.5vh] text-[1.8vw] font-bold" style={{ background: "#0F766E", color: "#FFFFFF" }}>
              Q3 2026 — Current
            </div>
            <div className="px-[1.5vw] py-[2vh] flex flex-col gap-[1.5vh] flex-1">
              <div className="text-[1.7vw] font-bold" style={{ color: "#1E293B" }}>Mobile Companion App</div>
              <div className="text-[1.6vw]" style={{ color: "#64748B" }}>React Native Expo — agent management on the go</div>
              <div className="text-[1.7vw] font-bold mt-[1vh]" style={{ color: "#1E293B" }}>Global Search</div>
              <div className="text-[1.6vw]" style={{ color: "#64748B" }}>Instant cross-entity search: agents, clients, logs</div>
              <div className="text-[1.7vw] font-bold mt-[1vh]" style={{ color: "#1E293B" }}>Enterprise Tier</div>
              <div className="text-[1.6vw]" style={{ color: "#64748B" }}>SSO, audit logs, custom SLA, dedicated support</div>
            </div>
          </div>

          <div className="flex-1 flex flex-col" style={{ background: "#F1F5F9", borderRadius: "0.5vw", overflow: "hidden" }}>
            <div className="px-[1.5vw] py-[1.5vh] text-[1.8vw] font-bold" style={{ background: "#475569", color: "#FFFFFF" }}>
              Q4 2026 — Planned
            </div>
            <div className="px-[1.5vw] py-[2vh] flex flex-col gap-[1.5vh] flex-1">
              <div className="text-[1.7vw] font-bold" style={{ color: "#1E293B" }}>Usage Analytics</div>
              <div className="text-[1.6vw]" style={{ color: "#64748B" }}>Per-client reports showing agent ROI and usage</div>
              <div className="text-[1.7vw] font-bold mt-[1vh]" style={{ color: "#1E293B" }}>Specification Agent</div>
              <div className="text-[1.6vw]" style={{ color: "#64748B" }}>AI-driven product requirement gathering</div>
              <div className="text-[1.7vw] font-bold mt-[1vh]" style={{ color: "#1E293B" }}>API Webhooks</div>
              <div className="text-[1.6vw]" style={{ color: "#64748B" }}>Outbound event triggers for external integrations</div>
            </div>
          </div>
        </div>

        <div className="mt-[2vh] text-[1.4vw]" style={{ color: "#94A3B8" }}>
          Source: Internal product planning, as of June 2026. Q4 scope subject to Q3 review and board approval.
        </div>
      </div>

      <div className="absolute bottom-[2.5vh] right-[5vw] text-[1.4vw]" style={{ color: "#94A3B8" }}>
        AgentHub &nbsp;&middot;&nbsp; 10
      </div>
    </div>
  );
}
