import { AdminLayout } from "@/components/layout/admin-layout";
import { StatsCard } from "@/components/dashboard/stats-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { Users, DollarSign, TicketPercent, TrendingUp } from "lucide-react";
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip,
  CartesianGrid 
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Mock data for charts
const monthlyDinersData = [
  { value: 45 }, { value: 52 }, { value: 38 }, { value: 65 }, { value: 48 }, { value: 60 }, { value: 78 }
];

const revenueData = [
  { value: 2400 }, { value: 1398 }, { value: 9800 }, { value: 3908 }, { value: 4800 }, { value: 3800 }, { value: 4300 }
];

const voucherData = [
  { value: 12 }, { value: 15 }, { value: 8 }, { value: 24 }, { value: 18 }, { value: 10 }, { value: 28 }
];

const weeklyVisitsData = [
  { name: "Mon", visits: 24 },
  { name: "Tue", visits: 35 },
  { name: "Wed", visits: 42 },
  { name: "Thu", visits: 58 },
  { name: "Fri", visits: 85 },
  { name: "Sat", visits: 110 },
  { name: "Sun", visits: 95 },
];

export default function AdminDashboard() {
  return (
    <AdminLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Welcome back, Restaurant Admin.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="hidden sm:flex">Download Report</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              New Promotion
            </Button>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatsCard 
            title="Diners (30 Days)" 
            value="1,284" 
            icon={Users}
            trend={{ value: 12, label: "vs last month", positive: true }}
            chartData={monthlyDinersData}
            chartColor="hsl(var(--primary))"
          />
          <StatsCard 
            title="Total Revenue" 
            value="$42,593" 
            icon={DollarSign}
            trend={{ value: 8, label: "vs last month", positive: true }}
            chartData={revenueData}
            chartColor="hsl(var(--chart-1))" // Gold
          />
          <StatsCard 
            title="Vouchers Redeemed" 
            value="342" 
            icon={TicketPercent}
            trend={{ value: 2, label: "vs last month", positive: false }}
            chartData={voucherData}
            chartColor="hsl(var(--chart-4))" // Terracotta
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Chart Area */}
          <Card className="col-span-2 border-none shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-xl">Weekly Visit Trends</CardTitle>
              <CardDescription>Number of rewards diners visiting per day</CardDescription>
            </CardHeader>
            <CardContent className="pl-0">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyVisitsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        borderColor: 'hsl(var(--border))',
                        borderRadius: 'var(--radius)' 
                      }}
                    />
                    <Bar 
                      dataKey="visits" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]} 
                      barSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity Feed */}
          <div className="lg:col-span-1">
             <RecentActivity />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
