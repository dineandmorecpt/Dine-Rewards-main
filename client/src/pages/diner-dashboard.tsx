import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DinerLayout } from "@/components/layout/diner-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Utensils, Gift, ChevronRight, Clock, AlertCircle, QrCode, Receipt, Sparkles, Star, Store } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Separator } from "@/components/ui/separator";
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
  branchId: string | null;
  branchName: string | null;
  pointsPerCurrency: number;
  pointsThreshold: number;
  availableVoucherCredits: number;
  totalVoucherCreditsEarned: number;
  loyaltyScope: string;
}

interface VoucherType {
  id: string;
  name: string;
  description?: string;
  rewardDetails?: string;
  creditsCost: number;
  validityDays: number;
  isActive: boolean;
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
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [transactionHistoryOpen, setTransactionHistoryOpen] = useState(false);
  const [redeemCreditsOpen, setRedeemCreditsOpen] = useState(false);
  const [redeemingRestaurant, setRedeemingRestaurant] = useState<PointsBalance | null>(null);

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

  // Auto-select first restaurant when balances load
  useEffect(() => {
    if (balances.length > 0 && !selectedRestaurantId) {
      setSelectedRestaurantId(balances[0].restaurantId);
    }
  }, [balances, selectedRestaurantId]);

  // Derive selectedRestaurant from balances
  const selectedRestaurant = balances.find(b => b.restaurantId === selectedRestaurantId) || null;

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

  // Fetch active voucher types for redeeming restaurant
  const { data: voucherTypes = [], isLoading: loadingVoucherTypes } = useQuery<VoucherType[]>({
    queryKey: ["/api/restaurants", redeemingRestaurant?.restaurantId, "voucher-types", "active"],
    queryFn: async () => {
      const res = await fetch(`/api/restaurants/${redeemingRestaurant!.restaurantId}/voucher-types/active`);
      if (!res.ok) throw new Error("Failed to fetch voucher types");
      return res.json();
    },
    enabled: !!redeemingRestaurant,
  });

