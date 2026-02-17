import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CmsLayout } from "@/components/layout/cms-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, FileText, Pencil, Trash2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ContentPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  portal: string;
  isPublished: boolean;
  version: number;
  updatedAt: string;
  createdAt: string;
}

const emptyPage = {
  slug: "",
  title: "",
  content: "",
  portal: "diner",
  isPublished: true,
};

export default function CmsContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingPage, setEditingPage] = useState<ContentPage | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(emptyPage);

  const { data: pages, isLoading } = useQuery<ContentPage[]>({
    queryKey: ["/api/cms/content"],
    queryFn: async () => {
      const res = await fetch("/api/cms/content", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyPage) => {
      const res = await fetch("/api/cms/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cms/content"] });
      toast({ title: "Content page created" });
      setIsCreating(false);
      setForm(emptyPage);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof emptyPage> }) => {
      const res = await fetch(`/api/cms/content/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cms/content"] });
      toast({ title: "Content page updated" });
      setEditingPage(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/cms/content/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cms/content"] });
      toast({ title: "Content page deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const openEditor = (page: ContentPage) => {
    setEditingPage(page);
    setForm({
      slug: page.slug,
      title: page.title,
      content: page.content,
      portal: page.portal,
      isPublished: page.isPublished,
    });
  };

  const openCreateDialog = () => {
    setIsCreating(true);
    setForm(emptyPage);
  };

  const handleDownload = (page: ContentPage) => {
    const blob = new Blob([page.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${page.slug}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isDialogOpen = isCreating || !!editingPage;

  return (
    <CmsLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-content-title">Content Pages</h1>
          <p className="text-muted-foreground mt-1">Manage legal pages, FAQs, and other platform content</p>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-create-page">
          <Plus className="w-4 h-4 mr-2" />
          New Page
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : pages?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No content pages yet. Create your first page to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pages?.map((page) => (
            <Card key={page.id} data-testid={`card-content-${page.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-semibold">{page.title}</div>
                      <div className="text-sm text-muted-foreground">/{page.slug}</div>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{page.portal}</Badge>
                        <Badge variant={page.isPublished ? "default" : "secondary"} className="text-xs">
                          {page.isPublished ? "Published" : "Draft"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">v{page.version}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleDownload(page)} data-testid={`button-download-${page.id}`}>
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEditor(page)} data-testid={`button-edit-${page.id}`}>
                      <Pencil className="w-3.5 h-3.5 mr-1.5" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => {
                        if (window.confirm("Are you sure you want to delete this page?")) {
                          deleteMutation.mutate(page.id);
                        }
                      }}
                      data-testid={`button-delete-${page.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreating(false);
          setEditingPage(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreating ? "Create Content Page" : "Edit Content Page"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Terms and Conditions"
                  data-testid="input-title"
                />
              </div>
              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="terms-and-conditions"
                  data-testid="input-slug"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Portal</Label>
                <Select value={form.portal} onValueChange={(v) => setForm({ ...form, portal: v })}>
                  <SelectTrigger data-testid="select-portal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diner">Diner Portal</SelectItem>
                    <SelectItem value="admin">Admin Portal</SelectItem>
                    <SelectItem value="platform">Platform</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-3 pb-1">
                <Switch
                  checked={form.isPublished}
                  onCheckedChange={(v) => setForm({ ...form, isPublished: v })}
                  data-testid="switch-published"
                />
                <Label>{form.isPublished ? "Published" : "Draft"}</Label>
              </div>
            </div>
            <div>
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Page content..."
                rows={12}
                className="font-mono text-sm"
                data-testid="textarea-content"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setIsCreating(false); setEditingPage(null); }}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (isCreating) {
                  createMutation.mutate(form);
                } else if (editingPage) {
                  updateMutation.mutate({ id: editingPage.id, data: form });
                }
              }}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              {isCreating ? "Create" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CmsLayout>
  );
}
