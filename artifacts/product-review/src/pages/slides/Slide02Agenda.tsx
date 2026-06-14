export default function Slide02Agenda() {
  return (
    <div className="w-screen h-screen overflow-hidden relative flex flex-col" style={{ background: "#F8FAFC" }}>
      <div className="absolute top-0 left-0 right-0 h-[0.5vh]" style={{ background: "#0F766E" }} />

      <div className="px-[7vw] pt-[7vh] flex-1 flex flex-col">
        <div className="mb-[5vh]">
          <div className="text-[1.6vw] font-bold uppercase tracking-widest mb-[1.5vh]" style={{ color: "#0F766E" }}>
            Agenda
          </div>
          <div className="text-[2.8vw] font-bold" style={{ color: "#1E293B" }}>
            Four topics in 30 minutes
          </div>
          <div className="h-[0.25vh] w-[8vw] mt-[2vh]" style={{ background: "#0F766E" }} />
        </div>

        <div className="flex flex-col gap-[4vh]">
          <div className="flex items-start gap-[3vw]">
            <div className="text-[3.5vw] font-bold w-[4vw] shrink-0 mt-[0.2vh]" style={{ color: "#0F766E" }}>
              01
            </div>
            <div>
              <div className="text-[2.4vw] font-bold mb-[0.5vh]" style={{ color: "#1E293B" }}>
                Executive Summary
              </div>
              <div className="text-[1.9vw]" style={{ color: "#64748B" }}>
                Key Q2 outcomes at a glance
              </div>
            </div>
          </div>

          <div className="flex items-start gap-[3vw]">
            <div className="text-[3.5vw] font-bold w-[4vw] shrink-0 mt-[0.2vh]" style={{ color: "#0F766E" }}>
              02
            </div>
            <div>
              <div className="text-[2.4vw] font-bold mb-[0.5vh]" style={{ color: "#1E293B" }}>
                Key Metrics &amp; Growth
              </div>
              <div className="text-[1.9vw]" style={{ color: "#64748B" }}>
                ARR, MAU, NRR, and KPI scorecard
              </div>
            </div>
          </div>

          <div className="flex items-start gap-[3vw]">
            <div className="text-[3.5vw] font-bold w-[4vw] shrink-0 mt-[0.2vh]" style={{ color: "#0F766E" }}>
              03
            </div>
            <div>
              <div className="text-[2.4vw] font-bold mb-[0.5vh]" style={{ color: "#1E293B" }}>
                Product Highlights
              </div>
              <div className="text-[1.9vw]" style={{ color: "#64748B" }}>
                Features shipped, adoption, and challenges
              </div>
            </div>
          </div>

          <div className="flex items-start gap-[3vw]">
            <div className="text-[3.5vw] font-bold w-[4vw] shrink-0 mt-[0.2vh]" style={{ color: "#0F766E" }}>
              04
            </div>
            <div>
              <div className="text-[2.4vw] font-bold mb-[0.5vh]" style={{ color: "#1E293B" }}>
                Roadmap &amp; Next Steps
              </div>
              <div className="text-[1.9vw]" style={{ color: "#64748B" }}>
                Q3-Q4 priorities and decisions required
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[2.5vh] right-[5vw] text-[1.4vw]" style={{ color: "#94A3B8" }}>
        AgentHub &nbsp;&middot;&nbsp; 2
      </div>
    </div>
  );
}
