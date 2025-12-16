import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Users, DollarSign, TicketPercent, UserPlus, Phone, Check, Copy, ExternalLink, Loader2, CalendarIcon, Download } from "lucide-react";
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";


interface RestaurantStats {
  dinersLast30Days: number;
  totalSpent: number;
  vouchersRedeemed: number;
  totalRegisteredDiners: number;
}

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => headers.map(h => `"${row[h]}"`).join(','))
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const { restaurant } = useAuth();
  const restaurantId = restaurant?.id;
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState<{phone: string; registrationLink: string; smsSent: boolean} | null>(null);
  
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const { data: stats, isLoading } = useQuery<RestaurantStats>({
    queryKey: ["/api/restaurants", restaurantId, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/restaurants/${restaurantId}/stats`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!restaurantId,
  });

  const { data: registrationData, isLoading: isLoadingRegistrations } = useQuery<{ date: string; count: number }[]>({
    queryKey: ["/api/restaurants", restaurantId, "diner-registrations", dateRange.from?.toDateString(), dateRange.to?.toDateString()],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.from) params.set('start', format(dateRange.from, 'yyyy-MM-dd'));
      if (dateRange.to) params.set('end', format(dateRange.to, 'yyyy-MM-dd'));
      const res = await fetch(`/api/restaurants/${restaurantId}/diner-registrations?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch registrations");
      return res.json();
    },
    enabled: !!restaurantId && !!dateRange.from && !!dateRange.to,
  });

  const chartData = useMemo(() => {
    if (!registrationData) return [];
    return registrationData.map(item => {
      const [year, month, day] = item.date.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      return {
        date: format(localDate, 'MMM d'),
        registrations: item.count,
      };
    });
  }, [registrationData]);

  const { data: redemptionsByType, isLoading: isLoadingRedemptions } = useQuery<{ voucherTypeName: string; count: number }[]>({
    queryKey: ["/api/restaurants", restaurantId, "voucher-redemptions-by-type"],
    queryFn: async () => {
      const res = await fetch(`/api/restaurants/${restaurantId}/voucher-redemptions-by-type`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch redemptions by type");
      return res.json();
    },
    enabled: !!restaurantId,
  });

  const redemptionsChartData = useMemo(() => {
    if (!redemptionsByType) return [];
    return redemptionsByType.map(item => ({
      name: item.voucherTypeName,
      redemptions: item.count,
    }));
  }, [redemptionsByType]);

  const inviteDiner = useMutation({
    mutationFn: async ({ phone }: { phone: string }) => {
      const res = await fetch(`/api/restaurants/${restaurantId}/diners/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create invitation");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const fullLink = window.location.origin + data.invitation.registrationLink;
      setInviteSuccess({
        phone: data.invitation.phone,
        registrationLink: fullLink,
        smsSent: data.smsSent
      });
      setInvitePhone("");
      toast({
        title: data.smsSent ? "SMS Sent!" : "Invitation Created!",
        description: data.smsSent 
          ? `Registration link sent via SMS to ${data.invitation.phone}` 
          : "Share the registration link with the customer."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Invitation",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Link copied to clipboard."
      });
    } catch {
      toast({
        title: "Copy Failed",
        description: "Please copy the link manually.",
        variant: "destructive"
      });
    }
  };

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
        {/* Prominent Invite CTA at the top */}
        <Card className="border-2 border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-blue-500/10 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2 bg-primary/20 rounded-full">
                <UserPlus className="h-6 w-6 text-primary" />
              </div>
              Invite New Customer
            </CardTitle>
            <CardDescription className="text-base">
              Grow your rewards program! Enter a phone number to create a registration link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 max-w-2xl">
              <div className="flex-1 space-y-2">
                <Label htmlFor="invite-phone" className="flex items-center gap-2 text-sm font-medium">
                  <Phone className="h-4 w-4" />
                  Customer Phone Number
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="invite-phone"
                    placeholder="e.g., 0821234567"
                    value={invitePhone}
                    onChange={(e) => {
                      setInvitePhone(e.target.value);
                      setInviteSuccess(null);
                    }}
                    className="font-mono text-lg h-12"
                    data-testid="input-invite-phone"
                  />
                  <Button
                    onClick={() => inviteDiner.mutate({ phone: invitePhone })}
                    disabled={!invitePhone.trim() || inviteDiner.isPending}
                    className="gap-2 h-12 px-6 text-base"
                    size="lg"
                    data-testid="button-invite-diner"
                  >
                    {inviteDiner.isPending ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-5 w-5" />
                        Invite
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {inviteSuccess && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800 max-w-2xl">
                <p className="text-sm text-green-700 dark:text-green-400 font-medium flex items-center gap-2 mb-3">
                  <Check className="h-4 w-4" />
                  {inviteSuccess.smsSent 
                    ? `SMS sent to ${inviteSuccess.phone}` 
                    : `Invitation created for ${inviteSuccess.phone}`}
                </p>
                {inviteSuccess.smsSent && (
                  <p className="text-sm text-green-600 dark:text-green-400 mb-3">
                    The customer will receive an SMS with the registration link.
                  </p>
                )}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    {inviteSuccess.smsSent ? "Registration Link (also sent via SMS)" : "Registration Link"}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={inviteSuccess.registrationLink}
                      readOnly
                      className="font-mono text-xs bg-muted"
                      data-testid="input-registration-link"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(inviteSuccess.registrationLink)}
                      data-testid="button-copy-link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(inviteSuccess.registrationLink, '_blank')}
                      data-testid="button-open-link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {inviteSuccess.smsSent 
                      ? "Link expires in 7 days." 
                      : "Share this link with the customer. It expires in 7 days."}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Welcome back, Restaurant Admin.</p>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard 
            title="Total Registered Diners" 
            value={stats?.totalRegisteredDiners || 0}
            icon={Users}
            description="All rewards members"
          />
          <StatsCard 
            title="Active Diners (30 Days)" 
            value={stats?.dinersLast30Days || 0}
            icon={UserPlus}
            trend={{ value: 12, label: "vs last month", positive: true }}
          />
          <StatsCard 
            title="Total Revenue" 
            value={new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(stats?.totalSpent || 0)}
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

        {/* Diner Registrations Chart - Full Width */}
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="font-serif text-xl">Diner Registrations</CardTitle>
              <CardDescription>New registered diners over time</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadCSV(chartData.map(d => ({ Date: d.date, Registrations: d.registrations })), 'diner-registrations.csv')}
                disabled={chartData.length === 0}
                data-testid="button-export-registrations"
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 text-sm"
                  data-testid="button-date-range"
                >
                  <CalendarIcon className="h-4 w-4" />
                  {dateRange.from && dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
                    </>
                  ) : (
                    "Select date range"
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl w-full p-0">
                <div className="p-6 flex flex-col items-center">
                  <DialogHeader className="mb-4 text-center w-full">
                    <DialogTitle className="text-center">Select Date Range</DialogTitle>
                  </DialogHeader>
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => range && setDateRange(range)}
                    numberOfMonths={2}
                    showOutsideDays
                    className="mx-auto mb-6"
                    classNames={{
                      root: "relative",
                      months: "flex flex-col sm:flex-row gap-8 justify-center",
                      month: "space-y-4",
                      month_caption: "flex justify-center items-center h-10 mb-2",
                      caption_label: "text-lg font-medium",
                      nav: "absolute inset-y-0 inset-x-0 flex items-center justify-between z-10 pointer-events-none",
                      button_previous: "h-10 w-10 bg-background p-0 opacity-70 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input hover:bg-accent shadow-sm pointer-events-auto -ml-4",
                      button_next: "h-10 w-10 bg-background p-0 opacity-70 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input hover:bg-accent shadow-sm pointer-events-auto -mr-4",
                      weekdays: "flex",
                      weekday: "text-muted-foreground text-center text-sm font-normal py-2 w-10",
                      week: "flex mt-1",
                      day: "w-10 h-10 text-center relative p-0 focus-within:relative focus-within:z-20",
                      today: "bg-blue-500 text-white rounded-full",
                      outside: "text-muted-foreground opacity-50",
                      disabled: "text-muted-foreground opacity-50",
                      range_middle: "bg-accent text-accent-foreground rounded-none",
                      range_start: "bg-primary text-primary-foreground rounded-l-md",
                      range_end: "bg-primary text-primary-foreground rounded-r-md",
                      hidden: "invisible",
                    }}
                    data-testid="calendar-date-range"
                  />
                  <div className="flex gap-3 w-full justify-center border-t pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}
                      data-testid="button-7-days"
                    >
                      Last 7 days
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}
                      data-testid="button-30-days"
                    >
                      Last 30 days
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDateRange({ from: subDays(new Date(), 90), to: new Date() })}
                      data-testid="button-90-days"
                    >
                      Last 90 days
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </CardHeader>
          <CardContent className="pl-0">
            {isLoadingRegistrations ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No registration data for this period
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="registrationGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                      dy={10}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        borderColor: 'hsl(var(--border))',
                        borderRadius: 'var(--radius)' 
                      }}
                      formatter={(value) => [`${value} registrations`, 'Registrations']}
                    />
                    <Area 
                      type="monotone"
                      dataKey="registrations" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fill="url(#registrationGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charts Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Voucher Redemptions by Type Chart */}
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="font-serif text-xl">Voucher Redemptions by Type</CardTitle>
                <CardDescription>Number of vouchers redeemed per voucher type</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadCSV(redemptionsChartData.map(d => ({ 'Voucher Type': d.name, Redemptions: d.redemptions })), 'voucher-redemptions-by-type.csv')}
                disabled={redemptionsChartData.length === 0}
                data-testid="button-export-redemptions"
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </CardHeader>
            <CardContent className="pl-0">
              {isLoadingRedemptions ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : redemptionsChartData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No voucher redemptions yet
                </div>
              ) : (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={redemptionsChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                        dy={10}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        allowDecimals={false}
                      />
                      <Tooltip 
                        cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--popover))', 
                          borderColor: 'hsl(var(--border))',
                          borderRadius: 'var(--radius)' 
                        }}
                        formatter={(value) => [`${value} redeemed`, 'Redemptions']}
                      />
                      <Bar 
                        dataKey="redemptions" 
                        fill="hsl(var(--chart-2))" 
                        radius={[4, 4, 0, 0]} 
                        barSize={50}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
