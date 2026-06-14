export default function Slide04KpiScorecard() {
  return (
    <div className="w-screen h-screen overflow-hidden relative flex flex-col" style={{ background: "#F8FAFC" }}>
      <div className="absolute top-0 left-0 right-0 h-[0.5vh]" style={{ background: "#0F766E" }} />

      <div className="px-[7vw] pt-[7vh] flex-1 flex flex-col">
        <div className="mb-[4vh]">
          <div className="text-[1.6vw] font-bold uppercase tracking-widest mb-[1.5vh]" style={{ color: "#0F766E" }}>
            KPI Scorecard
          </div>
          <div className="text-[2.6vw] font-bold leading-snug" style={{ color: "#1E293B" }}>
            Four of five KPIs beat target in Q2
          </div>
          <div className="h-[0.25vh] w-[8vw] mt-[2vh]" style={{ background: "#0F766E" }} />
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <table className="w-full border-collapse" style={{ fontSize: "1.9vw" }}>
            <thead>
              <tr style={{ background: "#E2E8F0", color: "#1E293B" }}>
                <th className="text-left px-[1.5vw] py-[1.2vh] font-bold">Metric</th>
                <th className="text-right px-[1.5vw] py-[1.2vh] font-bold">Q1 2026</th>
                <th className="text-right px-[1.5vw] py-[1.2vh] font-bold">Q2 2026</th>
                <th className="text-right px-[1.5vw] py-[1.2vh] font-bold">Q2 Target</th>
                <th className="text-right px-[1.5vw] py-[1.2vh] font-bold">vs. Target</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: "#EFF6F5", borderBottom: "1px solid #CBD5E1" }}>
                <td className="text-left px-[1.5vw] py-[1.5vh] font-bold" style={{ color: "#1E293B" }}>ARR</td>
                <td className="text-right px-[1.5vw] py-[1.5vh]" style={{ color: "#64748B" }}>$1.43M</td>
                <td className="text-right px-[1.5vw] py-[1.5vh] font-bold" style={{ color: "#1E293B" }}>$2.11M</td>
                <td className="text-right px-[1.5vw] py-[1.5vh]" style={{ color: "#64748B" }}>$1.90M</td>
                <td className="text-right px-[1.5vw] py-[1.5vh] font-bold" style={{ color: "#0F766E" }}>+11%</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                <td className="text-left px-[1.5vw] py-[1.5vh] font-bold" style={{ color: "#1E293B" }}>Monthly Active Users</td>
                <td className="text-right px-[1.5vw] py-[1.5vh]" style={{ color: "#64748B" }}>1,240</td>
                <td className="text-right px-[1.5vw] py-[1.5vh] font-bold" style={{ color: "#1E293B" }}>1,660</td>
                <td className="text-right px-[1.5vw] py-[1.5vh]" style={{ color: "#64748B" }}>1,500</td>
                <td className="text-right px-[1.5vw] py-[1.5vh] font-bold" style={{ color: "#0F766E" }}>+11%</td>
              </tr>
              <tr style={{ background: "#EFF6F5", borderBottom: "1px solid #CBD5E1" }}>
                <td className="text-left px-[1.5vw] py-[1.5vh] font-bold" style={{ color: "#1E293B" }}>Net Revenue Retention</td>
                <td className="text-right px-[1.5vw] py-[1.5vh]" style={{ color: "#64748B" }}>109%</td>
                <td className="text-right px-[1.5vw] py-[1.5vh] font-bold" style={{ color: "#1E293B" }}>118%</td>
                <td className="text-right px-[1.5vw] py-[1.5vh]" style={{ color: "#64748B" }}>110%</td>
                <td className="text-right px-[1.5vw] py-[1.5vh] font-bold" style={{ color: "#0F766E" }}>+8pp</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                <td className="text-left px-[1.5vw] py-[1.5vh] font-bold" style={{ color: "#1E293B" }}>Monthly Churn Rate</td>
                <td className="text-right px-[1.5vw] py-[1.5vh]" style={{ color: "#64748B" }}>4.2%</td>
                <td className="text-right px-[1.5vw] py-[1.5vh] font-bold" style={{ color: "#1E293B" }}>3.1%</td>
                <td className="text-right px-[1.5vw] py-[1.5vh]" style={{ color: "#64748B" }}>&lt; 4%</td>
                <td className="text-right px-[1.5vw] py-[1.5vh] font-bold" style={{ color: "#0F766E" }}>Beat</td>
              </tr>
              <tr style={{ background: "#FFF7ED", borderBottom: "1px solid #CBD5E1" }}>
                <td className="text-left px-[1.5vw] py-[1.5vh] font-bold" style={{ color: "#1E293B" }}>CSAT Score</td>
                <td className="text-right px-[1.5vw] py-[1.5vh]" style={{ color: "#64748B" }}>78%</td>
                <td className="text-right px-[1.5vw] py-[1.5vh] font-bold" style={{ color: "#1E293B" }}>82%</td>
                <td className="text-right px-[1.5vw] py-[1.5vh]" style={{ color: "#64748B" }}>80%</td>
                <td className="text-right px-[1.5vw] py-[1.5vh] font-bold" style={{ color: "#EA580C" }}>+2pp</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-[2vh] text-[1.4vw]" style={{ color: "#94A3B8" }}>
            Source: Internal finance and analytics, as of June 30, 2026. &nbsp;&nbsp;* CSAT scored by post-session survey; target raised to 85% in Q3.
          </div>
        </div>
      </div>

      <div className="absolute bottom-[2.5vh] right-[5vw] text-[1.4vw]" style={{ color: "#94A3B8" }}>
        AgentHub &nbsp;&middot;&nbsp; 4
      </div>
    </div>
  );
}
