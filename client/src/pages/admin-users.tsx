import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, Trash2, Loader2, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";

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
          <h1 className="text-3xl font-serif font-bold text-foreground">Portal Users</h1>
          <p className="text-muted-foreground">Manage team members who can access the restaurant portal.</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Staff Members</CardTitle>
                <CardDescription>
                  {portalUsers.length} team member{portalUsers.length !== 1 ? "s" : ""} with portal access
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
      </div>
    </AdminLayout>
  );
}
