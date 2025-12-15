import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Activity, Clock, User, Settings, Ticket, Users, Loader2 } from "lucide-react";
import { format } from "date-fns";

const RESTAURANT_ID = "b563a4ad-6dcc-4b42-8c49-5da98fb8d6ad";

const actionLabels: Record<string, { label: string; color: string; icon: typeof Activity }> = {
  voucher_redeemed: { label: "Voucher Redeemed", color: "bg-green-100 text-green-800", icon: Ticket },
  settings_updated: { label: "Settings Updated", color: "bg-blue-100 text-blue-800", icon: Settings },
  voucher_type_created: { label: "Voucher Type Created", color: "bg-purple-100 text-purple-800", icon: Ticket },
  voucher_type_updated: { label: "Voucher Type Updated", color: "bg-yellow-100 text-yellow-800", icon: Ticket },
  voucher_type_deleted: { label: "Voucher Type Deleted", color: "bg-red-100 text-red-800", icon: Ticket },
  portal_user_added: { label: "Team Member Added", color: "bg-indigo-100 text-indigo-800", icon: Users },
  portal_user_removed: { label: "Team Member Removed", color: "bg-orange-100 text-orange-800", icon: Users },
};

export default function AdminActivityLogs() {
  const activityLogs = useQuery({
    queryKey: ['activity-logs', RESTAURANT_ID],
    queryFn: async () => {
      const res = await fetch(`/api/restaurants/${RESTAURANT_ID}/activity-logs?limit=100`);
      if (!res.ok) throw new Error('Failed to fetch activity logs');
      return res.json();
    }
  });

  const formatDetails = (action: string, details: string | null) => {
    if (!details) return null;
    try {
      const parsed = JSON.parse(details);
      switch (action) {
        case 'voucher_redeemed':
          return `Code: ${parsed.code}${parsed.billId ? `, Bill: ${parsed.billId}` : ''}`;
        case 'settings_updated':
          return Object.entries(parsed).map(([key, value]) => `${key}: ${value}`).join(', ');
        case 'voucher_type_created':
        case 'voucher_type_deleted':
          return parsed.name ? `"${parsed.name}"` : null;
        case 'voucher_type_updated':
          return parsed.changes ? Object.keys(parsed.changes).join(', ') + ' changed' : null;
        case 'portal_user_added':
          return `${parsed.email} (${parsed.role})`;
        default:
          return null;
      }
    } catch {
      return null;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Activity Logs</h1>
          <p className="text-muted-foreground mt-1">View recent actions and changes in your restaurant</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>All important actions are logged here for transparency</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLogs.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : activityLogs.data?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No activity recorded yet</p>
                <p className="text-sm">Actions like voucher redemptions and settings changes will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activityLogs.data?.map((log: any) => {
                  const actionInfo = actionLabels[log.action] || { 
                    label: log.action, 
                    color: "bg-gray-100 text-gray-800", 
                    icon: Activity 
                  };
                  const Icon = actionInfo.icon;
                  const details = formatDetails(log.action, log.details);
                  
                  return (
                    <div 
                      key={log.id} 
                      className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                      data-testid={`activity-log-${log.id}`}
                    >
                      <div className={`p-2 rounded-full ${actionInfo.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className={actionInfo.color}>
                            {actionInfo.label}
                          </Badge>
                          {details && (
                            <span className="text-sm text-muted-foreground truncate">
                              {details}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                          {log.user && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {log.user.name || log.user.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
