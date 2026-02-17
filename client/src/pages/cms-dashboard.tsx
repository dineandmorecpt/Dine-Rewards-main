import { useQuery } from "@tanstack/react-query";
import { CmsLayout } from "@/components/layout/cms-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, FolderSync, CheckCircle, Loader2 } from "lucide-react";

export default function CmsDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/cms/dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/cms/dashboard", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  return (
    <CmsLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Platform overview and key metrics</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card data-testid="card-restaurants">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Restaurants</CardTitle>
              <Building2 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="text-restaurant-count">{stats?.restaurantCount ?? 0}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-diners">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Diners</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="text-diner-count">{stats?.dinerCount ?? 0}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-ftp">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">FTP Configured</CardTitle>
              <FolderSync className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="text-ftp-count">{stats?.ftpConfiguredCount ?? 0}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-active">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Restaurants</CardTitle>
              <CheckCircle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="text-active-count">{stats?.activeRestaurants ?? 0}</div>
            </CardContent>
          </Card>
        </div>
      )}
    </CmsLayout>
  );
}
