import { useQuery } from "@tanstack/react-query";
import { DinerLayout } from "@/components/layout/diner-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt, Utensils, Calendar, Coins } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface TransactionWithRestaurant {
  id: string;
  dinerId: string;
  restaurantId: string;
  restaurantName: string;
  billId?: string;
  amountSpent: string;
  pointsEarned: number;
  transactionDate: string;
}

export default function DinerHistory() {
  const { user } = useAuth();
  const dinerId = user?.id;

  const { data: transactions = [], isLoading } = useQuery<TransactionWithRestaurant[]>({
    queryKey: ["/api/diners", dinerId, "transactions"],
    queryFn: async () => {
      const res = await fetch(`/api/diners/${dinerId}/transactions`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
    enabled: !!dinerId,
  });

  if (isLoading) {
    return (
      <DinerLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your activity...</p>
          </div>
        </div>
      </DinerLayout>
    );
  }

  return (
    <DinerLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-serif font-bold text-foreground">Activity History</h1>
          <p className="text-muted-foreground">Your complete activity log across all restaurants.</p>
        </div>

        {transactions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Receipt className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">No activity yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Visit a restaurant and start earning points!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx) => (
              <Card 
                key={tx.id} 
                className="overflow-hidden hover:shadow-md transition-shadow"
                data-testid={`activity-${tx.id}`}
              >
                <CardContent className="p-0">
                  <div className="flex items-stretch">
                    <div className="bg-primary/10 p-4 flex items-center justify-center">
                      <Utensils className="h-8 w-8 text-primary" />
                    </div>
                    <div className="flex-1 p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-foreground" data-testid={`activity-restaurant-${tx.id}`}>
                            {tx.restaurantName}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            <span data-testid={`activity-date-${tx.id}`}>
                              {new Date(tx.transactionDate).toLocaleDateString('en-ZA', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          {tx.billId && (
                            <p className="text-xs text-muted-foreground">
                              Bill Reference: {tx.billId}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">Spent</p>
                            <p className="text-lg font-bold text-foreground" data-testid={`activity-amount-${tx.id}`}>
                              R{parseFloat(tx.amountSpent).toFixed(2)}
                            </p>
                          </div>
                          <div className="h-10 w-px bg-border" />
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">Earned</p>
                            <Badge 
                              variant="secondary" 
                              className="bg-primary/10 text-primary font-bold text-base"
                              data-testid={`activity-points-${tx.id}`}
                            >
                              <Coins className="h-3.5 w-3.5 mr-1" />
                              +{tx.pointsEarned}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {transactions.length > 0 && (
          <div className="text-center text-sm text-muted-foreground pt-4">
            Showing {transactions.length} {transactions.length === 1 ? 'activity' : 'activities'}
          </div>
        )}
      </div>
    </DinerLayout>
  );
}
