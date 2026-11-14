"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { categoryLabel } from "@/lib/utils/categories";
import type { Incident } from "@/lib/types/api";

export function CategoryChart({ incidents }: { incidents: Incident[] }) {
  const counts = new Map<string, number>();
  incidents.forEach((incident) => {
    counts.set(incident.category, (counts.get(incident.category) ?? 0) + 1);
  });

  const data = Array.from(counts.entries())
    .map(([category, count]) => ({
      category,
      label: categoryLabel(category),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground">
        Category distribution appears once incidents are recorded.
      </p>
    );
  }

  return (
    <div className="h-[188px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
          barCategoryGap={10}
        >
          <CartesianGrid horizontal={false} stroke="#ecebe4" />
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={104}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#5d6964" }}
          />
          <Tooltip
            cursor={{ fill: "rgba(15,90,78,0.05)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload as { label: string; count: number };
              return (
                <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-md">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-muted-foreground">
                    {item.count} {item.count === 1 ? "incident" : "incidents"}
                  </p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="count"
            fill="#0f5a4e"
            radius={[0, 4, 4, 0]}
            barSize={12}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
