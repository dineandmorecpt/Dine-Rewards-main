import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DinerLayout } from "@/components/layout/diner-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Utensils, Gift, ChevronRight, Clock, AlertCircle, QrCode, Receipt } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/use-auth";

interface PointsBalance {
  id: string;
  currentPoints: number;
  totalVouchersGenerated: number;
  restaurantName: string;
  restaurantColor: string;
  restaurantId: string;
  pointsPerCurrency: number;
  pointsThreshold: number;
}

type VoucherStatus = "active" | "redeemed" | "expired";

interface Voucher {
  id: string;
  restaurantId: string;
  restaurantName: string;
  title: string;
  expiryDate: string;
  code: string;
  isRedeemed: boolean;
  status: VoucherStatus;
}

interface Transaction {
  id: string;
  amountSpent: string;
  pointsEarned: number;
  transactionDate: string;
  billId?: string;
}

export default function DinerDashboard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const dinerId = user?.id;
  const [presentCodeOpen, setPresentCodeOpen] = useState(false);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [activeVoucherTitle, setActiveVoucherTitle] = useState<string>("");
  const [codeExpiresAt, setCodeExpiresAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [selectedRestaurant, setSelectedRestaurant] = useState<PointsBalance | null>(null);
  const [transactionHistoryOpen, setTransactionHistoryOpen] = useState(false);

  useEffect(() => {
    if (!codeExpiresAt || !presentCodeOpen) return;
    
    const updateTimer = () => {
      const now = new Date();
      const diff = codeExpiresAt.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeRemaining("Expired");
        setPresentCodeOpen(false);
        toast({
          title: "Code Expired",
          description: "Your voucher code has expired. Please present it again.",
          variant: "destructive",
        });
        return;
      }
      
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [codeExpiresAt, presentCodeOpen]);

  // Fetch points balances
  const { data: balances = [], isLoading: loadingBalances } = useQuery<PointsBalance[]>({
    queryKey: ["/api/diners", dinerId, "points"],
    queryFn: async () => {
      const res = await fetch(`/api/diners/${dinerId}/points`);
      if (!res.ok) throw new Error("Failed to fetch points");
      return res.json();
    },
    enabled: !!dinerId,
  });

  // Fetch vouchers
  const { data: vouchers = [], isLoading: loadingVouchers } = useQuery<Voucher[]>({
    queryKey: ["/api/diners", dinerId, "vouchers"],
    queryFn: async () => {
      const res = await fetch(`/api/diners/${dinerId}/vouchers`);
      if (!res.ok) throw new Error("Failed to fetch vouchers");
      return res.json();
    },
    enabled: !!dinerId,
  });

  // Fetch transactions for selected restaurant
  const { data: transactions = [], isLoading: loadingTransactions } = useQuery<Transaction[]>({
    queryKey: ["/api/diners", dinerId, "restaurants", selectedRestaurant?.restaurantId, "transactions"],
    queryFn: async () => {
      const res = await fetch(`/api/diners/${dinerId}/restaurants/${selectedRestaurant!.restaurantId}/transactions`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
    enabled: !!dinerId && !!selectedRestaurant,
  });

  // Create transaction mutation (simulates spending)
  const createTransaction = useMutation({
    mutationFn: async ({ restaurantId, amountSpent }: { restaurantId: string; amountSpent: string }) => {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dinerId: dinerId,
          restaurantId,
          amountSpent,
          pointsEarned: Math.floor(Number(amountSpent)),
        }),
      });
      if (!res.ok) throw new Error("Transaction failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/diners", dinerId, "points"] });
      queryClient.invalidateQueries({ queryKey: ["/api/diners", dinerId, "vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/diners", dinerId, "restaurants"] });
      
      if (data.vouchersGenerated && data.vouchersGenerated.length > 0) {
        toast({
          title: "🎉 Voucher Earned!",
          description: `You've earned ${data.vouchersGenerated.length} voucher(s)!`,
        });
      } else {
        toast({
          title: "Points Added",
          description: `+${data.transaction.pointsEarned} points. Total: ${data.balance.currentPoints}`,
        });
      }
    },
  });

  // Select voucher to present mutation
  const selectVoucher = useMutation({
    mutationFn: async ({ voucherId, title }: { voucherId: string; title: string }) => {
      const res = await fetch(`/api/diners/${dinerId}/vouchers/${voucherId}/select`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to select voucher");
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      setActiveCode(data.code);
      setActiveVoucherTitle(variables.title);
      setCodeExpiresAt(new Date(data.codeExpiresAt));
      setPresentCodeOpen(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (loadingBalances || loadingVouchers) {
    return (
      <DinerLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your wallet...</p>
          </div>
        </div>
      </DinerLayout>
    );
  }

  return (
    <DinerLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-serif font-bold text-foreground">My Rewards</h1>
          <p className="text-muted-foreground">Manage your loyalty points and vouchers across all restaurants.</p>
        </div>

        <Tabs defaultValue="points" className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="points" data-testid="tab-points">Loyalty Points</TabsTrigger>
            <TabsTrigger value="vouchers" data-testid="tab-vouchers">My Vouchers</TabsTrigger>
          </TabsList>

          <TabsContent value="points" className="space-y-6">
            {/* SIMULATION CONTROLS */}
            <div className="bg-muted/30 p-4 rounded-lg border border-dashed border-muted-foreground/20">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                <AlertCircle className="h-4 w-4" /> 
                Simulation: Spend at a restaurant to test the engine (R1 = 1 Point)
              </div>
              <div className="flex gap-2 flex-wrap">
                {balances.map((balance) => (
                  <div key={balance.id}>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => createTransaction.mutate({ 
                        restaurantId: balance.restaurantId, 
                        amountSpent: "50" 
                      })}
                      disabled={createTransaction.isPending}
                      data-testid={`button-spend-${balance.restaurantName.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      Spend R50 at {balance.restaurantName}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {balances.map((rest) => (
                <Card 
                  key={rest.id} 
                  className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all cursor-pointer" 
                  data-testid={`card-restaurant-${rest.restaurantName.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => {
                    setSelectedRestaurant(rest);
                    setTransactionHistoryOpen(true);
                  }}
                >
                  <div className={`h-2 w-full ${rest.restaurantColor}`} />
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-bold font-serif">{rest.restaurantName}</CardTitle>
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                      <Utensils className="h-4 w-4 text-secondary-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-end justify-between">
                        <div>
                          <span className="text-4xl font-bold tracking-tight" data-testid={`text-points-${rest.restaurantName.toLowerCase().replace(/\s+/g, '-')}`}>
                            {rest.currentPoints}
                          </span>
                          <span className="text-muted-foreground ml-1">pts</span>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground uppercase">Target: {rest.pointsThreshold}</span>
                      </div>
                      
                      <div className="space-y-1">
                        <Progress value={(rest.currentPoints / rest.pointsThreshold) * 100} className="h-2" />
                        <p className="text-xs text-right text-muted-foreground">
                          {rest.pointsThreshold - rest.currentPoints} points to next voucher
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-muted/10 border-t p-3">
                    <div className="flex justify-between items-center w-full">
                      <span className="text-xs font-medium flex items-center gap-1">
                        <Gift className="h-3 w-3" />
                        {rest.totalVouchersGenerated} Generated
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRestaurant(rest);
                          setTransactionHistoryOpen(true);
                        }}
                        data-testid={`button-view-details-${rest.restaurantName.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        View Details <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="vouchers" className="space-y-6">
            {vouchers.length === 0 ? (
              <Card className="p-12 text-center">
                <Gift className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">You have no active vouchers</p>
                <p className="text-sm text-muted-foreground mt-2">Spend R1000 to receive your first voucher</p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {vouchers.map((voucher) => (
                  <Card 
                    key={voucher.id} 
                    className={`relative overflow-hidden border-dashed border-2 transition-all ${
                      voucher.status === "active" 
                        ? "cursor-pointer hover:shadow-lg hover:border-primary/50 hover:scale-[1.02]" 
                        : "opacity-70"
                    }`}
                    onClick={() => {
                      if (voucher.status === "active" && !selectVoucher.isPending) {
                        selectVoucher.mutate({ voucherId: voucher.id, title: voucher.title });
                      }
                    }}
                    data-testid={`card-voucher-${voucher.code}`}
                  >
                    {/* Cutout effect circles */}
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background border-r-2 border-border" />
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background border-l-2 border-border" />
                    
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{voucher.restaurantName}</p>
                          <CardTitle className="mt-1 text-lg font-serif">{voucher.title}</CardTitle>
                        </div>
                        <Badge 
                          variant={voucher.status === "active" ? "default" : "secondary"} 
                          className={
                            voucher.status === "active" 
                              ? "bg-green-500/90 text-white hover:bg-green-500" 
                              : voucher.status === "expired" 
                                ? "bg-orange-500/90 text-white hover:bg-orange-500" 
                                : "bg-secondary/50"
                          }
                          data-testid={`badge-status-${voucher.code}`}
                        >
                          {voucher.status === "active" ? "Active" : voucher.status === "redeemed" ? "Redeemed" : "Expired"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> 
                        Expires {formatDistanceToNow(new Date(voucher.expiryDate), { addSuffix: true })}
                      </div>
                    </CardContent>
                    <CardFooter className="pt-2 border-t bg-muted/20">
                      <div className="w-full flex items-center justify-center gap-2 py-1 text-sm font-medium">
                        <QrCode className="h-4 w-4" />
                        {voucher.status === "active" ? "Tap to Redeem" : voucher.status === "redeemed" ? "Already Redeemed" : "Expired"}
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Present Code Dialog */}
        <Dialog open={presentCodeOpen} onOpenChange={setPresentCodeOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center font-serif text-2xl">Present to Staff</DialogTitle>
              <DialogDescription className="text-center">
                Show this code to redeem your voucher
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">{activeVoucherTitle}</p>
              </div>
              <div className="p-6 bg-gradient-to-br from-primary/10 to-secondary/30 rounded-xl border-2 border-dashed border-primary/30">
                <div className="text-center space-y-4">
                  <p className="text-4xl font-mono font-bold tracking-widest text-primary" data-testid="text-active-code">
                    {activeCode}
                  </p>
                  {activeCode && (
                    <div className="flex justify-center">
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <QRCodeSVG 
                          value={activeCode} 
                          size={160}
                          level="H"
                          includeMargin={false}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100 text-orange-700 text-sm font-medium">
                  <Clock className="h-4 w-4" />
                  Code expires in: {timeRemaining}
                </div>
                <p className="text-xs text-muted-foreground">
                  The restaurant staff will enter this code to mark your voucher as redeemed
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Transaction History Dialog */}
        <Dialog open={transactionHistoryOpen} onOpenChange={setTransactionHistoryOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Transaction History
              </DialogTitle>
              <DialogDescription>
                {selectedRestaurant?.restaurantName} - Your spending history
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {loadingTransactions ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No transactions yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Start spending to earn points!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {transactions.map((tx) => (
                    <div 
                      key={tx.id} 
                      className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border"
                      data-testid={`transaction-${tx.id}`}
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          R{parseFloat(tx.amountSpent).toFixed(2)} spent
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.transactionDate).toLocaleDateString('en-ZA', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {tx.billId && (
                          <p className="text-xs text-muted-foreground">Bill: {tx.billId}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          +{tx.pointsEarned} pts
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DinerLayout>
  );
}
