import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Ticket, Megaphone, Plus, Calendar, Users, Percent, DollarSign, Gift, Clock, Send } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock Data
const initialVouchers = [
  { id: 1, title: "Welcome Drink", type: "item", value: "Free Cocktail", expiry: "30 days", active: true, redeemed: 45 },
  { id: 2, title: "Birthday Treat", type: "discount", value: "20% Off", expiry: "7 days", active: true, redeemed: 128 },
  { id: 3, title: "Loyalty Reward", type: "currency", value: "$15 Credit", expiry: "60 days", active: true, redeemed: 312 },
  { id: 4, title: "Summer Special", type: "discount", value: "10% Off", expiry: "30 days", active: false, redeemed: 890 },
];

const initialCampaigns = [
  { id: 1, name: "Summer Kickoff", status: "Active", voucher: "Summer Special", audience: "All Diners", sent: 1250, openRate: "45%" },
  { id: 2, name: "We Miss You", status: "Scheduled", voucher: "Loyalty Reward", audience: "Lapsed (>30 days)", sent: 0, openRate: "-" },
  { id: 3, name: "VIP Gala Invite", status: "Completed", voucher: "Welcome Drink", audience: "VIP", sent: 150, openRate: "82%" },
];

export default function AdminVouchers() {
  const [vouchers, setVouchers] = useState(initialVouchers);
  const [campaigns, setCampaigns] = useState(initialCampaigns);

  return (
    <AdminLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Rewards & Campaigns</h1>
            <p className="text-muted-foreground mt-1">Manage your loyalty rewards and marketing campaigns.</p>
          </div>
        </div>

        <Tabs defaultValue="vouchers" className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="vouchers">Vouchers</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          </TabsList>

          {/* VOUCHERS TAB */}
          <TabsContent value="vouchers" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-medium font-serif">Active Vouchers</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" /> Create Voucher
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Create New Voucher</DialogTitle>
                    <DialogDescription>
                      Define the reward details. This will be added to your voucher library.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="v-title">Voucher Title</Label>
                      <Input id="v-title" placeholder="e.g., Free Dessert" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="v-type">Type</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="discount">Percentage (%)</SelectItem>
                            <SelectItem value="currency">Fixed Amount ($)</SelectItem>
                            <SelectItem value="item">Free Item</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="v-value">Value</Label>
                        <Input id="v-value" placeholder="e.g., 20% or $10" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="v-desc">Description</Label>
                      <Textarea id="v-desc" placeholder="Terms and conditions..." />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="v-expiry">Validity (Days)</Label>
                      <Input id="v-expiry" type="number" placeholder="30" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Create Voucher</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {vouchers.map((voucher) => (
                <Card key={voucher.id} className={cn("transition-all hover:shadow-md", !voucher.active && "opacity-60")}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold">{voucher.title}</CardTitle>
                      <CardDescription>{voucher.value} • {voucher.expiry}</CardDescription>
                    </div>
                    <div className={cn("p-2 rounded-full", 
                      voucher.type === 'discount' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : 
                      voucher.type === 'currency' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" :
                      "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                    )}>
                      {voucher.type === 'discount' && <Percent className="h-4 w-4" />}
                      {voucher.type === 'currency' && <DollarSign className="h-4 w-4" />}
                      {voucher.type === 'item' && <Gift className="h-4 w-4" />}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mt-2 flex items-center text-sm text-muted-foreground">
                      <Ticket className="mr-2 h-4 w-4" />
                      {voucher.redeemed} redeemed
                    </div>
                  </CardContent>
                  <CardFooter className="border-t bg-muted/10 p-3">
                    <div className="flex w-full items-center justify-between">
                      <Badge variant={voucher.active ? "default" : "secondary"}>
                        {voucher.active ? "Active" : "Archived"}
                      </Badge>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">Edit</Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* CAMPAIGNS TAB */}
          <TabsContent value="campaigns" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-medium font-serif">Marketing Campaigns</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Megaphone className="h-4 w-4" /> New Campaign
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Create Campaign</DialogTitle>
                    <DialogDescription>
                      Push a voucher to a specific segment of your diners.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="c-name">Campaign Name</Label>
                      <Input id="c-name" placeholder="e.g., Summer Weekend Flash Sale" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="c-voucher">Select Voucher</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a reward to send" />
                        </SelectTrigger>
                        <SelectContent>
                          {vouchers.filter(v => v.active).map(v => (
                            <SelectItem key={v.id} value={v.id.toString()}>{v.title} ({v.value})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="c-audience">Target Audience</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Who should receive this?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Diners</SelectItem>
                          <SelectItem value="vip">VIP Members Only</SelectItem>
                          <SelectItem value="new">New Signups (Last 30 days)</SelectItem>
                          <SelectItem value="lapsed">Lapsed (No visit &gt; 30 days)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="c-message">Push Notification Message</Label>
                      <Textarea id="c-message" placeholder="Hey [Name], come in this weekend for a treat!" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Schedule</Label>
                        <Select defaultValue="now">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="now">Send Immediately</SelectItem>
                            <SelectItem value="later">Schedule for Later</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="gap-2"><Send className="h-4 w-4" /> Launch Campaign</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="rounded-md border bg-card">
              <div className="grid grid-cols-6 border-b bg-muted/40 p-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <div className="col-span-2">Campaign</div>
                <div>Status</div>
                <div>Audience</div>
                <div>Sent</div>
                <div className="text-right">Open Rate</div>
              </div>
              <div className="divide-y">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="grid grid-cols-6 items-center p-4 text-sm hover:bg-muted/10 transition-colors">
                    <div className="col-span-2">
                      <div className="font-medium">{campaign.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Gift className="h-3 w-3" /> {campaign.voucher}
                      </div>
                    </div>
                    <div>
                      <Badge variant={
                        campaign.status === 'Active' ? 'default' : 
                        campaign.status === 'Scheduled' ? 'secondary' : 'outline'
                      } className="font-normal">
                        {campaign.status}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2">
                      <Users className="h-3 w-3" /> {campaign.audience}
                    </div>
                    <div className="font-mono text-muted-foreground">
                      {campaign.sent > 0 ? campaign.sent.toLocaleString() : '-'}
                    </div>
                    <div className="text-right font-medium">
                      {campaign.openRate}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