  // Redeem credit for voucher
  const redeemCredit = useMutation({
    mutationFn: async ({ restaurantId, voucherTypeId, branchId }: { restaurantId: string; voucherTypeId: string; branchId?: string | null }) => {
      const res = await fetch(`/api/diners/${dinerId}/restaurants/${restaurantId}/redeem-credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voucherTypeId, branchId: branchId || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to redeem credit");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/diners", dinerId, "points"] });
      queryClient.invalidateQueries({ queryKey: ["/api/diners", dinerId, "vouchers"] });
      setRedeemCreditsOpen(false);
      setRedeemingRestaurant(null);
      toast({
        title: "Voucher Created!",
        description: `You now have a new voucher: ${data.voucher.title}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Redemption Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create transaction mutation (simulates spending)
  const createTransaction = useMutation({
    mutationFn: async ({ restaurantId, amountSpent, branchId }: { restaurantId: string; amountSpent: string; branchId?: string | null }) => {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dinerId: dinerId,
          restaurantId,
          amountSpent,
          pointsEarned: Math.floor(Number(amountSpent)),
          branchId: branchId || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Transaction failed");
      }
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
      <div className="space-y-4 sm:space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-serif font-bold text-foreground leading-tight">
              Welcome back, {user?.name?.split(' ')[0] || 'Guest'}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-0.5">Manage your loyalty points and vouchers.</p>
          </div>
          
          {balances.length > 0 && (
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select
                value={selectedRestaurantId || ""}
                onValueChange={(value) => setSelectedRestaurantId(value)}
              >
                <SelectTrigger className="w-full sm:w-[200px] min-h-[44px]" data-testid="select-restaurant">
                  <SelectValue placeholder="Select restaurant" />
                </SelectTrigger>
                <SelectContent>
                  {balances.map((balance) => (
                    <SelectItem 
                      key={balance.restaurantId} 
                      value={balance.restaurantId}
                      data-testid={`option-restaurant-${balance.restaurantId}`}
                    >
                      {balance.restaurantName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Tabs defaultValue="points" className="w-full space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2 h-11 sm:h-10 sm:max-w-[400px]">
            <TabsTrigger value="points" className="text-xs sm:text-sm" data-testid="tab-points">Loyalty Points</TabsTrigger>
            <TabsTrigger value="vouchers" className="text-xs sm:text-sm" data-testid="tab-vouchers">My Vouchers</TabsTrigger>
          </TabsList>

          <TabsContent value="points" className="space-y-4 sm:space-y-6">
            {selectedRestaurant ? (
              <>
                {/* Selected Restaurant Card */}
                <Card 
                  className="overflow-hidden border-none shadow-md relative" 
                  data-testid={`card-restaurant-${selectedRestaurant.restaurantName.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {/* Available Credits Banner */}
                  {selectedRestaurant.availableVoucherCredits > 0 && (
                    <div 
                      className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-2 flex items-center justify-between"
                    >
                      <span className="text-sm font-medium flex items-center gap-1">
                        <Sparkles className="h-4 w-4" />
                        {selectedRestaurant.availableVoucherCredits} Credit{selectedRestaurant.availableVoucherCredits !== 1 ? 's' : ''} Available!
                      </span>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        className="h-7 text-xs"
                        onClick={() => {
                          setRedeemingRestaurant(selectedRestaurant);
                          setRedeemCreditsOpen(true);
                        }}
                        data-testid={`button-redeem-credits-${selectedRestaurant.restaurantName.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        Redeem
                      </Button>
                    </div>
                  )}
                  
                  <div className={`h-2 w-full ${selectedRestaurant.restaurantColor}`} />
                  <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-xl font-bold font-serif truncate">{selectedRestaurant.restaurantName}</CardTitle>
                      {selectedRestaurant.branchName && selectedRestaurant.loyaltyScope === "branch" && (
                        <p className="text-xs text-muted-foreground mt-0.5">{selectedRestaurant.branchName} branch</p>
                      )}
                    </div>
                    <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0 ml-2">
                      <Utensils className="h-5 w-5 text-secondary-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="space-y-4">
                      <div className="flex items-end justify-between gap-2">
                        <div>
                          <span className="text-4xl sm:text-5xl font-bold tracking-tight" data-testid={`text-points-${selectedRestaurant.restaurantName.toLowerCase().replace(/\s+/g, '-')}`}>
                            {selectedRestaurant.currentPoints}
                          </span>
                          <span className="text-muted-foreground ml-1 text-base">pts</span>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground uppercase">Target: {selectedRestaurant.pointsThreshold}</span>
                      </div>
                      
                      <div className="space-y-2">
                        <Progress value={(selectedRestaurant.currentPoints / selectedRestaurant.pointsThreshold) * 100} className="h-3" />
                        <p className="text-xs text-muted-foreground">
                          Spend R{selectedRestaurant.pointsThreshold - selectedRestaurant.currentPoints} more to earn your next voucher
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-muted/10 border-t p-3">
                    <div className="flex justify-between items-center w-full">
                      <span className="text-xs font-medium flex items-center gap-1">
                        <Gift className="h-3.5 w-3.5" />
                        {selectedRestaurant.totalVouchersGenerated} Vouchers Earned
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs gap-1"
                        onClick={() => setTransactionHistoryOpen(true)}
                        data-testid={`button-view-history`}
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        Transaction History
                      </Button>
                    </div>
                  </CardFooter>
                </Card>

                {/* SIMULATION CONTROLS */}
                <div className="bg-muted/30 p-3 sm:p-4 rounded-lg border border-dashed border-muted-foreground/20">
                  <div className="flex items-start gap-2 mb-3 text-xs sm:text-sm font-medium text-muted-foreground">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> 
                    <span>Simulation: Spend R1000 to earn a voucher (R1 = 1 Point)</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs sm:text-sm h-9 sm:h-8"
                    onClick={() => createTransaction.mutate({ 
                      restaurantId: selectedRestaurant.restaurantId, 
                      amountSpent: "50",
                      branchId: selectedRestaurant.branchId
                    })}
                    disabled={createTransaction.isPending}
                    data-testid={`button-spend-50`}
                  >
                    Spend R50 at {selectedRestaurant.restaurantName}
                  </Button>
                </div>
              </>
            ) : (
              <Card className="p-6 sm:p-12 text-center">
                <Store className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground/50 mb-3 sm:mb-4" />
                <p className="text-base sm:text-lg font-medium text-muted-foreground">
                  No restaurant selected
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                  Select a restaurant from the dropdown above to view your rewards
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="vouchers" className="space-y-4 sm:space-y-6">
            {(() => {
              const filteredVouchers = selectedRestaurantId 
                ? vouchers.filter(v => v.restaurantId === selectedRestaurantId)
                : vouchers;
              
              if (filteredVouchers.length === 0) {
                return (
                  <Card className="p-6 sm:p-12 text-center">
                    <Gift className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground/50 mb-3 sm:mb-4" />
                    <p className="text-base sm:text-lg font-medium text-muted-foreground">
                      {selectedRestaurant ? `No vouchers for ${selectedRestaurant.restaurantName}` : 'You have no vouchers yet'}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                      {selectedRestaurant 
                        ? `Spend R1000 at ${selectedRestaurant.restaurantName} to earn a voucher`
                        : 'Spend R1000 at a restaurant to earn your first voucher'}
                    </p>
                  </Card>
                );
              }
              
              return (
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredVouchers.map((voucher) => (
                  <Card 
                    key={voucher.id} 
                    className={`relative overflow-hidden border-dashed border-2 transition-all ${
                      voucher.status === "active" 
                        ? "cursor-pointer hover:shadow-lg hover:border-primary/50 active:scale-[0.98]" 
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
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-background border-r-2 border-border" />
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-background border-l-2 border-border" />
                    
                    <CardHeader className="p-3 sm:p-4 pb-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider truncate">{voucher.restaurantName}</p>
                          <CardTitle className="mt-1 text-base sm:text-lg font-serif leading-tight">{voucher.title}</CardTitle>
                        </div>
                        <Badge 
                          variant={voucher.status === "active" ? "default" : "secondary"} 
                          className={`shrink-0 text-[10px] sm:text-xs ${
                            voucher.status === "active" 
                              ? "bg-green-500/90 text-white hover:bg-green-500" 
                              : voucher.status === "expired" 
                                ? "bg-orange-500/90 text-white hover:bg-orange-500" 
                                : "bg-secondary/50"
                          }`}
                          data-testid={`badge-status-${voucher.code}`}
                        >
                          {voucher.status === "active" ? "Active" : voucher.status === "redeemed" ? "Redeemed" : "Expired"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 pt-0 pb-2">
                      <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 shrink-0" /> 
                        Expires {formatDistanceToNow(new Date(voucher.expiryDate), { addSuffix: true })}
                      </div>
                    </CardContent>
                    <CardFooter className="p-2.5 sm:p-3 border-t bg-muted/20">
                      <div className="w-full flex items-center justify-center gap-2 py-0.5 text-xs sm:text-sm font-medium">
                        <QrCode className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        {voucher.status === "active" ? "Tap to Redeem" : voucher.status === "redeemed" ? "Already Redeemed" : "Expired"}
                      </div>
                    </CardFooter>
                  </Card>
                ))}
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>

        {/* Present Code Dialog */}
        <Dialog open={presentCodeOpen} onOpenChange={setPresentCodeOpen}>
          <DialogContent className="w-[calc(100%-24px)] max-w-md mx-auto rounded-lg">
            <DialogHeader>
              <DialogTitle className="text-center font-serif text-xl sm:text-2xl">Present to Staff</DialogTitle>
              <DialogDescription className="text-center text-xs sm:text-sm">
                Show this code to redeem your voucher
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 sm:space-y-6 py-2 sm:py-4">
              <div className="text-center">
                <p className="text-xs sm:text-sm text-muted-foreground mb-2">{activeVoucherTitle}</p>
              </div>
              <div className="p-4 sm:p-6 bg-gradient-to-br from-primary/10 to-secondary/30 rounded-xl border-2 border-dashed border-primary/30">
                <div className="text-center space-y-3 sm:space-y-4">
                  <p className="text-2xl sm:text-4xl font-mono font-bold tracking-widest text-primary" data-testid="text-active-code">
                    {activeCode}
                  </p>
                  {activeCode && (
                    <div className="flex justify-center">
                      <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
                        <QRCodeSVG 
                          value={activeCode} 
                          size={140}
                          level="H"
                          includeMargin={false}
                          className="sm:w-[160px] sm:h-[160px]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-orange-100 text-orange-700 text-xs sm:text-sm font-medium">
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Code expires in: {timeRemaining}
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground px-2">
                  The restaurant staff will enter this code to mark your voucher as redeemed
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Transaction History Dialog */}
        <Dialog open={transactionHistoryOpen} onOpenChange={setTransactionHistoryOpen}>
          <DialogContent className="w-[calc(100%-24px)] max-w-lg mx-auto rounded-lg">
            <DialogHeader>
              <DialogTitle className="font-serif text-lg sm:text-xl flex items-center gap-2">
                <Receipt className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                Transaction History
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                {selectedRestaurant?.restaurantName} - Your spending history
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 sm:py-4">
              {loadingTransactions ? (
                <div className="flex items-center justify-center py-6 sm:py-8">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary"></div>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <Receipt className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground/50 mb-2 sm:mb-3" />
                  <p className="text-sm sm:text-base text-muted-foreground">No transactions yet</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">Start spending to earn points!</p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3 max-h-[300px] sm:max-h-[400px] overflow-y-auto">
                  {transactions.map((tx) => (
                    <div 
                      key={tx.id} 
                      className="flex justify-between items-center p-2.5 sm:p-3 rounded-lg bg-muted/30 border gap-2"
                      data-testid={`transaction-${tx.id}`}
                    >
                      <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium">
                          R{parseFloat(tx.amountSpent).toFixed(2)} spent
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {new Date(tx.transactionDate).toLocaleDateString('en-ZA', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {tx.billId && (
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Bill: {tx.billId}</p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] sm:text-xs">
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

        {/* Credit Redemption Dialog */}
        <Dialog open={redeemCreditsOpen} onOpenChange={(open) => {
          setRedeemCreditsOpen(open);
          if (!open) setRedeemingRestaurant(null);
        }}>
          <DialogContent className="w-[calc(100%-24px)] max-w-lg mx-auto rounded-lg">
            <DialogHeader>
              <DialogTitle className="font-serif text-lg sm:text-xl flex items-center gap-2">
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 shrink-0" />
                Choose Your Reward
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                {redeemingRestaurant?.restaurantName} - You have {redeemingRestaurant?.availableVoucherCredits} credit{(redeemingRestaurant?.availableVoucherCredits || 0) !== 1 ? 's' : ''} to spend
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 sm:py-4">
              {loadingVoucherTypes ? (
                <div className="flex items-center justify-center py-6 sm:py-8">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary"></div>
                </div>
              ) : voucherTypes.length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <Gift className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground/50 mb-2 sm:mb-3" />
                  <p className="text-sm sm:text-base text-muted-foreground">No rewards available</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">The restaurant hasn't set up any reward options yet.</p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3 max-h-[300px] sm:max-h-[400px] overflow-y-auto">
                  {voucherTypes.map((vt) => {
                    const canAfford = (redeemingRestaurant?.availableVoucherCredits || 0) >= vt.creditsCost;
                    return (
                      <Card 
                        key={vt.id} 
                        className={`p-3 sm:p-4 cursor-pointer transition-all ${canAfford ? 'hover:border-primary hover:shadow-md active:scale-[0.98]' : 'opacity-50 cursor-not-allowed'}`}
                        onClick={() => {
                          if (canAfford && redeemingRestaurant) {
                            redeemCredit.mutate({ 
                              restaurantId: redeemingRestaurant.restaurantId, 
                              voucherTypeId: vt.id,
                              branchId: redeemingRestaurant.branchId
                            });
                          }
                        }}
                        data-testid={`card-select-voucher-type-${vt.id}`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium font-serif text-sm sm:text-base">{vt.name}</h3>
                            {vt.description && (
                              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{vt.description}</p>
                            )}
                            <div className="flex gap-4 mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Valid {vt.validityDays} days
                              </span>
                            </div>
                            {vt.rewardDetails && (
                              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t">{vt.rewardDetails}</p>
                            )}
                          </div>
                          <div className="shrink-0">
                            <Badge 
                              variant={canAfford ? "default" : "secondary"}
                              className={`text-[10px] sm:text-xs ${canAfford ? "bg-amber-500 hover:bg-amber-500" : ""}`}
                            >
                              <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                              {vt.creditsCost} Credit{vt.creditsCost !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DinerLayout>
  );
}
