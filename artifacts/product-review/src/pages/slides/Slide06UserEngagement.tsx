import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { month: "Jan", mau: 720 },
  { month: "Feb", mau: 850 },
  { month: "Mar", mau: 1240 },
  { month: "Apr", mau: 1380 },
  { month: "May", mau: 1510 },
  { month: "Jun", mau: 1660 },
];

export default function Slide06UserEngagement() {
  return (
    <div className="w-screen h-screen overflow-hidden relative flex flex-col" style={{ background: "#F8FAFC" }}>
      <div className="absolute top-0 left-0 right-0 h-[0.5vh]" style={{ background: "#0F766E" }} />

      <div className="px-[7vw] pt-[7vh] pb-[7vh] flex-1 flex flex-col">
        <div className="mb-[3.5vh]">
          <div className="text-[1.6vw] font-bold uppercase tracking-widest mb-[1.5vh]" style={{ color: "#0F766E" }}>
            User Engagement
          </div>
          <div className="text-[2.6vw] font-bold leading-snug" style={{ color: "#1E293B", textWrap: "balance" }}>
            Monthly active users reached 1,660 in June, up 34% from Q1
          </div>
          <div className="h-[0.25vh] w-[8vw] mt-[2vh]" style={{ background: "#0F766E" }} />
        </div>

        <div className="flex gap-[5vw] flex-1">
          <div style={{ flex: "0 0 68%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#64748B", fontSize: "1.5vw", fontFamily: "Source Sans 3" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#64748B", fontSize: "1.5vw", fontFamily: "Source Sans 3" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v.toLocaleString()}
                />
                <Tooltip
                  formatter={(value: number) => [value.toLocaleString(), "MAU"]}
                  labelStyle={{ color: "#1E293B", fontWeight: 700 }}
                  contentStyle={{ border: "1px solid #E2E8F0", borderRadius: 4, fontSize: "1.4vw" }}
                />
                <Bar dataKey="mau" fill="#0F766E" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col justify-center gap-[4vh]" style={{ flex: "0 0 27%" }}>
            <div>
              <div className="text-[5vw] font-bold leading-none mb-[0.8vh]" style={{ color: "#0F766E" }}>
                34%
              </div>
              <div className="text-[1.8vw] font-bold mb-[0.3vh]" style={{ color: "#1E293B" }}>
                MAU Growth
              </div>
              <div className="text-[1.6vw]" style={{ color: "#64748B" }}>
                Q1 to Q2
              </div>
            </div>

            <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "3vh" }}>
              <div className="text-[5vw] font-bold leading-none mb-[0.8vh]" style={{ color: "#1E293B" }}>
                18 min
              </div>
              <div className="text-[1.8vw] font-bold mb-[0.3vh]" style={{ color: "#1E293B" }}>
                Avg. Session
              </div>
              <div className="text-[1.6vw]" style={{ color: "#64748B" }}>
                Up from 12 min in Q1
              </div>
            </div>
          </div>
        </div>

        <div className="mt-[1.5vh] text-[1.4vw]" style={{ color: "#94A3B8" }}>
          Source: Internal analytics, as of June 30, 2026. MAU = users active in a calendar month.
        </div>
      </div>

      <div className="absolute bottom-[2.5vh] right-[5vw] text-[1.4vw]" style={{ color: "#94A3B8" }}>
        AgentHub &nbsp;&middot;&nbsp; 6
      </div>
    </div>
  );
}
