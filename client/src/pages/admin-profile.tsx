import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Building2, MapPin, Phone, Globe, Facebook, Instagram, Twitter, Save, Loader2, Upload, Image as ImageIcon, Plus, Pencil, Trash2, Star, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useUpload } from "@/hooks/use-upload";
import { getStoredAuth } from "@/lib/queryClient";

function getAuthHeaders(): Record<string, string> {
  const auth = getStoredAuth();
  if (auth) {
    return { "X-User-Id": auth.userId, "X-User-Type": auth.userType };
  }
  return {};
}

const cuisineTypes = [
  "African",
  "American",
  "Asian Fusion",
  "Bakery & Cafe",
  "Brazilian",
  "Chinese",
  "Ethiopian",
  "Fast Food",
  "Fine Dining",
  "French",
  "Greek",
  "Indian",
  "Italian",
  "Japanese",
  "Korean",
  "Mediterranean",
  "Mexican",
  "Middle Eastern",
  "Pizza",
  "Portuguese",
  "Seafood",
  "South African",
  "Steakhouse",
  "Sushi",
  "Thai",
  "Turkish",
  "Vegetarian/Vegan",
  "Vietnamese",
  "Other"
];

const provinces = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape"
];

interface Branch {
  id: string;
  restaurantId: string;
  name: string;
  address: string | null;
  phone: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

interface BranchFormData {
  name: string;
  address: string;
  phone: string;
  isDefault: boolean;
  isActive: boolean;
}

const emptyBranchForm: BranchFormData = {
  name: "",
  address: "",
  phone: "",
  isDefault: false,
  isActive: true,
};

export default function AdminProfile() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant?.id;
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      setLogoUrl(response.objectPath);
      toast({
        title: "Logo Uploaded",
        description: "Your logo has been uploaded successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [formData, setFormData] = useState({
    name: "",
    tradingName: "",
    description: "",
    cuisineType: "",
    registrationNumber: "",
    vatNumber: "",
    streetAddress: "",
    city: "",
    province: "",
    postalCode: "",
    country: "South Africa",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    websiteUrl: "",
    facebookUrl: "",
    instagramUrl: "",
    twitterUrl: "",
    businessHours: "",
  });

  // Branch management state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchForm, setBranchForm] = useState<BranchFormData>(emptyBranchForm);
  const [isSavingBranch, setIsSavingBranch] = useState(false);
  const [deleteBranchId, setDeleteBranchId] = useState<string | null>(null);
  const [isDeletingBranch, setIsDeletingBranch] = useState(false);

