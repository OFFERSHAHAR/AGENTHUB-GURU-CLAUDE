export default function Slide08ProductHighlights() {
  return (
    <div className="w-screen h-screen overflow-hidden relative flex flex-col" style={{ background: "#F8FAFC" }}>
      <div className="absolute top-0 left-0 right-0 h-[0.5vh]" style={{ background: "#0F766E" }} />

      <div className="px-[7vw] pt-[7vh] pb-[7vh] flex-1 flex flex-col">
        <div className="mb-[4vh]">
          <div className="text-[1.6vw] font-bold uppercase tracking-widest mb-[1.5vh]" style={{ color: "#0F766E" }}>
            Product Highlights
          </div>
          <div className="text-[2.6vw] font-bold leading-snug" style={{ color: "#1E293B", textWrap: "balance" }}>
            Three major features shipped in Q2, each adopted by over 60% of active clients
          </div>
          <div className="h-[0.25vh] w-[8vw] mt-[2vh]" style={{ background: "#0F766E" }} />
        </div>

        <div className="flex-1 flex flex-col justify-center gap-[4vh]">
          <div className="flex gap-[3vw] items-start p-[2.5vh_2.5vw]" style={{ background: "#EFF6F5", borderLeft: "4px solid #0F766E" }}>
            <div>
              <div className="text-[2.1vw] font-bold mb-[0.8vh]" style={{ color: "#1E293B" }}>
                Persistent Memory System
              </div>
              <div className="text-[1.9vw] leading-relaxed" style={{ color: "#64748B" }}>
                All 11 agents now retain full conversation history per client. Memory is surfaced in every reply, eliminating repeated context-setting. Adoption: 100% of active clients within 2 weeks.
              </div>
            </div>
          </div>

          <div className="flex gap-[3vw] items-start p-[2.5vh_2.5vw]" style={{ background: "#EFF6F5", borderLeft: "4px solid #0F766E" }}>
            <div>
              <div className="text-[2.1vw] font-bold mb-[0.8vh]" style={{ color: "#1E293B" }}>
                Telegram Integration with Hebrew Business Analysis
              </div>
              <div className="text-[1.9vw] leading-relaxed" style={{ color: "#64748B" }}>
                Clients receive automated business intelligence reports via Telegram bot. Supports Groq and OpenAI routing with token cost visibility. Adopted by 68% of active clients.
              </div>
            </div>
          </div>

          <div className="flex gap-[3vw] items-start p-[2.5vh_2.5vw]" style={{ background: "#EFF6F5", borderLeft: "4px solid #0F766E" }}>
            <div>
              <div className="text-[2.1vw] font-bold mb-[0.8vh]" style={{ color: "#1E293B" }}>
                N8N Workflow Architect Agent
              </div>
              <div className="text-[1.9vw] leading-relaxed" style={{ color: "#64748B" }}>
                New agent aggregates memory across all assigned agents for a client and generates ready-to-import N8N automation JSON. Positions AgentHub as an end-to-end workflow platform.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[2.5vh] right-[5vw] text-[1.4vw]" style={{ color: "#94A3B8" }}>
        AgentHub &nbsp;&middot;&nbsp; 8
      </div>
    </div>
  );
}
