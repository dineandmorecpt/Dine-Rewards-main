import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CmsLayout } from "@/components/layout/cms-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FolderSync, Play, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FtpRestaurantStatus {
  restaurantId: string;
  restaurantName: string;
  ftpPath: string;
  schedulerStatus: {
    nextRun: string | null;
    lastResult: {
      success: boolean;
      filesProcessed: string[];
      filesSkipped: string[];
      errors: string[];
      fetchedAt: string;
    } | null;
  };
}

interface FtpStatusResponse {
  globalStatus: {
    nextRun: string | null;
    isRunning: boolean;
  };
  restaurants: FtpRestaurantStatus[];
}

export default function CmsFtp() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<FtpStatusResponse>({
    queryKey: ["/api/cms/ftp/status"],
    queryFn: async () => {
      const res = await fetch("/api/cms/ftp/status", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load FTP status");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const fetchMutation = useMutation({
    mutationFn: async (restaurantId: string) => {
      const res = await fetch(`/api/cms/ftp/fetch/${restaurantId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fetch failed");
      }
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cms/ftp/status"] });
      toast({
        title: result.success ? "FTP fetch complete" : "FTP fetch completed with errors",
        description: `Files processed: ${result.filesProcessed?.length || 0}, Skipped: ${result.filesSkipped?.length || 0}`,
      });
    },
    onError: (error: any) => {
      toast({ title: "FTP fetch failed", description: error.message, variant: "destructive" });
    },
  });

  const nextRunFormatted = data?.globalStatus?.nextRun
    ? new Date(data.globalStatus.nextRun).toLocaleString()
    : "Not scheduled";

  return (
    <CmsLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-ftp-title">FTP Status</h1>
        <p className="text-muted-foreground mt-1">Monitor automated CSV imports across all restaurants</p>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4 flex items-center gap-4">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Next Scheduled Fetch</div>
            <div className="text-sm text-muted-foreground" data-testid="text-next-run">{nextRunFormatted}</div>
          </div>
          {data?.globalStatus?.isRunning && (
            <Badge className="ml-auto">Running</Badge>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : data?.restaurants.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No restaurants have FTP paths configured.
            Configure FTP paths in the Restaurants section.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data?.restaurants.map((r) => (
            <Card key={r.restaurantId} data-testid={`card-ftp-${r.restaurantId}`}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <FolderSync className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-semibold" data-testid={`text-ftp-name-${r.restaurantId}`}>{r.restaurantName}</div>
                      <div className="text-sm text-muted-foreground">Path: {r.ftpPath}</div>

                      {r.schedulerStatus?.lastResult && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-1.5">
                            {r.schedulerStatus.lastResult.success ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                            )}
                            <span className="text-xs">
                              Last fetch: {new Date(r.schedulerStatus.lastResult.fetchedAt).toLocaleString()}
                            </span>
                          </div>
                          {r.schedulerStatus.lastResult.filesProcessed.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Processed: {r.schedulerStatus.lastResult.filesProcessed.join(", ")}
                            </div>
                          )}
                          {r.schedulerStatus.lastResult.filesSkipped.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Skipped: {r.schedulerStatus.lastResult.filesSkipped.join(", ")}
                            </div>
                          )}
                          {r.schedulerStatus.lastResult.errors.length > 0 && (
                            <div className="text-xs text-red-500">
                              Errors: {r.schedulerStatus.lastResult.errors.join(", ")}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchMutation.mutate(r.restaurantId)}
                    disabled={fetchMutation.isPending}
                    data-testid={`button-fetch-${r.restaurantId}`}
                  >
                    {fetchMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Fetch Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </CmsLayout>
  );
}
