import { useState } from "react";
import { DinerLayout } from "@/components/layout/diner-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Utensils, Gift, ChevronRight, Star, Clock, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// Mock Data for demonstration
interface RestaurantPoints {
  id: string;
  name: string;
  points: number;
  totalVouchers: number;
  color: string;
}

interface Voucher {
  id: string;
  restaurantId: string;
  restaurantName: string;
  title: string;
  expiry: string;
  code: string;
}

export default function DinerDashboard() {
  // State to simulate the Points Engine
  const [restaurants, setRestaurants] = useState<RestaurantPoints[]>([
    { id: "1", name: "La Trattoria", points: 850, totalVouchers: 1, color: "bg-orange-500" },
    { id: "2", name: "Sushi Zen", points: 120, totalVouchers: 0, color: "bg-rose-500" },
    { id: "3", name: "The Burger Joint", points: 950, totalVouchers: 2, color: "bg-amber-500" },
  ]);

  const [vouchers, setVouchers] = useState<Voucher[]>([
    { id: "v1", restaurantId: "1", restaurantName: "La Trattoria", title: "Free Dessert", expiry: "Valid until Dec 31", code: "TRAT-992" },
    { id: "v2", restaurantId: "3", restaurantName: "The Burger Joint", title: "Free Milkshake", expiry: "Valid until Jan 15", code: "BURG-112" },
    { id: "v3", restaurantId: "3", restaurantName: "The Burger Joint", title: "$10 Off", expiry: "Valid until Feb 01", code: "BURG-882" },
  ]);

  // SIMULATION ENGINE: Add Points
  const simulateTransaction = (restaurantId: string, amountSpent: number) => {
    // Rule 1: 1 R = 1 Point
    const pointsEarned = Math.floor(amountSpent);

    setRestaurants(prev => prev.map(rest => {
      if (rest.id !== restaurantId) return rest;

      let newPoints = rest.points + pointsEarned;
      let newVouchersCount = rest.totalVouchers;

      // Rule 2 & 4: Every 1000 points generates a voucher and resets count
      // Actually, typically "resets" means 1000 points are deducted.
      // If I have 900 and earn 200 => 1100.
      // 1100 >= 1000 => Generate Voucher. New Balance = 100.
      
      const vouchersGenerated = Math.floor(newPoints / 1000);
      
      if (vouchersGenerated > 0) {
        newPoints = newPoints % 1000;
        newVouchersCount += vouchersGenerated;
        
        // Add new vouchers to state
        const newVoucherList: Voucher[] = [];
        for (let i = 0; i < vouchersGenerated; i++) {
            newVoucherList.push({
                id: `new-${Date.now()}-${i}`,
                restaurantId: rest.id,
                restaurantName: rest.name,
                title: "R100 Loyalty Voucher", // Determined by restaurant
                expiry: "Valid for 30 days",
                code: `AUTO-${Math.floor(Math.random() * 10000)}`
            });
        }
        
        setVouchers(prevV => [...newVoucherList, ...prevV]);
        
        toast({
            title: "🎉 Voucher Earned!",
            description: `You've earned ${vouchersGenerated} voucher(s) at ${rest.name}!`,
        });
      } else {
          toast({
              title: "Points Added",
              description: `+${pointsEarned} points at ${rest.name}. Total: ${newPoints}`,
          });
      }

      return {
        ...rest,
        points: newPoints,
        totalVouchers: newVouchersCount
      };
    }));
  };

  return (
    <DinerLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-serif font-bold text-foreground">My Wallet</h1>
          <p className="text-muted-foreground">Manage your loyalty points and vouchers across all restaurants.</p>
        </div>

        <Tabs defaultValue="points" className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="points">Loyalty Points</TabsTrigger>
            <TabsTrigger value="vouchers">My Vouchers</TabsTrigger>
          </TabsList>

          <TabsContent value="points" className="space-y-6">
             {/* SIMULATION CONTROLS */}
             <div className="bg-muted/30 p-4 rounded-lg border border-dashed border-muted-foreground/20">
                <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                    <AlertCircle className="h-4 w-4" /> 
                    Simulation: Spend at a restaurant to test the engine (R1 = 1 Point)
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => simulateTransaction("1", 50)}>
                        Spend R50 at Trattoria
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => simulateTransaction("1", 150)}>
                        Spend R150 at Trattoria (Triggers Voucher)
                    </Button>
                     <Button variant="outline" size="sm" onClick={() => simulateTransaction("3", 60)}>
                        Spend R60 at Burger Joint
                    </Button>
                </div>
             </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {restaurants.map((rest) => (
                <Card key={rest.id} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all">
                  <div className={`h-2 w-full ${rest.color}`} />
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-bold font-serif">{rest.name}</CardTitle>
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                        <Utensils className="h-4 w-4 text-secondary-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-end justify-between">
                        <div>
                            <span className="text-4xl font-bold tracking-tight">{rest.points}</span>
                            <span className="text-muted-foreground ml-1">pts</span>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground uppercase">Target: 1000</span>
                      </div>
                      
                      <div className="space-y-1">
                        <Progress value={(rest.points / 1000) * 100} className="h-2" />
                        <p className="text-xs text-right text-muted-foreground">
                            {1000 - rest.points} points to next voucher
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-muted/10 border-t p-3">
                    <div className="flex justify-between items-center w-full">
                        <span className="text-xs font-medium flex items-center gap-1">
                            <Gift className="h-3 w-3" />
                            {rest.totalVouchers} Available
                        </span>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                            View Details <ChevronRight className="h-3 w-3" />
                        </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="vouchers" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {vouchers.map((voucher) => (
                    <Card key={voucher.id} className="relative overflow-hidden border-dashed border-2">
                        {/* Cutout effect circles */}
                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background border-r-2 border-border" />
                        <div className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background border-l-2 border-border" />
                        
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{voucher.restaurantName}</p>
                                    <CardTitle className="mt-1 text-lg font-serif">{voucher.title}</CardTitle>
                                </div>
                                <Badge variant="outline" className="bg-secondary/50">Reward</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pb-2">
                            <div className="p-3 bg-muted/20 rounded-md text-center border font-mono text-sm tracking-widest font-bold text-primary">
                                {voucher.code}
                            </div>
                            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" /> {voucher.expiry}
                            </div>
                        </CardContent>
                        <CardFooter className="pt-2">
                            <Button className="w-full" size="sm">Redeem Now</Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DinerLayout>
  );
}
