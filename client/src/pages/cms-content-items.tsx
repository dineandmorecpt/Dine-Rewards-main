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
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Plus, Database, Pencil, Trash2, Download, Eye, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FieldDef {
  type: string;
  label: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

interface ContentType {
  id: string;
  key: string;
  name: string;
  description: string | null;
  schema: Record<string, FieldDef>;
}

interface ContentItem {
  id: string;
  typeKey: string;
  slug: string;
  data: Record<string, any>;
  status: string;
  version: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function CmsContentItems() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTypeKey, setSelectedTypeKey] = useState<string>("all");
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [formTypeKey, setFormTypeKey] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formStatus, setFormStatus] = useState<string>("draft");
  const [formData, setFormData] = useState<Record<string, any>>({});

  const { data: contentTypes } = useQuery<ContentType[]>({
    queryKey: ["/api/cms/content-types"],
    queryFn: async () => {
      const res = await fetch("/api/cms/content-types", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const { data: items, isLoading } = useQuery<ContentItem[]>({
    queryKey: ["/api/cms/content-items", selectedTypeKey],
    queryFn: async () => {
      const url = selectedTypeKey !== "all"
        ? `/api/cms/content-items?typeKey=${selectedTypeKey}`
        : "/api/cms/content-items";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/cms/content-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cms/content-items"] });
      toast({ title: "Content item created" });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await fetch(`/api/cms/content-items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cms/content-items"] });
      toast({ title: "Content item updated" });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/cms/content-items/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cms/content-items"] });
      toast({ title: "Content item deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function closeDialog() {
    setIsCreating(false);
    setEditingItem(null);
    setFormTypeKey("");
    setFormSlug("");
    setFormStatus("draft");
    setFormData({});
  }

  function openCreate() {
    setIsCreating(true);
    setFormTypeKey(contentTypes?.[0]?.key || "");
    setFormSlug("");
    setFormStatus("draft");
    setFormData({});
  }

  function openEdit(item: ContentItem) {
    setEditingItem(item);
    setFormTypeKey(item.typeKey);
    setFormSlug(item.slug);
    setFormStatus(item.status);
    setFormData(item.data as Record<string, any>);
  }

  function handleSave() {
    const payload = {
      typeKey: formTypeKey,
      slug: formSlug,
      data: formData,
      status: formStatus,
    };
    if (isCreating) {
      createMutation.mutate(payload);
    } else if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, payload });
    }
  }

  function handleDownload(item: ContentItem) {
    const blob = new Blob([JSON.stringify(item.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.typeKey}-${item.slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectedSchema = contentTypes?.find(t => t.key === formTypeKey)?.schema || {};
  const typeLookup = new Map(contentTypes?.map(t => [t.key, t]) || []);

  const filteredItems = items?.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const typeName = typeLookup.get(item.typeKey)?.name || item.typeKey;
    return item.slug.toLowerCase().includes(q)
      || typeName.toLowerCase().includes(q)
      || JSON.stringify(item.data).toLowerCase().includes(q);
  });

  const isDialogOpen = isCreating || !!editingItem;

  return (
    <CmsLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-content-items-title">Content Items</h1>
          <p className="text-muted-foreground mt-1">Manage structured content entries as pure data (JSON)</p>
        </div>
        <Button onClick={openCreate} disabled={!contentTypes?.length} data-testid="button-create-item">
          <Plus className="w-4 h-4 mr-2" />
          New Item
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search content items..."
            className="pl-9"
            data-testid="input-search-items"
          />
        </div>
        <Select value={selectedTypeKey} onValueChange={setSelectedTypeKey}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-type">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {contentTypes?.map(t => (
              <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!contentTypes?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No content models defined yet. Create content models first before adding items.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredItems?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {searchQuery ? "No items match your search." : "No content items yet. Create your first item to get started."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredItems?.map((item) => {
            const typeDef = typeLookup.get(item.typeKey);
            const dataPreview = Object.entries(item.data as Record<string, any>)
              .slice(0, 3)
              .map(([k, v]) => `${k}: ${typeof v === "string" ? v.substring(0, 40) : String(v)}`)
              .join(" | ");
            return (
              <Card key={item.id} data-testid={`card-item-${item.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <Database className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate">{item.slug}</div>
                        <div className="text-xs text-muted-foreground truncate">{dataPreview}</div>
                        <div className="flex gap-2 mt-1.5 flex-wrap">
                          <Badge variant="outline" className="text-xs">{typeDef?.name || item.typeKey}</Badge>
                          <Badge variant={item.status === "published" ? "default" : item.status === "archived" ? "secondary" : "outline"} className="text-xs">
                            {item.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">v{item.version}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(item)} data-testid={`button-download-item-${item.id}`}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(item)} data-testid={`button-edit-item-${item.id}`}>
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => {
                        if (window.confirm("Delete this content item?")) {
                          deleteMutation.mutate(item.id);
                        }
                      }} data-testid={`button-delete-item-${item.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreating ? "Create Content Item" : "Edit Content Item"}</DialogTitle>
            <DialogDescription>Manage structured content as pure JSON data</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Content Model</Label>
                <Select value={formTypeKey} onValueChange={(v) => { setFormTypeKey(v); setFormData({}); }} disabled={!!editingItem}>
                  <SelectTrigger data-testid="select-item-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {contentTypes?.map(t => (
                      <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  placeholder="my-content-slug"
                  data-testid="input-item-slug"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger className="w-[150px]" data-testid="select-item-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formTypeKey && Object.keys(selectedSchema).length > 0 && (
              <div className="border-t pt-4 space-y-3">
                <Label className="text-base font-semibold">Content Data</Label>
                {Object.entries(selectedSchema).map(([fieldKey, fieldDef]) => (
                  <div key={fieldKey}>
                    <Label htmlFor={`data-${fieldKey}`} className="text-sm">
                      {fieldDef.label}
                      {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {renderFieldInput(fieldKey, fieldDef, formData, setFormData)}
                  </div>
                ))}
              </div>
            )}

            {formTypeKey && Object.keys(selectedSchema).length === 0 && (
              <div className="border-t pt-4">
                <Label className="text-base font-semibold mb-2 block">Raw JSON Data</Label>
                <Textarea
                  value={JSON.stringify(formData, null, 2)}
                  onChange={(e) => {
                    try { setFormData(JSON.parse(e.target.value)); } catch {}
                  }}
                  rows={8}
                  className="font-mono text-sm"
                  data-testid="textarea-raw-json"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-item">Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending || !formTypeKey || !formSlug}
              data-testid="button-save-item"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              {isCreating ? "Create Item" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CmsLayout>
  );
}

function renderFieldInput(
  fieldKey: string,
  fieldDef: FieldDef,
  data: Record<string, any>,
  setData: (d: Record<string, any>) => void
) {
  const value = data[fieldKey] ?? "";
  const update = (val: any) => setData({ ...data, [fieldKey]: val });

  switch (fieldDef.type) {
    case "textarea":
    case "richtext":
      return (
        <Textarea
          id={`data-${fieldKey}`}
          value={value}
          onChange={(e) => update(e.target.value)}
          placeholder={fieldDef.placeholder}
          rows={fieldDef.type === "richtext" ? 6 : 3}
          className="text-sm"
          data-testid={`input-data-${fieldKey}`}
        />
      );
    case "number":
      return (
        <Input
          id={`data-${fieldKey}`}
          type="number"
          value={value}
          onChange={(e) => update(e.target.value ? Number(e.target.value) : "")}
          placeholder={fieldDef.placeholder}
          className="text-sm"
          data-testid={`input-data-${fieldKey}`}
        />
      );
    case "boolean":
      return (
        <div className="flex items-center gap-2 pt-1">
          <Switch
            checked={!!value}
            onCheckedChange={(v) => update(v)}
            data-testid={`input-data-${fieldKey}`}
          />
          <span className="text-sm text-muted-foreground">{value ? "Yes" : "No"}</span>
        </div>
      );
    case "select":
      return (
        <Select value={value || ""} onValueChange={update}>
          <SelectTrigger className="text-sm" data-testid={`input-data-${fieldKey}`}>
            <SelectValue placeholder={fieldDef.placeholder || "Select..."} />
          </SelectTrigger>
          <SelectContent>
            {fieldDef.options?.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "date":
      return (
        <Input
          id={`data-${fieldKey}`}
          type="date"
          value={value}
          onChange={(e) => update(e.target.value)}
          className="text-sm"
          data-testid={`input-data-${fieldKey}`}
        />
      );
    case "json":
      return (
        <Textarea
          id={`data-${fieldKey}`}
          value={typeof value === "string" ? value : JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try { update(JSON.parse(e.target.value)); } catch { update(e.target.value); }
          }}
          placeholder={fieldDef.placeholder || "{}"}
          rows={4}
          className="font-mono text-sm"
          data-testid={`input-data-${fieldKey}`}
        />
      );
    default:
      return (
        <Input
          id={`data-${fieldKey}`}
          type={fieldDef.type === "url" || fieldDef.type === "image" ? "url" : "text"}
          value={value}
          onChange={(e) => update(e.target.value)}
          placeholder={fieldDef.placeholder}
          className="text-sm"
          data-testid={`input-data-${fieldKey}`}
        />
      );
  }
}
