"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AdminAnalyticsData } from "@/features/dashboard/server/dashboard-data"

const CHART_COLORS = ["#12c9ae", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"]
const TEAL = "#12c9ae"

function ChartCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border/80 pb-4">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  )
}

function EmptyChart({ height = 240 }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center text-sm text-muted-foreground"
      style={{ height }}
    >
      No data yet
    </div>
  )
}

export function AdminRevenueTrendChart({
  data,
}: {
  data: AdminAnalyticsData["monthlyTrend"]
}) {
  const hasData = data.some((d) => d.fees > 0)

  return (
    <ChartCard
      title="Platform fee revenue"
      description="Fees collected from transactions — last 12 months"
    >
      {hasData ? (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="feesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={TEAL} stopOpacity={0.18} />
                <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `€${v}`}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v) => [`€${Number(v).toLocaleString()}`, "Fees collected"]}
            />
            <Area
              type="monotone"
              dataKey="fees"
              stroke={TEAL}
              strokeWidth={2}
              fill="url(#feesGrad)"
              dot={false}
              activeDot={{ r: 4, fill: TEAL }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  )
}

export function AdminTransactionVolumeTrendChart({
  data,
}: {
  data: AdminAnalyticsData["monthlyTrend"]
}) {
  const hasData = data.some((d) => d.volume > 0)

  return (
    <ChartCard
      title="Transaction volume"
      description="Total payment volume processed — last 12 months"
    >
      {hasData ? (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `€${v}`}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v) => [`€${Number(v).toLocaleString()}`, "Volume"]}
            />
            <Area
              type="monotone"
              dataKey="volume"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#volGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#3b82f6" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  )
}

export function AdminSubscriptionTrendChart({
  data,
}: {
  data: AdminAnalyticsData["monthlyTrend"]
}) {
  const hasData = data.some((d) => d.newSubs > 0)

  return (
    <ChartCard
      title="New subscriptions per month"
      description="Sign-ups over the last 12 months"
    >
      {hasData ? (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={32}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v) => [Number(v), "New subscriptions"]}
            />
            <Bar
              dataKey="newSubs"
              fill={TEAL}
              radius={[4, 4, 0, 0]}
              name="New subscriptions"
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  )
}

export function AdminPlanDistributionChart({
  data,
}: {
  data: AdminAnalyticsData["planBreakdown"]
}) {
  const chartData = data
    .filter((p) => p.totalCount > 0)
    .map((p) => ({ name: p.planName, value: p.totalCount }))

  return (
    <ChartCard
      title="Subscribers by plan"
      description="Active and trialing subscriptions per plan"
    >
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={98}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v, name) => [Number(v), String(name)]}
            />
            <Legend
              formatter={(value) => (
                <span style={{ fontSize: 12 }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  )
}

export function AdminBillingIntervalChart({
  data,
}: {
  data: AdminAnalyticsData["billingIntervalSplit"]
}) {
  const chartData = [
    { name: "Monthly billing", value: data.monthly },
    { name: "Annual billing", value: data.yearly },
  ].filter((d) => d.value > 0)

  return (
    <ChartCard
      title="Billing interval split"
      description="Monthly vs annual plan distribution"
    >
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={4}
              dataKey="value"
              nameKey="name"
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={i === 0 ? "#3b82f6" : TEAL} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v, name) => [Number(v), String(name)]}
            />
            <Legend
              formatter={(value) => (
                <span style={{ fontSize: 12 }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  )
}

export function AdminPlanBreakdownTable({
  data,
}: {
  data: AdminAnalyticsData["planBreakdown"]
}) {
  const allEmpty = data.every((p) => p.totalCount === 0)

  return (
    <ChartCard
      title="Revenue by plan"
      description="Estimated monthly recurring revenue per subscription plan"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 pr-4 text-left text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                Plan
              </th>
              <th className="py-2 pr-4 text-right text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                Monthly
              </th>
              <th className="py-2 pr-4 text-right text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                Annual
              </th>
              <th className="py-2 pr-4 text-right text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                Total
              </th>
              <th className="py-2 text-right text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                Est. MRR
              </th>
            </tr>
          </thead>
          <tbody>
            {allEmpty ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No active subscribers yet
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={row.planKey} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-foreground">
                    {row.planName}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                    {row.monthlyCount}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                    {row.yearlyCount}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums font-medium text-foreground">
                    {row.totalCount}
                  </td>
                  <td className="py-2.5 text-right tabular-nums font-semibold text-(--contrazy-teal)">
                    {row.estimatedMrr > 0
                      ? `€${(row.estimatedMrr / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {!allEmpty && (
            <tfoot>
              <tr className="border-t-2 border-border">
                <td className="py-2.5 pr-4 font-semibold text-foreground">Total</td>
                <td className="py-2.5 pr-4 text-right tabular-nums font-semibold text-foreground">
                  {data.reduce((s, p) => s + p.monthlyCount, 0)}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums font-semibold text-foreground">
                  {data.reduce((s, p) => s + p.yearlyCount, 0)}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums font-semibold text-foreground">
                  {data.reduce((s, p) => s + p.totalCount, 0)}
                </td>
                <td className="py-2.5 text-right tabular-nums font-bold text-(--contrazy-teal)">
                  €
                  {(
                    data.reduce((s, p) => s + p.estimatedMrr, 0) / 100
                  ).toLocaleString("en-GB", { maximumFractionDigits: 0 })}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </ChartCard>
  )
}
