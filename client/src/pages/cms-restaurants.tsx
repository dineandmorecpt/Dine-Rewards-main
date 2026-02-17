import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CmsLayout } from "@/components/layout/cms-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Building2, FolderSync, Pencil, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Restaurant {
  id: string;
  name: string;
  tradingName: string | null;
  onboardingStatus: string;
  ftpPath: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  city: string | null;
  province: string | null;
  dinerDiscoveryEnabled: boolean;
  createdAt: string;
}

export default function CmsRestaurants() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [ftpPath, setFtpPath] = useState("");

  const { data: restaurants, isLoading } = useQuery<Restaurant[]>({
    queryKey: ["/api/cms/restaurants"],
    queryFn: async () => {
      const res = await fetch("/api/cms/restaurants", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const updateFtpMutation = useMutation({
    mutationFn: async ({ id, ftpPath }: { id: string; ftpPath: string | null }) => {
      const res = await fetch(`/api/cms/restaurants/${id}/ftp-path`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ftpPath }),
      });
      if (!res.ok) throw new Error("Failed to update FTP path");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cms/restaurants"] });
      toast({ title: "FTP path updated" });
      setEditingRestaurant(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filtered = restaurants?.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.tradingName?.toLowerCase().includes(search.toLowerCase()) ||
      r.city?.toLowerCase().includes(search.toLowerCase())
  );

  const openFtpEditor = (restaurant: Restaurant) => {
    setEditingRestaurant(restaurant);
    setFtpPath(restaurant.ftpPath || "");
  };

  return (
    <CmsLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-restaurants-title">Restaurants</h1>
          <p className="text-muted-foreground mt-1">Manage all restaurants on the platform</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search restaurants..."
            className="pl-9"
            data-testid="input-search"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered?.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No restaurants found
              </CardContent>
            </Card>
          )}
          {filtered?.map((restaurant) => (
            <Card key={restaurant.id} data-testid={`card-restaurant-${restaurant.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold" data-testid={`text-name-${restaurant.id}`}>{restaurant.name}</div>
                      {restaurant.tradingName && (
                        <div className="text-sm text-muted-foreground">Trading as: {restaurant.tradingName}</div>
                      )}
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        <Badge variant={restaurant.onboardingStatus === "active" ? "default" : "secondary"}>
                          {restaurant.onboardingStatus}
                        </Badge>
                        {restaurant.ftpPath && (
                          <Badge variant="outline" className="text-xs">
                            <FolderSync className="w-3 h-3 mr-1" />
                            FTP: {restaurant.ftpPath}
                          </Badge>
                        )}
                        {restaurant.dinerDiscoveryEnabled && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                            Discovery
                          </Badge>
                        )}
                      </div>
                      {(restaurant.city || restaurant.province) && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {[restaurant.city, restaurant.province].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openFtpEditor(restaurant)}
                    data-testid={`button-edit-ftp-${restaurant.id}`}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    FTP Path
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editingRestaurant} onOpenChange={(open) => !open && setEditingRestaurant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit FTP Path - {editingRestaurant?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="ftpPath">FTP Folder Path</Label>
              <Input
                id="ftpPath"
                value={ftpPath}
                onChange={(e) => setFtpPath(e.target.value)}
                placeholder="/Restaurant Name"
                data-testid="input-ftp-path"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The folder path on the FTP server for this restaurant's CSV files.
                Leave empty to disable FTP imports.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRestaurant(null)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingRestaurant) {
                  updateFtpMutation.mutate({
                    id: editingRestaurant.id,
                    ftpPath: ftpPath.trim() || null,
                  });
                }
              }}
              disabled={updateFtpMutation.isPending}
              data-testid="button-save-ftp"
            >
              {updateFtpMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CmsLayout>
  );
}