  const loadBranches = async () => {
    if (!restaurantId) return;
    setIsLoadingBranches(true);
    try {
      const res = await fetch(`/api/admin/branches`, { credentials: "include", headers: getAuthHeaders() });
      const data = await res.json();
      setBranches(data);
    } catch (err) {
      console.error("Failed to load branches:", err);
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const handleOpenBranchDialog = (branch?: Branch) => {
    if (branch) {
      setEditingBranch(branch);
      setBranchForm({
        name: branch.name,
        address: branch.address || "",
        phone: branch.phone || "",
        isDefault: branch.isDefault,
        isActive: branch.isActive,
      });
    } else {
      setEditingBranch(null);
      setBranchForm(emptyBranchForm);
    }
    setBranchDialogOpen(true);
  };

  const handleSaveBranch = async () => {
    if (!restaurantId || !branchForm.name.trim()) return;
    
    setIsSavingBranch(true);
    try {
      const url = editingBranch
        ? `/api/admin/branches/${editingBranch.id}`
        : `/api/admin/branches`;
      
      const res = await fetch(url, {
        method: editingBranch ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify(branchForm),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save branch");
      }

      toast({
        title: editingBranch ? "Branch Updated" : "Branch Created",
        description: `${branchForm.name} has been ${editingBranch ? "updated" : "created"} successfully.`,
      });

      setBranchDialogOpen(false);
      loadBranches();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingBranch(false);
    }
  };

  const handleDeleteBranch = async () => {
    if (!restaurantId || !deleteBranchId) return;
    
    setIsDeletingBranch(true);
    try {
      const res = await fetch(`/api/admin/branches/${deleteBranchId}`, {
        method: "DELETE",
        credentials: "include",
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete branch");
      }

      toast({
        title: "Branch Deleted",
        description: "The branch has been deleted successfully.",
      });

      setDeleteBranchId(null);
      loadBranches();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeletingBranch(false);
    }
  };

  const handleSetDefault = async (branchId: string) => {
    if (!restaurantId) return;
    
    try {
      const res = await fetch(`/api/admin/branches/${branchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ isDefault: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to set default branch");
      }

      toast({
        title: "Default Branch Updated",
        description: "The default branch has been updated.",
      });

      loadBranches();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!restaurantId) {
      setIsLoading(false);
      return;
    }
    
    fetch(`/api/admin/restaurant`)
      .then(res => res.json())
      .then(data => {
        if (data) {
          setFormData({
            name: data.name || "",
            tradingName: data.tradingName || "",
            description: data.description || "",
            cuisineType: data.cuisineType || "",
            registrationNumber: data.registrationNumber || "",
            vatNumber: data.vatNumber || "",
            streetAddress: data.streetAddress || "",
            city: data.city || "",
            province: data.province || "",
            postalCode: data.postalCode || "",
            country: data.country || "South Africa",
            contactName: data.contactName || "",
            contactEmail: data.contactEmail || "",
            contactPhone: data.contactPhone || "",
            websiteUrl: data.websiteUrl || "",
            facebookUrl: data.facebookUrl || "",
            instagramUrl: data.instagramUrl || "",
            twitterUrl: data.twitterUrl || "",
            businessHours: data.businessHours || "",
          });
          setLogoUrl(data.logoUrl || "");
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to load restaurant data:", err);
        setIsLoading(false);
      });
  }, [restaurantId]);

  // Load branches
  useEffect(() => {
    if (restaurantId) {
      loadBranches();
    }
  }, [restaurantId]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!restaurantId) return;
    
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/restaurant/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ ...formData, logoUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save profile");
      }

      toast({
        title: "Profile Saved",
        description: "Your business profile has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!restaurantId) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No Restaurant Found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Your account is not associated with a restaurant.
          </p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Business Profile</h2>
            <p className="text-muted-foreground">
              Manage your restaurant's business information and public profile.
            </p>
          </div>
          <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-profile">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Business Details
              </CardTitle>
              <CardDescription>
                Basic information about your business
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Business Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/50 overflow-hidden">
                    {logoUrl ? (
                      <img 
                        src={logoUrl} 
                        alt="Business logo" 
                        className="h-full w-full object-cover"
                        data-testid="img-logo-preview"
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          uploadFile(file);
                        }
                      }}
                      data-testid="input-logo-file"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      data-testid="button-upload-logo"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Logo
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Recommended: 200x200px, PNG or JPG
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="name">Business Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Legal business name"
                  data-testid="input-business-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="tradingName">Trading Name</Label>
                <Input
                  id="tradingName"
                  value={formData.tradingName}
                  onChange={(e) => handleInputChange("tradingName", e.target.value)}
                  placeholder="Trading name (if different)"
                  data-testid="input-trading-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">About Your Business</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Describe your restaurant, cuisine, atmosphere..."
                  rows={4}
                  data-testid="input-description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cuisineType">Cuisine Type</Label>
                <Select
                  value={formData.cuisineType}
                  onValueChange={(value) => handleInputChange("cuisineType", value)}
                >
                  <SelectTrigger data-testid="select-cuisine-type">
                    <SelectValue placeholder="Select cuisine type" />
                  </SelectTrigger>
                  <SelectContent>
                    {cuisineTypes.map((cuisine) => (
                      <SelectItem key={cuisine} value={cuisine}>
                        {cuisine}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="registrationNumber">Company Registration Number</Label>
                <Input
                  id="registrationNumber"
                  value={formData.registrationNumber}
                  onChange={(e) => handleInputChange("registrationNumber", e.target.value)}
                  placeholder="e.g., 2023/123456/07"
                  data-testid="input-registration-number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vatNumber">VAT Number</Label>
                <Input
                  id="vatNumber"
                  value={formData.vatNumber}
                  onChange={(e) => handleInputChange("vatNumber", e.target.value)}
                  placeholder="e.g., 4123456789"
                  data-testid="input-vat-number"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Business Address
              </CardTitle>
              <CardDescription>
                Your main business location
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="streetAddress">Street Address</Label>
                <Input
                  id="streetAddress"
                  value={formData.streetAddress}
                  onChange={(e) => handleInputChange("streetAddress", e.target.value)}
                  placeholder="123 Main Street"
                  data-testid="input-street-address"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                    placeholder="Johannesburg"
                    data-testid="input-city"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input
                    id="postalCode"
                    value={formData.postalCode}
                    onChange={(e) => handleInputChange("postalCode", e.target.value)}
                    placeholder="2000"
                    data-testid="input-postal-code"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="province">Province</Label>
                  <Select
                    value={formData.province}
                    onValueChange={(value) => handleInputChange("province", value)}
                  >
                    <SelectTrigger data-testid="select-province">
                      <SelectValue placeholder="Select province" />
                    </SelectTrigger>
                    <SelectContent>
                      {provinces.map((province) => (
                        <SelectItem key={province} value={province}>
                          {province}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleInputChange("country", e.target.value)}
                    placeholder="South Africa"
                    data-testid="input-country"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Contact Information
              </CardTitle>
              <CardDescription>
                Primary contact details for your business
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contactName">Contact Person</Label>
                <Input
                  id="contactName"
                  value={formData.contactName}
                  onChange={(e) => handleInputChange("contactName", e.target.value)}
                  placeholder="Full name"
                  data-testid="input-contact-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email Address</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => handleInputChange("contactEmail", e.target.value)}
                  placeholder="email@restaurant.com"
                  data-testid="input-contact-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactPhone">Phone Number</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => handleInputChange("contactPhone", e.target.value)}
                  placeholder="+27 12 345 6789"
                  data-testid="input-contact-phone"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="businessHours">Business Hours</Label>
                <Textarea
                  id="businessHours"
                  value={formData.businessHours}
                  onChange={(e) => handleInputChange("businessHours", e.target.value)}
                  placeholder="Mon-Fri: 9am-10pm&#10;Sat-Sun: 10am-11pm"
                  rows={3}
                  data-testid="input-business-hours"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Online Presence
              </CardTitle>
              <CardDescription>
                Website and social media links
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="websiteUrl">Website</Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(e) => handleInputChange("websiteUrl", e.target.value)}
                  placeholder="https://www.yourrestaurant.co.za"
                  data-testid="input-website-url"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="facebookUrl" className="flex items-center gap-2">
                  <Facebook className="h-4 w-4 text-blue-600" />
                  Facebook
                </Label>
                <Input
                  id="facebookUrl"
                  type="url"
                  value={formData.facebookUrl}
                  onChange={(e) => handleInputChange("facebookUrl", e.target.value)}
                  placeholder="https://facebook.com/yourrestaurant"
                  data-testid="input-facebook-url"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instagramUrl" className="flex items-center gap-2">
                  <Instagram className="h-4 w-4 text-pink-600" />
                  Instagram
                </Label>
                <Input
                  id="instagramUrl"
                  type="url"
                  value={formData.instagramUrl}
                  onChange={(e) => handleInputChange("instagramUrl", e.target.value)}
                  placeholder="https://instagram.com/yourrestaurant"
                  data-testid="input-instagram-url"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitterUrl" className="flex items-center gap-2">
                  <Twitter className="h-4 w-4 text-sky-500" />
                  Twitter / X
                </Label>
                <Input
                  id="twitterUrl"
                  type="url"
                  value={formData.twitterUrl}
                  onChange={(e) => handleInputChange("twitterUrl", e.target.value)}
                  placeholder="https://twitter.com/yourrestaurant"
                  data-testid="input-twitter-url"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Branch Management Section */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Branch Locations
                </CardTitle>
                <CardDescription>
                  Manage your restaurant's branch locations
                </CardDescription>
              </div>
              <Button onClick={() => handleOpenBranchDialog()} data-testid="button-add-branch">
                <Plus className="mr-2 h-4 w-4" />
                Add Branch
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingBranches ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : branches.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No branches found. Add your first branch location.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {branches.map((branch) => (
                  <div
                    key={branch.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-card"
                    data-testid={`branch-item-${branch.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{branch.name}</span>
                        {branch.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Default
                          </Badge>
                        )}
                        {!branch.isActive && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      {branch.address && (
                        <p className="text-sm text-muted-foreground mt-1">{branch.address}</p>
                      )}
                      {branch.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {branch.phone}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!branch.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(branch.id)}
                          title="Set as default"
                          data-testid={`button-set-default-${branch.id}`}
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenBranchDialog(branch)}
                        data-testid={`button-edit-branch-${branch.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!branch.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteBranchId(branch.id)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-delete-branch-${branch.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} size="lg" data-testid="button-save-profile-bottom">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save All Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Branch Dialog */}
      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBranch ? "Edit Branch" : "Add New Branch"}
            </DialogTitle>
            <DialogDescription>
              {editingBranch
                ? "Update the branch details below."
                : "Enter the details for your new branch location."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="branchName">Branch Name *</Label>
              <Input
                id="branchName"
                value={branchForm.name}
                onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                placeholder="e.g., Sandton City Branch"
                data-testid="input-branch-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branchAddress">Address</Label>
              <Input
                id="branchAddress"
                value={branchForm.address}
                onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                placeholder="e.g., 123 Main Street, Sandton"
                data-testid="input-branch-address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branchPhone">Phone Number</Label>
              <Input
                id="branchPhone"
                value={branchForm.phone}
                onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                placeholder="e.g., 011 123 4567"
                data-testid="input-branch-phone"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="branchActive">Active Branch</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive branches won't accept transactions
                </p>
              </div>
              <Switch
                id="branchActive"
                checked={branchForm.isActive}
                onCheckedChange={(checked) => setBranchForm({ ...branchForm, isActive: checked })}
                data-testid="switch-branch-active"
              />
            </div>
            {!editingBranch && branches.length === 0 && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="branchDefault">Set as Default</Label>
                  <p className="text-sm text-muted-foreground">
                    First branch will be set as default
                  </p>
                </div>
                <Switch
                  id="branchDefault"
                  checked={branchForm.isDefault || branches.length === 0}
                  disabled={branches.length === 0}
                  onCheckedChange={(checked) => setBranchForm({ ...branchForm, isDefault: checked })}
                  data-testid="switch-branch-default"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBranchDialogOpen(false)}
              data-testid="button-cancel-branch"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveBranch}
              disabled={isSavingBranch || !branchForm.name.trim()}
              data-testid="button-save-branch"
            >
              {isSavingBranch ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                editingBranch ? "Update Branch" : "Create Branch"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Branch Confirmation */}
      <AlertDialog open={!!deleteBranchId} onOpenChange={(open) => !open && setDeleteBranchId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Branch</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this branch? This action cannot be undone.
              All transactions and data associated with this branch will be preserved but the branch will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-branch">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBranch}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingBranch}
              data-testid="button-confirm-delete-branch"
            >
              {isDeletingBranch ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Branch"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
