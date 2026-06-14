import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

const data = [
  { month: "Jan", nrr: 104 },
  { month: "Feb", nrr: 106 },
  { month: "Mar", nrr: 109 },
  { month: "Apr", nrr: 112 },
  { month: "May", nrr: 115 },
  { month: "Jun", nrr: 118 },
];

export default function Slide07Nrr() {
  return (
    <div className="w-screen h-screen overflow-hidden relative flex flex-col" style={{ background: "#F8FAFC" }}>
      <div className="absolute top-0 left-0 right-0 h-[0.5vh]" style={{ background: "#0F766E" }} />

      <div className="px-[7vw] pt-[7vh] pb-[7vh] flex-1 flex flex-col">
        <div className="mb-[3.5vh]">
          <div className="text-[1.6vw] font-bold uppercase tracking-widest mb-[1.5vh]" style={{ color: "#0F766E" }}>
            Net Revenue Retention
          </div>
          <div className="text-[2.6vw] font-bold leading-snug" style={{ color: "#1E293B", textWrap: "balance" }}>
            NRR of 118% confirms customers are expanding, not churning
          </div>
          <div className="h-[0.25vh] w-[8vw] mt-[2vh]" style={{ background: "#0F766E" }} />
        </div>

        <div className="flex gap-[5vw] flex-1">
          <div className="flex flex-col justify-center" style={{ flex: "0 0 28%" }}>
            <div className="text-[9vw] font-bold leading-none mb-[1vh]" style={{ color: "#0F766E" }}>
              118%
            </div>
            <div className="text-[1.9vw] font-bold mb-[1vh]" style={{ color: "#1E293B" }}>
              Q2 2026 NRR
            </div>
            <div className="text-[1.7vw] leading-relaxed" style={{ color: "#64748B" }}>
              For every $1,000 of ARR at the start of the period, clients returned $1,180 by end of Q2.
            </div>
            <div className="mt-[3vh] text-[1.7vw] leading-relaxed" style={{ color: "#64748B" }}>
              Primary drivers: agent seat expansions and Telegram add-on adoption.
            </div>
          </div>

          <div style={{ flex: "0 0 67%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <defs>
                  <linearGradient id="nrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F766E" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0F766E" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#64748B", fontSize: "1.5vw", fontFamily: "Source Sans 3" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: "#64748B", fontSize: "1.5vw", fontFamily: "Source Sans 3" }}
                  axisLine={false}
                  tickLine={false}
                  domain={[95, 125]}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, "NRR"]}
                  labelStyle={{ color: "#1E293B", fontWeight: 700 }}
                  contentStyle={{ border: "1px solid #E2E8F0", borderRadius: 4, fontSize: "1.4vw" }}
                />
                <ReferenceLine y={100} stroke="#94A3B8" strokeDasharray="6 3" label={{ value: "100% (breakeven)", fill: "#94A3B8", fontSize: "1.3vw", position: "insideTopRight" }} />
                <Area
                  type="monotone"
                  dataKey="nrr"
                  stroke="#0F766E"
                  strokeWidth={3}
                  fill="url(#nrrGrad)"
                  dot={{ r: 5, fill: "#0F766E", strokeWidth: 2, stroke: "#F8FAFC" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-[1.5vh] text-[1.4vw]" style={{ color: "#94A3B8" }}>
          Source: Internal finance, as of June 30, 2026. NRR includes expansion, contraction, and churn; excludes new logo revenue.
        </div>
      </div>

      <div className="absolute bottom-[2.5vh] right-[5vw] text-[1.4vw]" style={{ color: "#94A3B8" }}>
        AgentHub &nbsp;&middot;&nbsp; 7
      </div>
    </div>
  );
}
