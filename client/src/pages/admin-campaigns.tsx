import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Megaphone, Plus, Send, Trash2, Users, Mail, MessageSquare, Lightbulb, Loader2, AlertTriangle, CheckCircle2, XCircle, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/queryClient";

type Campaign = {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  targetAudience: string;
  message: string;
  status: string;
  sentCount: number | null;
  successCount: number | null;
  failedCount: number | null;
  sentAt: string | null;
  createdAt: string;
};

type Recommendation = {
  id: string;
  name: string;
  description: string;
  channel: string;
  targetAudience: string;
  category: string;
  message: string;
  subject: string | null;
};

const AUDIENCE_LABELS: Record<string, string> = {
  all: "All Diners",
  top_spenders: "Top Spenders",
  new: "New Members",
  lapsed: "Lapsed Diners",
  birthday: "Birthday Month",
};

const CATEGORY_COLORS: Record<string, string> = {
  engagement: "bg-blue-100 text-blue-700",
  retention: "bg-green-100 text-green-700",
  winback: "bg-amber-100 text-amber-700",
  celebration: "bg-purple-100 text-purple-700",
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    sending: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <Badge className={cn("capitalize", styles[status] || styles.draft)} data-testid={`badge-status-${status}`}>
      {status}
    </Badge>
  );
}

function AdminCampaignsContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [showSendConfirm, setShowSendConfirm] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    channel: "sms" as "sms" | "email",
    subject: "",
    targetAudience: "all",
    message: "",
  });

  const campaignsQuery = useQuery<{ campaigns: Campaign[]; quota: { allowed: boolean; remaining: number; limit: number } }>({
    queryKey: ["/api/admin/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/admin/campaigns", {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (res.status === 403) {
        const data = await res.json();
        throw new Error(data.error || "Subscription required");
      }
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      return res.json();
    },
  });

  const recommendationsQuery = useQuery<Recommendation[]>({
    queryKey: ["/api/admin/campaigns/recommendations"],
    queryFn: async () => {
      const res = await fetch("/api/admin/campaigns/recommendations", {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      return res.json();
    },
  });

  const audienceCountQuery = useQuery<{ count: number }>({
    queryKey: ["/api/admin/campaigns/audience-count", form.targetAudience, form.channel],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/campaigns/audience-count?audience=${form.targetAudience}&channel=${form.channel}`,
        { credentials: "include", headers: getAuthHeaders() }
      );
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    enabled: showCreate,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        credentials: "include",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create campaign");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      setShowCreate(false);
      resetForm();
      toast({ title: "Campaign created", description: "Your campaign has been saved as a draft." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/campaigns/${id}/send`, {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send campaign");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      setShowSendConfirm(null);
      toast({
        title: "Campaign sent",
        description: `Sent to ${data.sentCount} recipients. ${data.successCount} successful, ${data.failedCount} failed.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/campaigns/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete campaign");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      setShowDeleteConfirm(null);
      toast({ title: "Campaign deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const detailQuery = useQuery<{ campaign: Campaign; recipients: any[] }>({
    queryKey: ["/api/admin/campaigns", showDetail],
    queryFn: async () => {
      const res = await fetch(`/api/admin/campaigns/${showDetail}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch campaign details");
      return res.json();
    },
    enabled: !!showDetail,
  });

  function resetForm() {
    setForm({ name: "", channel: "sms", subject: "", targetAudience: "all", message: "" });
  }

  function useRecommendation(rec: Recommendation) {
    setForm({
      name: rec.name,
      channel: rec.channel as "sms" | "email",
      subject: rec.subject || "",
      targetAudience: rec.targetAudience,
      message: rec.message,
    });
    setShowCreate(true);
  }

  const campaigns = campaignsQuery.data?.campaigns ?? [];
  const quota = campaignsQuery.data?.quota;
  const recommendations = recommendationsQuery.data ?? [];
  const isSubscriptionError = campaignsQuery.error?.message?.includes("Subscription required");

  if (isSubscriptionError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4" data-testid="campaigns-subscription-required">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 max-w-md text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Subscription Required</h2>
          <p className="text-gray-600 mb-4">
            Campaigns are a premium feature available to subscribed restaurants. Subscribe from Settings to unlock targeted marketing campaigns.
          </p>
          <Button onClick={() => window.location.href = "/admin/settings"} data-testid="button-go-to-settings">
            Go to Settings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-campaigns-title">Campaigns</h1>
          <p className="text-gray-500 mt-1">Send targeted messages to your diners</p>
        </div>
        <div className="flex items-center gap-3">
          {quota && (
            <span className="text-sm text-gray-500" data-testid="text-campaign-quota">
              {quota.remaining} of {quota.limit} campaigns remaining
            </span>
          )}
          <Button
            onClick={() => { resetForm(); setShowCreate(true); }}
            disabled={quota ? !quota.allowed : false}
            data-testid="button-create-campaign"
          >
            <Plus className="h-4 w-4 mr-2" /> New Campaign
          </Button>
        </div>
      </div>

      {quota && !quota.allowed && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3" data-testid="alert-campaign-limit">
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Campaign limit reached</p>
            <p className="text-sm text-amber-700">
              Tier 1 allows a maximum of {quota.limit} campaigns. Delete an existing campaign to create a new one.
            </p>
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" data-testid="text-recommendations-title">
            <Lightbulb className="h-5 w-5 text-amber-500" /> Recommended Campaigns
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.map((rec) => (
              <Card key={rec.id} className="hover:shadow-md transition-shadow" data-testid={`card-recommendation-${rec.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{rec.name}</CardTitle>
                    <Badge className={cn("text-xs capitalize", CATEGORY_COLORS[rec.category] || "bg-gray-100 text-gray-700")}>
                      {rec.category}
                    </Badge>
                  </div>
                  <CardDescription className="text-sm">{rec.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                    {rec.channel === "sms" ? (
                      <MessageSquare className="h-3.5 w-3.5" />
                    ) : (
                      <Mail className="h-3.5 w-3.5" />
                    )}
                    <span className="uppercase">{rec.channel}</span>
                    <span className="mx-1">·</span>
                    <Users className="h-3.5 w-3.5" />
                    <span>{AUDIENCE_LABELS[rec.targetAudience] || rec.targetAudience}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => useRecommendation(rec)}
                    disabled={quota ? !quota.allowed : false}
                    data-testid={`button-use-recommendation-${rec.id}`}
                  >
                    Use This Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3" data-testid="text-your-campaigns">Your Campaigns</h2>
        {campaignsQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : campaigns.length === 0 ? (
          <Card data-testid="card-no-campaigns">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Megaphone className="h-12 w-12 text-gray-300 mb-4" />
              <p className="text-gray-500 text-center">
                No campaigns yet. Create your first campaign or use a recommended template above.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <Card key={campaign.id} data-testid={`card-campaign-${campaign.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        {campaign.channel === "sms" ? (
                          <MessageSquare className="h-5 w-5 text-blue-500" />
                        ) : (
                          <Mail className="h-5 w-5 text-purple-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate" data-testid={`text-campaign-name-${campaign.id}`}>
                            {campaign.name}
                          </h3>
                          <StatusBadge status={campaign.status} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          <span className="uppercase">{campaign.channel}</span>
                          <span>·</span>
                          <span>{AUDIENCE_LABELS[campaign.targetAudience] || campaign.targetAudience}</span>
                          {campaign.sentAt && (
                            <>
                              <span>·</span>
                              <span>Sent {new Date(campaign.sentAt).toLocaleDateString()}</span>
                            </>
                          )}
                          {campaign.status === "completed" && campaign.sentCount != null && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                {campaign.successCount}/{campaign.sentCount}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDetail(campaign.id)}
                        data-testid={`button-view-campaign-${campaign.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {campaign.status === "draft" && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setShowSendConfirm(campaign.id)}
                          data-testid={`button-send-campaign-${campaign.id}`}
                        >
                          <Send className="h-4 w-4 mr-1" /> Send
                        </Button>
                      )}
                      {campaign.status !== "sending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => setShowDeleteConfirm(campaign.id)}
                          data-testid={`button-delete-campaign-${campaign.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
            <DialogDescription>
              Compose a targeted message to send to your diners via SMS or email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Weekend Special"
                data-testid="input-campaign-name"
              />
            </div>
            <div>
              <Label>Channel</Label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v as "sms" | "email" })}>
                <SelectTrigger data-testid="select-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">
                    <span className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" /> SMS
                    </span>
                  </SelectItem>
                  <SelectItem value="email">
                    <span className="flex items-center gap-2">
                      <Mail className="h-4 w-4" /> Email
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.channel === "email" && (
              <div>
                <Label htmlFor="campaign-subject">Email Subject</Label>
                <Input
                  id="campaign-subject"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="e.g. A special treat from us"
                  data-testid="input-campaign-subject"
                />
              </div>
            )}
            <div>
              <Label>Target Audience</Label>
              <Select value={form.targetAudience} onValueChange={(v) => setForm({ ...form, targetAudience: v })}>
                <SelectTrigger data-testid="select-audience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Diners</SelectItem>
                  <SelectItem value="top_spenders">Top Spenders (top 20%)</SelectItem>
                  <SelectItem value="new">New Members (last 30 days)</SelectItem>
                  <SelectItem value="lapsed">Lapsed Diners (no visit in 60 days)</SelectItem>
                  <SelectItem value="birthday">Birthday Month</SelectItem>
                </SelectContent>
              </Select>
              {audienceCountQuery.data && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1" data-testid="text-audience-count">
                  <Users className="h-3 w-3" /> {audienceCountQuery.data.count} diner{audienceCountQuery.data.count !== 1 ? "s" : ""} match this audience
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="campaign-message">Message</Label>
              <Textarea
                id="campaign-message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Write your message here. Use {{name}} for the diner's name and {{restaurant}} for your restaurant name."
                rows={5}
                data-testid="input-campaign-message"
              />
              <p className="text-xs text-gray-400 mt-1">
                Available placeholders: {"{{name}}"}, {"{{restaurant}}"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} data-testid="button-cancel-create">
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || !form.message || createMutation.isPending}
              data-testid="button-save-campaign"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save as Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showSendConfirm} onOpenChange={() => setShowSendConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Campaign</DialogTitle>
            <DialogDescription>
              This will send the campaign message to all matching diners immediately. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendConfirm(null)} data-testid="button-cancel-send">
              Cancel
            </Button>
            <Button
              onClick={() => showSendConfirm && sendMutation.mutate(showSendConfirm)}
              disabled={sendMutation.isPending}
              data-testid="button-confirm-send"
            >
              {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this campaign? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteConfirm && deleteMutation.mutate(showDeleteConfirm)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailQuery.data?.campaign?.name || "Campaign Details"}</DialogTitle>
          </DialogHeader>
          {detailQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : detailQuery.data ? (
            <div className="space-y-4" data-testid="campaign-detail">
              <div className="flex items-center gap-2">
                <StatusBadge status={detailQuery.data.campaign.status} />
                <Badge variant="outline" className="capitalize">{detailQuery.data.campaign.channel}</Badge>
                <Badge variant="outline">{AUDIENCE_LABELS[detailQuery.data.campaign.targetAudience]}</Badge>
              </div>

              {detailQuery.data.campaign.subject && (
                <div>
                  <Label className="text-xs text-gray-500">Subject</Label>
                  <p className="text-sm" data-testid="text-campaign-subject">{detailQuery.data.campaign.subject}</p>
                </div>
              )}

              <div>
                <Label className="text-xs text-gray-500">Message</Label>
                <p className="text-sm whitespace-pre-wrap bg-gray-50 rounded-lg p-3" data-testid="text-campaign-message">
                  {detailQuery.data.campaign.message}
                </p>
              </div>

              {detailQuery.data.campaign.status === "completed" || detailQuery.data.campaign.status === "failed" ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-sm mb-2">Send Results</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-sent-count">{detailQuery.data.campaign.sentCount ?? 0}</p>
                      <p className="text-xs text-gray-500">Total Sent</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600" data-testid="text-success-count">{detailQuery.data.campaign.successCount ?? 0}</p>
                      <p className="text-xs text-gray-500">Successful</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600" data-testid="text-failed-count">{detailQuery.data.campaign.failedCount ?? 0}</p>
                      <p className="text-xs text-gray-500">Failed</p>
                    </div>
                  </div>
                  {detailQuery.data.campaign.sentAt && (
                    <p className="text-xs text-gray-500 text-center mt-2">
                      Sent on {new Date(detailQuery.data.campaign.sentAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : null}

              {detailQuery.data.recipients.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Recipients ({detailQuery.data.recipients.length})</h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {detailQuery.data.recipients.map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-3 py-2">
                        <span className="truncate flex-1">{r.destination}</span>
                        <span className={cn(
                          "ml-2",
                          r.status === "sent" ? "text-green-600" : r.status === "failed" ? "text-red-600" : "text-gray-500"
                        )}>
                          {r.status === "sent" ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                           r.status === "failed" ? <XCircle className="h-3.5 w-3.5" /> : null}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminCampaigns() {
  return (
    <AdminLayout>
      <AdminCampaignsContent />
    </AdminLayout>
  );
}
