export default function Slide01Title() {
  return (
    <div className="w-screen h-screen overflow-hidden relative flex flex-col justify-center" style={{ background: "#0F172A" }}>
      <div className="absolute top-0 left-0 right-0 h-[0.5vh]" style={{ background: "#0F766E" }} />

      <div className="px-[8vw]">
        <div className="text-[1.6vw] font-bold tracking-widest uppercase mb-[3vh]" style={{ color: "#0F766E" }}>
          Q2 2026
        </div>

        <div className="text-[6.5vw] font-bold leading-none tracking-tight mb-[2.5vh]" style={{ color: "#F1F5F9", textWrap: "balance" }}>
          Product Review
        </div>

        <div className="text-[2.4vw] font-bold mb-[1vh]" style={{ color: "#94A3B8" }}>
          AgentHub — AI Agent Management Platform
        </div>

        <div className="h-[0.3vh] w-[12vw] mt-[4vh] mb-[3vh]" style={{ background: "#0F766E" }} />

        <div className="text-[1.8vw] font-bold" style={{ color: "#64748B" }}>
          June 2026 &nbsp;&middot;&nbsp; Confidential
        </div>
      </div>

      <div className="absolute bottom-[3vh] right-[5vw] text-[1.4vw]" style={{ color: "#334155" }}>
        AgentHub &nbsp;&middot;&nbsp; 1
      </div>
    </div>
  );
}
