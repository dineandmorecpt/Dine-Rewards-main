import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getAuthHeaders } from "@/lib/queryClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  Users,
  DollarSign,
  FileCheck,
  AlertTriangle,
  BarChart3,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function AdminInsights() {
  const { restaurant } = useAuth();

  const { data: insights, isLoading } = useQuery({
    queryKey: ["reconciliation-insights", restaurant?.id],
    queryFn: async () => {
      const res = await fetch("/api/admin/reconciliation/insights", {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch insights");
      return res.json();
    },
    enabled: !!restaurant?.id,
  });

  const formatCurrency = (val: number) => `R${val.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Insights</h1>
            <p className="text-muted-foreground mt-1">Loading reconciliation insights...</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-1/2 mb-3" />
                  <div className="h-8 bg-muted rounded w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!insights || insights.totalBatches === 0) {
    return (
      <AdminLayout>
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Insights</h1>
            <p className="text-muted-foreground mt-1">Diner analytics based on reconciled POS data.</p>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Reconciliation Data Yet</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Upload CSV files from your POS system on the Reconciliation page to start seeing diner insights and spending patterns.
              </p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  const varianceIcon = insights.totalVariance > 0
    ? <ArrowUpRight className="h-4 w-4 text-amber-500" />
    : insights.totalVariance < 0
      ? <ArrowDownRight className="h-4 w-4 text-red-500" />
      : <Minus className="h-4 w-4 text-green-500" />;

  const varianceColor = insights.totalVariance > 0
    ? "text-amber-600"
    : insights.totalVariance < 0
      ? "text-red-600"
      : "text-green-600";

  return (
    <AdminLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground" data-testid="text-insights-title">Insights</h1>
          <p className="text-muted-foreground mt-1">
            Diner analytics based on reconciled POS data across {insights.totalBatches} upload{insights.totalBatches !== 1 ? 's' : ''}.
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-matched-records">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Matched Records</span>
                <FileCheck className="h-5 w-5 text-green-500" />
              </div>
              <p className="text-3xl font-bold">{insights.totalMatchedRecords}</p>
              <p className="text-xs text-muted-foreground mt-1">
                <Badge variant="secondary" className="text-xs">{insights.matchRate}% match rate</Badge>
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-reconciled-revenue">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Reconciled Revenue</span>
                <DollarSign className="h-5 w-5 text-blue-500" />
              </div>
              <p className="text-3xl font-bold">{formatCurrency(insights.totalRecordedRevenue)}</p>
              <p className="text-xs text-muted-foreground mt-1">From matched transactions</p>
            </CardContent>
          </Card>

          <Card data-testid="card-unique-diners">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Unique Diners</span>
                <Users className="h-5 w-5 text-purple-500" />
              </div>
              <p className="text-3xl font-bold">{insights.uniqueDiners}</p>
              <p className="text-xs text-muted-foreground mt-1">Across all reconciled data</p>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-transaction">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Avg Transaction</span>
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-3xl font-bold">{formatCurrency(insights.averageTransactionValue)}</p>
              <p className="text-xs text-muted-foreground mt-1">Per matched record</p>
            </CardContent>
          </Card>
        </div>

        {/* Variance & POS Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card data-testid="card-pos-revenue">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">POS Revenue (CSV)</span>
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <p className="text-2xl font-bold">{formatCurrency(insights.totalCSVRevenue)}</p>
            </CardContent>
          </Card>

          <Card data-testid="card-recorded-revenue">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Recorded Revenue</span>
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold">{formatCurrency(insights.totalRecordedRevenue)}</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-variance">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Total Variance</span>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex items-center gap-2">
                {varianceIcon}
                <p className={`text-2xl font-bold ${varianceColor}`}>
                  {formatCurrency(Math.abs(insights.totalVariance))}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {insights.totalVariance > 0 ? "POS shows more than recorded" : insights.totalVariance < 0 ? "POS shows less than recorded" : "POS and recorded amounts match"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Top Spenders - Full Width */}
        <Card data-testid="card-top-diners">
          <CardHeader>
            <CardTitle className="text-lg">Top 5 Spenders</CardTitle>
            <CardDescription>Highest spending diners from reconciled data</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.topDiners.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={insights.topDiners.slice(0, 5)} margin={{ left: 10, right: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v: number) => `R${v}`} className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Total Spent"]}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  />
                  <Bar dataKey="totalSpent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No diner data available</p>
            )}
          </CardContent>
        </Card>

        {/* Charts Row: Variance & Revenue */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="card-variance-distribution">
            <CardHeader>
              <CardTitle className="text-lg">Variance Distribution</CardTitle>
              <CardDescription>How POS amounts compare to recorded amounts</CardDescription>
            </CardHeader>
            <CardContent>
              {insights.varianceDistribution.some((d: any) => d.count > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={insights.varianceDistribution.filter((d: any) => d.count > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="count"
                      nameKey="range"
                      label={({ range, count }: any) => `${range}: ${count}`}
                      labelLine={false}
                    >
                      {insights.varianceDistribution.filter((d: any) => d.count > 0).map((_: any, index: number) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No variance data available</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-revenue-by-date">
            <CardHeader>
              <CardTitle className="text-lg">Revenue by Date</CardTitle>
              <CardDescription>Recorded vs POS revenue per transaction date</CardDescription>
            </CardHeader>
            <CardContent>
              {insights.revenueByDate.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={insights.revenueByDate} margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v: number) => `R${v}`} className="text-xs" />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatCurrency(value), name === "recorded" ? "Recorded" : "POS (CSV)"]}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    />
                    <Bar dataKey="recorded" fill="hsl(var(--primary))" name="Recorded" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="csv" fill="#3b82f6" name="POS (CSV)" radius={[4, 4, 0, 0]} />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No date-based data available</p>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Visit Frequency - Full Width */}
        <Card data-testid="card-visit-frequency">
          <CardHeader>
            <CardTitle className="text-lg">Visit Frequency</CardTitle>
            <CardDescription>Number of reconciled transactions per diner</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.transactionsByDiner.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={insights.transactionsByDiner.slice(0, 5)} margin={{ left: 10, right: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(value: number, name: string) => [name === "transactionCount" ? value : formatCurrency(value), name === "transactionCount" ? "Visits" : "Total Spent"]}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  />
                  <Bar dataKey="transactionCount" fill="#8b5cf6" name="Visits" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No visit data available</p>
            )}
          </CardContent>
        </Card>

        {/* Batch History Table */}
        <Card data-testid="card-batch-history">
          <CardHeader>
            <CardTitle className="text-lg">Upload History</CardTitle>
            <CardDescription>Summary of all reconciliation batches</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">File Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Upload Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Matched</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Match Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {insights.batchSummaries.map((batch: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{batch.fileName}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {batch.uploadedAt ? new Date(batch.uploadedAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{batch.total}</td>
                      <td className="px-4 py-3 text-sm text-right">{batch.matched}</td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant={batch.matchRate >= 80 ? "default" : batch.matchRate >= 50 ? "secondary" : "destructive"} className="text-xs">
                          {batch.matchRate}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
