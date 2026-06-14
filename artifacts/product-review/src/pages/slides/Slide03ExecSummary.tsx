export default function Slide03ExecSummary() {
  return (
    <div className="w-screen h-screen overflow-hidden relative flex flex-col" style={{ background: "#F8FAFC" }}>
      <div className="absolute top-0 left-0 right-0 h-[0.5vh]" style={{ background: "#0F766E" }} />

      <div className="px-[7vw] pt-[7vh] flex-1 flex flex-col">
        <div className="mb-[5vh]">
          <div className="text-[1.6vw] font-bold uppercase tracking-widest mb-[1.5vh]" style={{ color: "#0F766E" }}>
            Executive Summary
          </div>
          <div className="text-[2.6vw] font-bold leading-snug" style={{ color: "#1E293B", textWrap: "balance" }}>
            Q2 results confirm the growth trajectory projected in Q1
          </div>
          <div className="h-[0.25vh] w-[8vw] mt-[2vh]" style={{ background: "#0F766E" }} />
        </div>

        <div className="flex flex-col gap-[3.5vh]">
          <div className="flex items-start gap-[2.5vw]">
            <div className="w-[0.5vw] shrink-0 mt-[0.5vh] rounded-full" style={{ background: "#0F766E", height: "2.8vh" }} />
            <div className="text-[2.1vw] leading-snug" style={{ color: "#1E293B" }}>
              ARR reached <strong>$2.11M</strong> in Q2, up <strong>47%</strong> from $1.43M in Q1, exceeding the $1.90M target by 11%.
            </div>
          </div>

          <div className="flex items-start gap-[2.5vw]">
            <div className="w-[0.5vw] shrink-0 mt-[0.5vh] rounded-full" style={{ background: "#0F766E", height: "2.8vh" }} />
            <div className="text-[2.1vw] leading-snug" style={{ color: "#1E293B" }}>
              Monthly active users grew <strong>34%</strong> to 1,660; net revenue retention stands at <strong>118%</strong>, confirming expansion outpaces churn.
            </div>
          </div>

          <div className="flex items-start gap-[2.5vw]">
            <div className="w-[0.5vw] shrink-0 mt-[0.5vh] rounded-full" style={{ background: "#0F766E", height: "2.8vh" }} />
            <div className="text-[2.1vw] leading-snug" style={{ color: "#1E293B" }}>
              Three major product features shipped on schedule in Q2; two integration items were scoped and deferred to Q3 with defined milestones.
            </div>
          </div>

          <div className="flex items-start gap-[2.5vw]">
            <div className="w-[0.5vw] shrink-0 mt-[0.5vh] rounded-full" style={{ background: "#0F766E", height: "2.8vh" }} />
            <div className="text-[2.1vw] leading-snug" style={{ color: "#1E293B" }}>
              Q3 priorities are the mobile companion app, global search, and enterprise tier launch — three decisions from this review are required to proceed.
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[2.5vh] right-[5vw] text-[1.4vw]" style={{ color: "#94A3B8" }}>
        AgentHub &nbsp;&middot;&nbsp; 3
      </div>
    </div>
  );
}
