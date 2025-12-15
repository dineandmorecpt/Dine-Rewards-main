import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Users, DollarSign, TicketPercent, UserPlus, Phone, Check, Copy, ExternalLink, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const RESTAURANT_ID = "b563a4ad-6dcc-4b42-8c49-5da98fb8d6ad";

const weeklyVisitsData = [
  { name: "Mon", visits: 24 },
  { name: "Tue", visits: 35 },
  { name: "Wed", visits: 42 },
  { name: "Thu", visits: 58 },
  { name: "Fri", visits: 85 },
  { name: "Sat", visits: 110 },
  { name: "Sun", visits: 95 },
];

const weeklyRedemptionsData = [
  { name: "Mon", redemptions: 3 },
  { name: "Tue", redemptions: 5 },
  { name: "Wed", redemptions: 4 },
  { name: "Thu", redemptions: 7 },
  { name: "Fri", redemptions: 12 },
  { name: "Sat", redemptions: 18 },
  { name: "Sun", redemptions: 14 },
];

interface RestaurantStats {
  dinersLast30Days: number;
  totalSpent: number;
  vouchersRedeemed: number;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState<{phone: string; registrationLink: string; smsSent: boolean} | null>(null);

  const { data: stats, isLoading } = useQuery<RestaurantStats>({
    queryKey: ["/api/restaurants", RESTAURANT_ID, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/restaurants/${RESTAURANT_ID}/stats`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const inviteDiner = useMutation({
    mutationFn: async ({ phone }: { phone: string }) => {
      const res = await fetch(`/api/restaurants/${RESTAURANT_ID}/diners/invite`, {
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

        {/* Charts Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
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

          {/* Voucher Redemptions Chart */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-xl">Voucher Redemptions</CardTitle>
              <CardDescription>Number of vouchers redeemed per day</CardDescription>
            </CardHeader>
            <CardContent className="pl-0">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyRedemptionsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                      dataKey="redemptions" 
                      fill="hsl(var(--chart-2))" 
                      radius={[4, 4, 0, 0]} 
                      barSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
