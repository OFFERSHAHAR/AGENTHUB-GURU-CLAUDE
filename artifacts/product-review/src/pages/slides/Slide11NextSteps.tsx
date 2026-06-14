export default function Slide11NextSteps() {
  return (
    <div className="w-screen h-screen overflow-hidden relative flex flex-col justify-center" style={{ background: "#0F172A" }}>
      <div className="absolute top-0 left-0 right-0 h-[0.5vh]" style={{ background: "#0F766E" }} />

      <div className="px-[8vw]">
        <div className="text-[1.6vw] font-bold uppercase tracking-widest mb-[2vh]" style={{ color: "#0F766E" }}>
          Next Steps
        </div>
        <div className="text-[2.8vw] font-bold leading-snug mb-[1.5vh]" style={{ color: "#F1F5F9", textWrap: "balance" }}>
          Three decisions are needed from this review to advance Q3 priorities
        </div>
        <div className="h-[0.3vh] w-[10vw] mb-[5vh]" style={{ background: "#0F766E" }} />

        <div className="flex flex-col gap-[3.5vh]">
          <div className="flex items-start gap-[3vw]">
            <div className="text-[3.5vw] font-bold shrink-0 leading-none" style={{ color: "#0F766E" }}>
              01
            </div>
            <div>
              <div className="text-[2.1vw] font-bold mb-[0.6vh]" style={{ color: "#F1F5F9" }}>
                Budget approval for Q3 mobile contractor engagement
              </div>
              <div className="text-[1.8vw]" style={{ color: "#64748B" }}>
                Estimated $28K for a 10-week Expo specialist contract. Required to meet Week 8 beta target.
              </div>
            </div>
          </div>

          <div className="h-[1px]" style={{ background: "#1E293B" }} />

          <div className="flex items-start gap-[3vw]">
            <div className="text-[3.5vw] font-bold shrink-0 leading-none" style={{ color: "#0F766E" }}>
              02
            </div>
            <div>
              <div className="text-[2.1vw] font-bold mb-[0.6vh]" style={{ color: "#F1F5F9" }}>
                Enterprise tier pricing sign-off before launch
              </div>
              <div className="text-[1.8vw]" style={{ color: "#64748B" }}>
                Proposed at $999/month per client. Final price requires CFO review and competitive benchmarking approval.
              </div>
            </div>
          </div>

          <div className="h-[1px]" style={{ background: "#1E293B" }} />

          <div className="flex items-start gap-[3vw]">
            <div className="text-[3.5vw] font-bold shrink-0 leading-none" style={{ color: "#0F766E" }}>
              03
            </div>
            <div>
              <div className="text-[2.1vw] font-bold mb-[0.6vh]" style={{ color: "#F1F5F9" }}>
                Target segment definition for global search prioritization
              </div>
              <div className="text-[1.8vw]" style={{ color: "#64748B" }}>
                Search scope depends on whether Q3 focus is existing SMB clients or enterprise prospects — two different index designs.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[3vh] right-[5vw] text-[1.4vw]" style={{ color: "#334155" }}>
        AgentHub &nbsp;&middot;&nbsp; 11
      </div>
    </div>
  );
}
