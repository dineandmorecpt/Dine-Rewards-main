import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Users, DollarSign, TicketPercent } from "lucide-react";
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

// Hardcoded restaurant ID from seed data (The Burger Joint)
const RESTAURANT_ID = "b563a4ad-6dcc-4b42-8c49-5da98fb8d6ad";

// Mock data for weekly trends (would come from backend in real app)
const weeklyVisitsData = [
  { name: "Mon", visits: 24 },
  { name: "Tue", visits: 35 },
  { name: "Wed", visits: 42 },
  { name: "Thu", visits: 58 },
  { name: "Fri", visits: 85 },
  { name: "Sat", visits: 110 },
  { name: "Sun", visits: 95 },
];

interface RestaurantStats {
  dinersLast30Days: number;
  totalSpent: number;
  vouchersRedeemed: number;
}

export default function AdminDashboard() {
  // Fetch restaurant stats from API
  const { data: stats, isLoading } = useQuery<RestaurantStats>({
    queryKey: ["/api/restaurants", RESTAURANT_ID, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/restaurants/${RESTAURANT_ID}/stats`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

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
            value={stats?.dinersLast30Days || 0}
            icon={Users}
            trend={{ value: 12, label: "vs last month", positive: true }}
          />
          <StatsCard 
            title="Total Revenue" 
            value={`R${stats?.totalSpent?.toFixed(2) || "0.00"}`}
            icon={DollarSign}
            trend={{ value: 8, label: "vs last month", positive: true }}
          />
          <StatsCard 
            title="Vouchers Redeemed" 
            value={stats?.vouchersRedeemed || 0}
            icon={TicketPercent}
            description="In last 30 days"
          />
        </div>

        {/* Weekly Trends Chart */}
        <Card className="border-none shadow-sm">
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
      </div>
    </AdminLayout>
  );
}
