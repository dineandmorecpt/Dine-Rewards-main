import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Gift, Settings, Save, UserPlus, Trash2, Mail, Download, QrCode, Building2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useBranch } from "@/hooks/use-branch";
import { QRCodeCanvas } from "qrcode.react";

export default function AdminSettings() {
  const [voucherValue, setVoucherValue] = useState("R100 Loyalty Voucher");
  const [voucherValidityDays, setVoucherValidityDays] = useState<number | string>(30);
  const [pointsPerCurrency, setPointsPerCurrency] = useState<number | string>(1);
  const [pointsThreshold, setPointsThreshold] = useState<number | string>(1000);
  const [loyaltyScope, setLoyaltyScope] = useState<"organization" | "branch">("organization");
  const [voucherScope, setVoucherScope] = useState<"organization" | "branch">("organization");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { portalRole, restaurant } = useAuth();
  const restaurantId = restaurant?.id;
  
  const canManageUsers = portalRole === 'owner';
  const { branches, hasMultipleBranches } = useBranch();
  
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"manager" | "staff">("staff");
  const [newUserHasAllAccess, setNewUserHasAllAccess] = useState(true);
  const [newUserBranchIds, setNewUserBranchIds] = useState<string[]>([]);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [editBranchDialogOpen, setEditBranchDialogOpen] = useState(false);
  const [editingPortalUser, setEditingPortalUser] = useState<any>(null);
  const [editBranchIds, setEditBranchIds] = useState<string[]>([]);
  const [editHasAllAccess, setEditHasAllAccess] = useState(true);
  
  const registrationUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/register` 
    : '/register';
  
  const downloadQRCode = () => {
    const canvas = document.querySelector('#registration-qr-code canvas') as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'dine-and-more-registration-qr.png';
      link.href = url;
      link.click();
      toast({
        title: "QR Code Downloaded",
        description: "The registration QR code has been saved as a PNG file."
      });
    }
  };

  const portalUsersQuery = useQuery({
    queryKey: ['portal-users', restaurantId],
    queryFn: async () => {
      const res = await fetch(`/api/restaurants/${restaurantId}/portal-users`);
      if (!res.ok) throw new Error('Failed to fetch portal users');
      return res.json();
    },
    enabled: !!restaurantId
  });
  
  const addPortalUser = useMutation({
    mutationFn: async ({ email, name, role, hasAllBranchAccess, branchIds }: { email: string; name: string; role: string; hasAllBranchAccess: boolean; branchIds: string[] }) => {
      const res = await fetch(`/api/restaurants/${restaurantId}/portal-users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role, hasAllBranchAccess, branchIds })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add user");
      }
      return res.json();
    },
    onSuccess: () => {
      portalUsersQuery.refetch();
      setNewUserEmail("");
      setNewUserName("");
      setNewUserRole("staff");
      setNewUserHasAllAccess(true);
      setNewUserBranchIds([]);
      setAddUserDialogOpen(false);
      toast({
        title: "User Added",
        description: "The user has been added to your portal."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add User",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateBranchAccess = useMutation({
    mutationFn: async ({ portalUserId, hasAllBranchAccess, branchIds }: { portalUserId: string; hasAllBranchAccess: boolean; branchIds: string[] }) => {
      const res = await fetch(`/api/restaurants/${restaurantId}/portal-users/${portalUserId}/branch-access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasAllBranchAccess, branchIds })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update branch access");
      }
      return res.json();
    },
    onSuccess: () => {
      portalUsersQuery.refetch();
      setEditBranchDialogOpen(false);
      setEditingPortalUser(null);
      toast({
        title: "Branch Access Updated",
        description: "The user's branch access has been updated."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const removePortalUser = useMutation({
    mutationFn: async (portalUserId: string) => {
      const res = await fetch(`/api/restaurants/${restaurantId}/portal-users/${portalUserId}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to remove user");
      return res.json();
    },
    onSuccess: () => {
      portalUsersQuery.refetch();
      toast({
        title: "User Removed",
        description: "The user has been removed from your portal."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Remove User",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    fetch(`/api/restaurants/${restaurantId}`)
      .then(res => res.json())
      .then(data => {
        if (data) {
          setVoucherValue(data.voucherValue || "R100 Loyalty Voucher");
          setVoucherValidityDays(data.voucherValidityDays || 30);
          setPointsPerCurrency(data.pointsPerCurrency || 1);
          setPointsThreshold(data.pointsThreshold || 1000);
          setLoyaltyScope(data.loyaltyScope || "organization");
          setVoucherScope(data.voucherScope || "organization");
        }
      })
      .catch(err => console.error("Failed to load settings:", err));
  }, []);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/restaurants/${restaurantId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voucherValue,
          voucherValidityDays,
          pointsPerCurrency,
          pointsThreshold,
          loyaltyScope,
          voucherScope
        })
      });
      if (response.ok) {
        toast({
          title: "Settings saved",
          description: "Your reward settings have been updated successfully."
        });
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Configure your restaurant's loyalty program and manage team access.</p>
        </div>

        <Tabs defaultValue="voucher" className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-[500px]">
            <TabsTrigger value="voucher">Voucher Config</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="qr">QR Codes</TabsTrigger>
          </TabsList>

          {/* VOUCHER CONFIGURATION TAB */}
          <TabsContent value="voucher" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="h-5 w-5" />
                    Loyalty Voucher Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure the voucher that diners receive when they reach the points threshold.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="voucher-value">Voucher Value / Title</Label>
                    <Input
                      id="voucher-value"
                      data-testid="input-voucher-value"
                      value={voucherValue}
                      onChange={(e) => setVoucherValue(e.target.value)}
                      placeholder="e.g., R100 Loyalty Voucher"
                    />
                    <p className="text-xs text-muted-foreground">
                      This is what diners will see on their voucher (e.g., "R100 Off Your Bill")
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="validity-days">Voucher Validity (Days)</Label>
                    <Input
                      id="validity-days"
                      data-testid="input-validity-days"
                      type="number"
                      min={1}
                      max={365}
                      value={voucherValidityDays}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVoucherValidityDays(val === '' ? '' : parseInt(val) || '');
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Voucher expires this many days after it is created
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Points Calculation Rules
                  </CardTitle>
                  <CardDescription>
                    Configure how diners earn points and when vouchers are generated.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="points-per-currency">Points per R1 Spent</Label>
                    <Input
                      id="points-per-currency"
                      data-testid="input-points-per-currency"
                      type="number"
                      min={1}
                      max={100}
                      value={pointsPerCurrency}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPointsPerCurrency(val === '' ? '' : parseInt(val) || '');
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Number of points diners earn for each R1 spent
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="points-threshold">Points Threshold for Voucher</Label>
                    <Input
                      id="points-threshold"
                      data-testid="input-points-threshold"
                      type="number"
                      min={100}
                      max={10000}
                      value={pointsThreshold}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPointsThreshold(val === '' ? '' : parseInt(val) || '');
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Points required to automatically generate a voucher
                    </p>
                  </div>
                  <div className="grid gap-2 pt-2 border-t">
                    <Label htmlFor="loyalty-scope">Points Accumulation</Label>
                    <Select
                      value={loyaltyScope}
                      onValueChange={(value: "organization" | "branch") => setLoyaltyScope(value)}
                    >
                      <SelectTrigger id="loyalty-scope" data-testid="select-loyalty-scope">
                        <SelectValue placeholder="Select scope" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="organization">Across all branches</SelectItem>
                        <SelectItem value="branch">Per branch only</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {loyaltyScope === "organization" 
                        ? "Points earned at any branch count towards the same balance" 
                        : "Each branch tracks its own separate points balance"}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="voucher-scope">Voucher Redemption</Label>
                    <Select
                      value={voucherScope}
                      onValueChange={(value: "organization" | "branch") => setVoucherScope(value)}
                    >
                      <SelectTrigger id="voucher-scope" data-testid="select-voucher-scope">
                        <SelectValue placeholder="Select scope" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="organization">Redeemable at all branches</SelectItem>
                        <SelectItem value="branch">Only at issuing branch</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {voucherScope === "organization" 
                        ? "Vouchers can be redeemed at any of your branches" 
                        : "Vouchers can only be redeemed at the branch where they were earned"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Button
                data-testid="button-save-settings"
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="w-full gap-2 md:col-span-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </TabsContent>

          {/* USER MANAGEMENT TAB */}
          <TabsContent value="users" className="space-y-6">
            {canManageUsers ? (
              <>
              <Card className="max-w-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Portal User Management
                  </CardTitle>
                  <CardDescription>
                    Add or remove users who can access this restaurant's admin portal.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full gap-2" data-testid="button-add-user">
                        <UserPlus className="h-4 w-4" />
                        Add User
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Portal User</DialogTitle>
                        <DialogDescription>
                          Add a new user who can access this restaurant's admin portal.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="new-user-name">Name</Label>
                          <Input
                            id="new-user-name"
                            placeholder="e.g., John Smith"
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            data-testid="input-new-user-name"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="new-user-email">Email</Label>
                          <Input
                            id="new-user-email"
                            type="email"
                            placeholder="e.g., john@example.com"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            data-testid="input-new-user-email"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="new-user-role">Role</Label>
                          <Select value={newUserRole} onValueChange={(val: "manager" | "staff") => setNewUserRole(val)}>
                            <SelectTrigger data-testid="select-new-user-role">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="staff">Staff</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Managers have full access; Staff can only record transactions and redeem vouchers.
                          </p>
                        </div>
                        {hasMultipleBranches && (
                          <div className="grid gap-2">
                            <Label>Branch Access</Label>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="new-user-all-branches"
                                checked={newUserHasAllAccess}
                                onCheckedChange={(checked) => {
                                  setNewUserHasAllAccess(!!checked);
                                  if (checked) setNewUserBranchIds([]);
                                }}
                                data-testid="checkbox-all-branches"
                              />
                              <Label htmlFor="new-user-all-branches" className="text-sm font-normal">
                                Access to all branches
                              </Label>
                            </div>
                            {!newUserHasAllAccess && (
                              <div className="space-y-2 pl-6 mt-2">
                                {branches.map((branch) => (
                                  <div key={branch.id} className="flex items-center gap-2">
                                    <Checkbox
                                      id={`new-branch-${branch.id}`}
                                      checked={newUserBranchIds.includes(branch.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setNewUserBranchIds([...newUserBranchIds, branch.id]);
                                        } else {
                                          setNewUserBranchIds(newUserBranchIds.filter(id => id !== branch.id));
                                        }
                                      }}
                                      data-testid={`checkbox-branch-${branch.id}`}
                                    />
                                    <Label htmlFor={`new-branch-${branch.id}`} className="text-sm font-normal">
                                      {branch.name}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => addPortalUser.mutate({ 
                            email: newUserEmail, 
                            name: newUserName, 
                            role: newUserRole,
                            hasAllBranchAccess: newUserHasAllAccess,
                            branchIds: newUserBranchIds
                          })}
                          disabled={!newUserEmail.trim() || !newUserName.trim() || addPortalUser.isPending || (!newUserHasAllAccess && newUserBranchIds.length === 0)}
                          className="gap-2"
                          data-testid="button-confirm-add-user"
                        >
                          {addPortalUser.isPending ? "Adding..." : "Add User"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <div className="space-y-2">
                    {portalUsersQuery.isLoading && (
                      <p className="text-sm text-muted-foreground text-center py-4">Loading users...</p>
                    )}
                    {portalUsersQuery.data?.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No additional users added yet.</p>
                    )}
                    {portalUsersQuery.data?.map((pu: any) => (
                      <div 
                        key={pu.id} 
                        className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                        data-testid={`portal-user-${pu.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {pu.user?.name?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium">{pu.user?.name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {pu.user?.email || 'No email'}
                            </p>
                            {hasMultipleBranches && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Building2 className="h-3 w-3" />
                                {pu.hasAllBranchAccess ? 'All branches' : 
                                  (pu.branchNames?.length > 0 ? pu.branchNames.join(', ') : 'No branches assigned')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="capitalize">{pu.role}</Badge>
                          {hasMultipleBranches && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingPortalUser(pu);
                                setEditHasAllAccess(pu.hasAllBranchAccess ?? true);
                                setEditBranchIds(pu.branchIds ?? []);
                                setEditBranchDialogOpen(true);
                              }}
                              data-testid={`button-edit-branches-${pu.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removePortalUser.mutate(pu.id)}
                            disabled={removePortalUser.isPending}
                            data-testid={`button-remove-user-${pu.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Edit Branch Access Dialog */}
              <Dialog open={editBranchDialogOpen} onOpenChange={setEditBranchDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Branch Access</DialogTitle>
                    <DialogDescription>
                      Update branch access for {editingPortalUser?.user?.name || 'this user'}.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="edit-all-branches"
                        checked={editHasAllAccess}
                        onCheckedChange={(checked) => {
                          setEditHasAllAccess(!!checked);
                          if (checked) setEditBranchIds([]);
                        }}
                        data-testid="checkbox-edit-all-branches"
                      />
                      <Label htmlFor="edit-all-branches" className="text-sm font-normal">
                        Access to all branches
                      </Label>
                    </div>
                    {!editHasAllAccess && (
                      <div className="space-y-2 pl-6">
                        {branches.map((branch) => (
                          <div key={branch.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`edit-branch-${branch.id}`}
                              checked={editBranchIds.includes(branch.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setEditBranchIds([...editBranchIds, branch.id]);
                                } else {
                                  setEditBranchIds(editBranchIds.filter(id => id !== branch.id));
                                }
                              }}
                              data-testid={`checkbox-edit-branch-${branch.id}`}
                            />
                            <Label htmlFor={`edit-branch-${branch.id}`} className="text-sm font-normal">
                              {branch.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditBranchDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        if (editingPortalUser) {
                          updateBranchAccess.mutate({
                            portalUserId: editingPortalUser.id,
                            hasAllBranchAccess: editHasAllAccess,
                            branchIds: editBranchIds
                          });
                        }
                      }}
                      disabled={updateBranchAccess.isPending || (!editHasAllAccess && editBranchIds.length === 0)}
                      data-testid="button-save-branch-access"
                    >
                      {updateBranchAccess.isPending ? "Saving..." : "Save"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              </>
            ) : (
              <Card className="max-w-2xl">
                <CardHeader className="text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <CardTitle>Access Restricted</CardTitle>
                  <CardDescription>
                    Only the restaurant owner can manage portal users. Please contact your administrator.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>

          {/* QR CODES TAB */}
          <TabsContent value="qr" className="space-y-6">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  Registration QR Code
                </CardTitle>
                <CardDescription>
                  Display this QR code at your restaurant so customers can scan and register for your loyalty program.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div id="registration-qr-code" className="flex justify-center p-4 bg-white rounded-lg">
                  <QRCodeCanvas
                    value={registrationUrl}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground break-all">
                  {registrationUrl}
                </p>
                <Button
                  onClick={downloadQRCode}
                  variant="outline"
                  className="w-full gap-2"
                  data-testid="button-download-qr"
                >
                  <Download className="h-4 w-4" />
                  Download QR Code (PNG)
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
