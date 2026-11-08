"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ChartDatum = { name: string; value: number };

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
  fontSize: 12,
};

export function BarChartCard({ data, label, emptyLabel, unit = "" }: { data: ChartDatum[]; label: string; emptyLabel: string; unit?: string }) {
  if (data.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <div className="h-64" role="img" aria-label={`${label}: ${data.map((d) => `${d.name} ${d.value}${unit}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" interval={0} />
          <YAxis
            allowDecimals={false}
            domain={unit === "%" ? [0, 100] : [0, "auto"]}
            tickFormatter={(value) => `${value}${unit}`}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke="var(--muted-foreground)"
          />
          <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tooltipStyle} formatter={(value) => [`${value}${unit}`, label]} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--chart-1)" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChartCard({ data, label, emptyLabel }: { data: ChartDatum[]; label: string; emptyLabel: string }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[160px_1fr]" role="img" aria-label={`${label}: ${data.map((d) => `${d.name} ${d.value}`).join(", ")}`}>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none" isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={d.name} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid gap-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} aria-hidden />
            <span className="flex-1">{d.name}</span>
            <span className="tabular-nums text-muted-foreground">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
