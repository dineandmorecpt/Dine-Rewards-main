import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Building2, MapPin, Phone, Globe, Facebook, Instagram, Twitter, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

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

export default function AdminProfile() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant?.id;
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    if (!restaurantId) {
      setIsLoading(false);
      return;
    }
    
    fetch(`/api/restaurants/${restaurantId}`)
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
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to load restaurant data:", err);
        setIsLoading(false);
      });
  }, [restaurantId]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!restaurantId) return;
    
    setIsSaving(true);
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
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
    </AdminLayout>
  );
}
