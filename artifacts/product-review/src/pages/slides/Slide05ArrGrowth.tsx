import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

const data = [
  { month: "Jan", arr: 0.62 },
  { month: "Feb", arr: 0.88 },
  { month: "Mar", arr: 1.43 },
  { month: "Apr", arr: 1.65 },
  { month: "May", arr: 1.87 },
  { month: "Jun", arr: 2.11 },
];

export default function Slide05ArrGrowth() {
  return (
    <div className="w-screen h-screen overflow-hidden relative flex flex-col" style={{ background: "#F8FAFC" }}>
      <div className="absolute top-0 left-0 right-0 h-[0.5vh]" style={{ background: "#0F766E" }} />

      <div className="px-[7vw] pt-[7vh] pb-[7vh] flex-1 flex flex-col">
        <div className="mb-[3.5vh]">
          <div className="text-[1.6vw] font-bold uppercase tracking-widest mb-[1.5vh]" style={{ color: "#0F766E" }}>
            ARR Growth
          </div>
          <div className="text-[2.6vw] font-bold leading-snug" style={{ color: "#1E293B", textWrap: "balance" }}>
            ARR reached $2.11M in Q2, up 47% from the prior quarter
          </div>
          <div className="h-[0.25vh] w-[8vw] mt-[2vh]" style={{ background: "#0F766E" }} />
        </div>

        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 40, left: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "#64748B", fontSize: "1.5vw", fontFamily: "Source Sans 3" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `$${v}M`}
                tick={{ fill: "#64748B", fontSize: "1.5vw", fontFamily: "Source Sans 3" }}
                axisLine={false}
                tickLine={false}
                domain={[0, 2.5]}
                ticks={[0, 0.5, 1.0, 1.5, 2.0, 2.5]}
              />
              <Tooltip
                formatter={(value: number) => [`$${value}M`, "ARR"]}
                labelStyle={{ color: "#1E293B", fontWeight: 700 }}
                contentStyle={{ border: "1px solid #E2E8F0", borderRadius: 4, fontSize: "1.4vw" }}
              />
              <ReferenceLine y={1.9} stroke="#94A3B8" strokeDasharray="6 3" label={{ value: "Target $1.90M", fill: "#94A3B8", fontSize: "1.4vw", position: "insideTopRight" }} />
              <Line
                type="monotone"
                dataKey="arr"
                stroke="#0F766E"
                strokeWidth={3}
                dot={{ r: 6, fill: "#0F766E", strokeWidth: 2, stroke: "#F8FAFC" }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-[1.5vh] text-[1.4vw]" style={{ color: "#94A3B8" }}>
          Source: Internal finance system, as of June 30, 2026. ARR = Annualized MRR.
        </div>
      </div>

      <div className="absolute bottom-[2.5vh] right-[5vw] text-[1.4vw]" style={{ color: "#94A3B8" }}>
        AgentHub &nbsp;&middot;&nbsp; 5
      </div>
    </div>
  );
}
