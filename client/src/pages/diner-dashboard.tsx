import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DinerLayout } from "@/components/layout/diner-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Utensils, Gift, ChevronRight, Clock, QrCode, Receipt, Sparkles, Star, Store } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/use-auth";

interface PointsBalance {
  id: string;
  currentPoints: number;
  currentVisits: number;
  totalVisits: number;
  totalVouchersGenerated: number;
  restaurantName: string;
  restaurantColor: string;
  restaurantId: string;
  branchId: string | null;
  branchName: string | null;
  pointsPerCurrency: number;
  pointsThreshold: number;
  voucherEarningMode: string; // 'points' | 'visits' (deprecated - now per voucher type)
  visitThreshold: number;
  pointsCredits: number;
  visitCredits: number;
  availableVoucherCredits: number;
  totalVoucherCreditsEarned: number;
  loyaltyScope: string;
}

interface VoucherType {
  id: string;
  name: string;
  description?: string;
  rewardDetails?: string;
  earningMode: string; // 'points' | 'visits'
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
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const dinerId = user?.id;
  const [presentCodeOpen, setPresentCodeOpen] = useState(false);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [activeVoucherTitle, setActiveVoucherTitle] = useState<string>("");
  const [codeExpiresAt, setCodeExpiresAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [redeemCreditsOpen, setRedeemCreditsOpen] = useState(false);
  const [redeemingRestaurant, setRedeemingRestaurant] = useState<PointsBalance | null>(null);
  const [showMyQRCode, setShowMyQRCode] = useState(false);

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
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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
            
            {user?.phone && (
              <Button
                size="sm"
                className="gap-2 min-h-[44px] bg-rose-100 hover:bg-rose-200 text-rose-800 border-0"
                onClick={() => setShowMyQRCode(true)}
                data-testid="button-show-my-qr"
              >
                <QrCode className="h-4 w-4" />
                My QR Code
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="points" className="w-full space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2 h-11 sm:h-10 sm:max-w-[400px] bg-white border border-rose-200">
            <TabsTrigger value="points" className="text-xs sm:text-sm text-rose-700 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-800 data-[state=active]:shadow-none" data-testid="tab-points">Loyalty Points</TabsTrigger>
            <TabsTrigger value="vouchers" className="text-xs sm:text-sm text-rose-700 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-800 data-[state=active]:shadow-none" data-testid="tab-vouchers">My Vouchers</TabsTrigger>
          </TabsList>

          <TabsContent value="points" className="space-y-4 sm:space-y-6">
            {balances.length === 0 ? (
              <Card className="p-6 sm:p-12 text-center">
                <Utensils className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground/50 mb-3 sm:mb-4" />
                <p className="text-base sm:text-lg font-medium text-muted-foreground">
                  No rewards yet
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                  Visit a partner restaurant and make a purchase to start earning loyalty points
                </p>
              </Card>
            ) : selectedRestaurant ? (
              <>
                {/* Selected Restaurant Card */}
                <Card 
                  className="overflow-hidden border-none shadow-md relative" 
                  data-testid={`card-restaurant-${selectedRestaurant.restaurantName.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {/* Available Vouchers Banner */}
                  {((selectedRestaurant.pointsCredits || 0) + (selectedRestaurant.visitCredits || 0) > 0) && (
                    <div 
                      className="bg-gradient-to-r from-rose-700 to-rose-600 text-white px-3 py-2 flex items-center justify-between cursor-pointer hover:from-rose-800 hover:to-rose-700 transition-colors"
                      onClick={() => {
                        setRedeemingRestaurant(selectedRestaurant);
                        setRedeemCreditsOpen(true);
                      }}
                      data-testid="banner-redeem-credits"
                    >
                      <span className="text-sm font-medium flex items-center gap-1">
                        <Sparkles className="h-4 w-4" />
                        {(selectedRestaurant.pointsCredits || 0) + (selectedRestaurant.visitCredits || 0)} reward credit{(selectedRestaurant.pointsCredits || 0) + (selectedRestaurant.visitCredits || 0) !== 1 ? 's' : ''} available
                      </span>
                      <span className="text-xs bg-white/20 px-2 py-1 rounded">
                        Tap to redeem
                      </span>
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
                      {/* Points Progress */}
                      <div className="space-y-2">
                        <div className="flex items-end justify-between gap-2">
                          <div>
                            <span className="text-3xl sm:text-4xl font-bold tracking-tight" data-testid={`text-points-${selectedRestaurant.restaurantName.toLowerCase().replace(/\s+/g, '-')}`}>
                              {selectedRestaurant.currentPoints}
                            </span>
                            <span className="text-muted-foreground ml-1 text-sm">pts</span>
                            {(selectedRestaurant.pointsCredits || 0) > 0 && (
                              <Badge variant="secondary" className="ml-2 text-xs">{selectedRestaurant.pointsCredits} voucher{selectedRestaurant.pointsCredits !== 1 ? 's' : ''} ready</Badge>
                            )}
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">Target: {selectedRestaurant.pointsThreshold}</span>
                        </div>
                        <Progress value={(selectedRestaurant.currentPoints / selectedRestaurant.pointsThreshold) * 100} className="h-2 [&>div]:bg-rose-700" />
                        <p className="text-xs text-muted-foreground">
                          Spend R{Math.max(0, selectedRestaurant.pointsThreshold - selectedRestaurant.currentPoints)} more for a points voucher
                        </p>
                      </div>
                      
                      <Separator />
                      
                      {/* Visits Progress */}
                      <div className="space-y-2">
                        <div className="flex items-end justify-between gap-2">
                          <div>
                            <span className="text-3xl sm:text-4xl font-bold tracking-tight" data-testid={`text-visits-${selectedRestaurant.restaurantName.toLowerCase().replace(/\s+/g, '-')}`}>
                              {selectedRestaurant.currentVisits}
                            </span>
                            <span className="text-muted-foreground ml-1 text-sm">visits</span>
                            {(selectedRestaurant.visitCredits || 0) > 0 && (
                              <Badge variant="secondary" className="ml-2 text-xs">{selectedRestaurant.visitCredits} voucher{selectedRestaurant.visitCredits !== 1 ? 's' : ''} ready</Badge>
                            )}
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">Target: {selectedRestaurant.visitThreshold}</span>
                        </div>
                        <Progress value={(selectedRestaurant.currentVisits / selectedRestaurant.visitThreshold) * 100} className="h-2 [&>div]:bg-rose-700" />
                        <p className="text-xs text-muted-foreground">
                          {Math.max(0, selectedRestaurant.visitThreshold - selectedRestaurant.currentVisits)} more visit{selectedRestaurant.visitThreshold - selectedRestaurant.currentVisits !== 1 ? 's' : ''} for a visits voucher
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
                        onClick={() => navigate("/diner/history")}
                        data-testid={`button-view-history`}
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        Transaction History
                      </Button>
                    </div>
                  </CardFooter>
                </Card>

                {/* How to Earn */}
                <div className="bg-muted/30 p-3 sm:p-4 rounded-lg border border-dashed border-muted-foreground/20 space-y-2">
                  <div className="flex items-start gap-2 text-xs sm:text-sm font-medium text-muted-foreground">
                    <Star className="h-4 w-4 shrink-0 mt-0.5" /> 
                    <span><strong>Points vouchers:</strong> Spend R{selectedRestaurant.pointsThreshold} to earn a credit (R1 = {selectedRestaurant.pointsPerCurrency} point{selectedRestaurant.pointsPerCurrency !== 1 ? 's' : ''})</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs sm:text-sm font-medium text-muted-foreground">
                    <Star className="h-4 w-4 shrink-0 mt-0.5" /> 
                    <span><strong>Visits vouchers:</strong> Visit {selectedRestaurant.visitThreshold} times to earn a credit</span>
                  </div>
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
              
              const hasCredits = selectedRestaurant && ((selectedRestaurant.pointsCredits || 0) > 0 || (selectedRestaurant.visitCredits || 0) > 0);
              
              if (filteredVouchers.length === 0 && !hasCredits) {
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
              
              if (filteredVouchers.length === 0 && hasCredits) {
                // Show redeem credits prompt when diner has credits but no vouchers yet
                return (
                  <Card className="p-6 sm:p-8 text-center border-rose-200 bg-rose-50/50">
                    <Sparkles className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-rose-500 mb-3 sm:mb-4" />
                    <p className="text-base sm:text-lg font-medium text-foreground">
                      You have {(selectedRestaurant?.pointsCredits || 0) + (selectedRestaurant?.visitCredits || 0)} reward credit{((selectedRestaurant?.pointsCredits || 0) + (selectedRestaurant?.visitCredits || 0)) !== 1 ? 's' : ''} to redeem!
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2 mb-4">
                      Choose a voucher reward from {selectedRestaurant?.restaurantName}
                    </p>
                    <Button 
                      className="bg-rose-100 hover:bg-rose-200 text-rose-800 border-0"
                      onClick={() => {
                        setRedeemingRestaurant(selectedRestaurant);
                        setRedeemCreditsOpen(true);
                      }}
                      data-testid="button-redeem-credits"
                    >
                      <Gift className="h-4 w-4 mr-2" />
                      Choose Your Reward
                    </Button>
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

        {/* Credit Redemption Dialog */}
        <Dialog open={redeemCreditsOpen} onOpenChange={(open) => {
          setRedeemCreditsOpen(open);
          if (!open) setRedeemingRestaurant(null);
        }}>
          <DialogContent className="w-[calc(100%-24px)] max-w-lg mx-auto rounded-lg">
            <DialogHeader>
              <DialogTitle className="font-serif text-lg sm:text-xl flex items-center gap-2">
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-rose-600 shrink-0" />
                Choose Your Reward
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                {redeemingRestaurant?.restaurantName} - {redeemingRestaurant?.pointsCredits || 0} points credit{(redeemingRestaurant?.pointsCredits || 0) !== 1 ? 's' : ''}, {redeemingRestaurant?.visitCredits || 0} visit credit{(redeemingRestaurant?.visitCredits || 0) !== 1 ? 's' : ''}
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
                    const vtEarningMode = vt.earningMode || 'points';
                    const availableCredits = vtEarningMode === 'visits' 
                      ? (redeemingRestaurant?.visitCredits || 0) 
                      : (redeemingRestaurant?.pointsCredits || 0);
                    const canAfford = availableCredits >= vt.creditsCost;
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
                            <Badge variant="outline" className="text-[10px] font-normal mt-1">
                              {vtEarningMode === 'visits' ? 'Visits' : 'Points'}
                            </Badge>
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
                              className={`text-[10px] sm:text-xs ${canAfford ? "bg-rose-600 hover:bg-rose-600" : ""}`}
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

        {/* My QR Code Dialog */}
        <Dialog open={showMyQRCode} onOpenChange={setShowMyQRCode}>
          <DialogContent className="w-[calc(100%-24px)] max-w-sm mx-auto rounded-lg">
            <DialogHeader className="text-center">
              <DialogTitle className="font-serif text-lg sm:text-xl flex items-center justify-center gap-2">
                <QrCode className="h-5 w-5" />
                My QR Code
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Show this QR code to the restaurant staff to earn points
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center py-4 sm:py-6 space-y-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border">
                <QRCodeSVG 
                  value={user?.phone || ""} 
                  size={180}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-lg font-mono font-semibold text-primary">{user?.phone}</p>
              </div>
              <p className="text-xs text-muted-foreground text-center px-4">
                Scan at restaurant to earn points
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DinerLayout>
  );
}
