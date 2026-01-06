import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserPlus, Mail, Phone, Coins, Calendar, Trash2, Loader2, Shield, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";

interface RegisteredDiner {
  id: string;
  name: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  currentPoints: number;
  totalVouchersGenerated: number;
  availableVoucherCredits: number;
  lastTransactionDate: string | null;
  createdAt: string;
}

interface PortalUser {
  id: string;
  restaurantId: string;
  userId: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
}

export default function AdminUsers() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant?.id;
  const queryClient = useQueryClient();
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<"manager" | "staff">("staff");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: diners = [], isLoading: loadingDiners } = useQuery<RegisteredDiner[]>({
    queryKey: ["/api/restaurants", restaurantId, "diners"],
    queryFn: async () => {
      const res = await fetch(`/api/restaurants/${restaurantId}/diners`);
      if (!res.ok) throw new Error("Failed to fetch diners");
      return res.json();
    },
    enabled: !!restaurantId,
  });

  const { data: portalUsers = [], isLoading: loadingPortalUsers } = useQuery<PortalUser[]>({
    queryKey: ["/api/restaurants", restaurantId, "portal-users"],
    queryFn: async () => {
      const res = await fetch(`/api/restaurants/${restaurantId}/portal-users`);
      if (!res.ok) throw new Error("Failed to fetch staff");
      return res.json();
    },
    enabled: !!restaurantId,
  });

  const addStaff = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const res = await fetch(`/api/restaurants/${restaurantId}/portal-users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add staff member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants", restaurantId, "portal-users"] });
      setAddStaffOpen(false);
      setNewStaffEmail("");
      setNewStaffRole("staff");
      toast({
        title: "Staff member added",
        description: "They can now access the restaurant portal.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add staff",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeStaff = useMutation({
    mutationFn: async (portalUserId: string) => {
      const res = await fetch(`/api/restaurants/${restaurantId}/portal-users/${portalUserId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to remove staff member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants", restaurantId, "portal-users"] });
      toast({
        title: "Staff member removed",
        description: "They no longer have access to the restaurant portal.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove staff",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredDiners = diners.filter(diner => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      diner.name.toLowerCase().includes(query) ||
      (diner.lastName?.toLowerCase() || "").includes(query) ||
      diner.email.toLowerCase().includes(query) ||
      (diner.phone || "").includes(query)
    );
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-serif font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">Manage your registered diners and staff members.</p>
        </div>

        <Tabs defaultValue="diners" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="diners" data-testid="tab-diners">
              <Users className="h-4 w-4 mr-2" />
              Registered Diners
            </TabsTrigger>
            <TabsTrigger value="staff" data-testid="tab-staff">
              <Shield className="h-4 w-4 mr-2" />
              Staff Members
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diners" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Registered Diners</CardTitle>
                    <CardDescription>
                      {diners.length} diner{diners.length !== 1 ? "s" : ""} registered at your restaurant
                    </CardDescription>
                  </div>
                  <div className="w-full sm:w-64">
                    <Input
                      placeholder="Search diners..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-search-diners"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingDiners ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredDiners.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">
                      {searchQuery ? "No diners match your search" : "No diners registered yet"}
                    </p>
                    {!searchQuery && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Invite customers from the Dashboard to grow your rewards program
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead className="text-right">Points</TableHead>
                          <TableHead className="text-right">Credits</TableHead>
                          <TableHead className="text-right">Vouchers</TableHead>
                          <TableHead>Last Visit</TableHead>
                          <TableHead>Joined</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDiners.map((diner) => (
                          <TableRow key={diner.id} data-testid={`row-diner-${diner.id}`}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <User className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <p>{diner.name} {diner.lastName || ""}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Mail className="h-3 w-3" />
                                  <span className="truncate max-w-[150px]">{diner.email}</span>
                                </div>
                                {diner.phone && (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Phone className="h-3 w-3" />
                                    <span>{diner.phone}</span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary" className="font-mono">
                                <Coins className="h-3 w-3 mr-1" />
                                {diner.currentPoints}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className="font-mono">
                                {diner.availableVoucherCredits}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-muted-foreground">{diner.totalVouchersGenerated}</span>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDate(diner.lastTransactionDate)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDate(diner.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="staff" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Staff Members</CardTitle>
                    <CardDescription>
                      Manage team members who can access the restaurant portal
                    </CardDescription>
                  </div>
                  <Dialog open={addStaffOpen} onOpenChange={setAddStaffOpen}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-add-staff">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Staff Member
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Staff Member</DialogTitle>
                        <DialogDescription>
                          Add an existing restaurant admin to your team. They must already have an account.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="staff-email">Email Address</Label>
                          <Input
                            id="staff-email"
                            type="email"
                            placeholder="staff@example.com"
                            value={newStaffEmail}
                            onChange={(e) => setNewStaffEmail(e.target.value)}
                            data-testid="input-staff-email"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="staff-role">Role</Label>
                          <Select value={newStaffRole} onValueChange={(v) => setNewStaffRole(v as "manager" | "staff")}>
                            <SelectTrigger data-testid="select-staff-role">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="staff">Staff</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Managers can manage vouchers and view reports. Staff can process transactions.
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setAddStaffOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={() => addStaff.mutate({ email: newStaffEmail, role: newStaffRole })}
                          disabled={!newStaffEmail || addStaff.isPending}
                          data-testid="button-confirm-add-staff"
                        >
                          {addStaff.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            "Add Staff Member"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {loadingPortalUsers ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : portalUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No additional staff members</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add team members to help manage your restaurant
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Added</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {portalUsers.map((pu) => (
                          <TableRow key={pu.id} data-testid={`row-staff-${pu.id}`}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Shield className="h-4 w-4 text-primary" />
                                </div>
                                <span>{pu.user.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {pu.user.email}
                            </TableCell>
                            <TableCell>
                              <Badge variant={pu.role === "manager" ? "default" : "secondary"}>
                                {pu.role.charAt(0).toUpperCase() + pu.role.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDate(pu.createdAt)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeStaff.mutate(pu.id)}
                                disabled={removeStaff.isPending}
                                data-testid={`button-remove-staff-${pu.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
