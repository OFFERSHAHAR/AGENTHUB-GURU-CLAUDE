export default function Slide09Challenges() {
  return (
    <div className="w-screen h-screen overflow-hidden relative flex flex-col" style={{ background: "#F8FAFC" }}>
      <div className="absolute top-0 left-0 right-0 h-[0.5vh]" style={{ background: "#0F766E" }} />

      <div className="px-[7vw] pt-[7vh] pb-[7vh] flex-1 flex flex-col">
        <div className="mb-[4vh]">
          <div className="text-[1.6vw] font-bold uppercase tracking-widest mb-[1.5vh]" style={{ color: "#0F766E" }}>
            Challenges &amp; Learnings
          </div>
          <div className="text-[2.6vw] font-bold leading-snug" style={{ color: "#1E293B", textWrap: "balance" }}>
            Two Q2 items were scoped and deferred to Q3 with defined mitigation plans
          </div>
          <div className="h-[0.25vh] w-[8vw] mt-[2vh]" style={{ background: "#0F766E" }} />
        </div>

        <div className="flex-1 flex gap-[4vw]">
          <div className="flex-1 flex flex-col gap-[3vh]">
            <div className="text-[2vw] font-bold pb-[1.5vh]" style={{ color: "#1E293B", borderBottom: "2px solid #0F766E" }}>
              Item 1 — Mobile Companion App
            </div>

            <div>
              <div className="text-[1.7vw] font-bold uppercase tracking-wide mb-[1vh]" style={{ color: "#64748B" }}>
                What happened
              </div>
              <div className="text-[1.9vw] leading-relaxed" style={{ color: "#1E293B" }}>
                Design scope exceeded the initial estimate by 3 weeks. The offline-sync requirement added unexpected complexity to the Expo architecture.
              </div>
            </div>

            <div>
              <div className="text-[1.7vw] font-bold uppercase tracking-wide mb-[1vh]" style={{ color: "#64748B" }}>
                What we learned
              </div>
              <div className="text-[1.9vw] leading-relaxed" style={{ color: "#1E293B" }}>
                Offline-first mobile features require a dedicated discovery spike before estimation. Added to Q3 scoping process as a standard gate.
              </div>
            </div>

            <div>
              <div className="text-[1.7vw] font-bold uppercase tracking-wide mb-[1vh]" style={{ color: "#64748B" }}>
                Q3 Plan
              </div>
              <div className="text-[1.9vw] leading-relaxed" style={{ color: "#1E293B" }}>
                Scoped to React Native Expo with AsyncStorage. Target: beta by end of Q3 Week 8.
              </div>
            </div>
          </div>

          <div style={{ width: "1px", background: "#E2E8F0" }} />

          <div className="flex-1 flex flex-col gap-[3vh]">
            <div className="text-[2vw] font-bold pb-[1.5vh]" style={{ color: "#1E293B", borderBottom: "2px solid #0F766E" }}>
              Item 2 — Global Search
            </div>

            <div>
              <div className="text-[1.7vw] font-bold uppercase tracking-wide mb-[1vh]" style={{ color: "#64748B" }}>
                What happened
              </div>
              <div className="text-[1.9vw] leading-relaxed" style={{ color: "#1E293B" }}>
                Postgres full-text index required a schema rework across the agents, clients, and conversations tables. Rolled back to prevent data migration risk in production.
              </div>
            </div>

            <div>
              <div className="text-[1.7vw] font-bold uppercase tracking-wide mb-[1vh]" style={{ color: "#64748B" }}>
                What we learned
              </div>
              <div className="text-[1.9vw] leading-relaxed" style={{ color: "#1E293B" }}>
                Full-text search on multi-table JSON fields requires a dedicated migration window. Production schema changes now require a staging rehearsal before deployment.
              </div>
            </div>

            <div>
              <div className="text-[1.7vw] font-bold uppercase tracking-wide mb-[1vh]" style={{ color: "#64748B" }}>
                Q3 Plan
              </div>
              <div className="text-[1.9vw] leading-relaxed" style={{ color: "#1E293B" }}>
                Migration scheduled for Q3 Week 2 in a maintenance window. Search UI to follow in Week 4.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[2.5vh] right-[5vw] text-[1.4vw]" style={{ color: "#94A3B8" }}>
        AgentHub &nbsp;&middot;&nbsp; 9
      </div>
    </div>
  );
}
