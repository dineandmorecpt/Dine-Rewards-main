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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Plus, Blocks, Pencil, Trash2, Wand2, X } from "lucide-react";
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
  createdAt: string;
  updatedAt: string;
}

const FIELD_TYPES = [
  { value: "text", label: "Short Text" },
  { value: "textarea", label: "Long Text" },
  { value: "richtext", label: "Rich Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "url", label: "URL" },
  { value: "image", label: "Image URL" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown Select" },
  { value: "json", label: "JSON" },
];

const emptyType = {
  key: "",
  name: "",
  description: "",
  schema: {} as Record<string, FieldDef>,
};

interface FieldEditorEntry {
  fieldKey: string;
  type: string;
  label: string;
  required: boolean;
  options: string;
  placeholder: string;
}

const emptyField: FieldEditorEntry = {
  fieldKey: "",
  type: "text",
  label: "",
  required: false,
  options: "",
  placeholder: "",
};

export default function CmsContentTypes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingType, setEditingType] = useState<ContentType | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(emptyType);
  const [fields, setFields] = useState<FieldEditorEntry[]>([]);

  const { data: types, isLoading } = useQuery<ContentType[]>({
    queryKey: ["/api/cms/content-types"],
    queryFn: async () => {
      const res = await fetch("/api/cms/content-types", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyType) => {
      const res = await fetch("/api/cms/content-types", {
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
      queryClient.invalidateQueries({ queryKey: ["/api/cms/content-types"] });
      toast({ title: "Content model created" });
      setIsCreating(false);
      setForm(emptyType);
      setFields([]);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof emptyType> }) => {
      const res = await fetch(`/api/cms/content-types/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cms/content-types"] });
      toast({ title: "Content model updated" });
      setEditingType(null);
      setFields([]);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/cms/content-types/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cms/content-types"] });
      toast({ title: "Content model deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/cms/seed-content-types", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to seed");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cms/content-types"] });
      toast({ title: "Default models seeded", description: `Created ${data.created?.length || 0} content models` });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function schemaToFields(schema: Record<string, FieldDef>): FieldEditorEntry[] {
    return Object.entries(schema).map(([key, def]) => ({
      fieldKey: key,
      type: def.type,
      label: def.label,
      required: def.required || false,
      options: def.options?.join(", ") || "",
      placeholder: def.placeholder || "",
    }));
  }

  function fieldsToSchema(fieldList: FieldEditorEntry[]): Record<string, FieldDef> {
    const schema: Record<string, FieldDef> = {};
    for (const f of fieldList) {
      if (!f.fieldKey || !f.label) continue;
      const def: FieldDef = { type: f.type, label: f.label };
      if (f.required) def.required = true;
      if (f.options) def.options = f.options.split(",").map(o => o.trim()).filter(Boolean);
      if (f.placeholder) def.placeholder = f.placeholder;
      schema[f.fieldKey] = def;
    }
    return schema;
  }

  const openEditor = (type: ContentType) => {
    setEditingType(type);
    setForm({
      key: type.key,
      name: type.name,
      description: type.description || "",
      schema: type.schema,
    });
    setFields(schemaToFields(type.schema));
  };

  const openCreateDialog = () => {
    setIsCreating(true);
    setForm(emptyType);
    setFields([]);
  };

  const handleSave = () => {
    const schema = fieldsToSchema(fields);
    const data = { ...form, schema };
    if (isCreating) {
      createMutation.mutate(data);
    } else if (editingType) {
      updateMutation.mutate({ id: editingType.id, data });
    }
  };

  const addField = () => {
    setFields([...fields, { ...emptyField }]);
  };

  const updateField = (index: number, updates: Partial<FieldEditorEntry>) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], ...updates };
    setFields(updated);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const isDialogOpen = isCreating || !!editingType;

  return (
    <CmsLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-content-types-title">Content Models</h1>
          <p className="text-muted-foreground mt-1">Define structured content types with typed fields</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} data-testid="button-seed-types">
            <Wand2 className="w-4 h-4 mr-2" />
            Seed Defaults
          </Button>
          <Button onClick={openCreateDialog} data-testid="button-create-type">
            <Plus className="w-4 h-4 mr-2" />
            New Model
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : types?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No content models defined yet. Click "Seed Defaults" to create common models, or create your own.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {types?.map((type) => {
            const fieldCount = Object.keys(type.schema || {}).length;
            return (
              <Card key={type.id} data-testid={`card-type-${type.id}`} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <Blocks className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{type.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{type.key}</div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditor(type)} data-testid={`button-edit-type-${type.id}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => {
                        if (window.confirm(`Delete "${type.name}" and all its content items?`)) {
                          deleteMutation.mutate(type.id);
                        }
                      }} data-testid={`button-delete-type-${type.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  {type.description && (
                    <p className="text-xs text-muted-foreground mb-3">{type.description}</p>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {fieldCount} field{fieldCount !== 1 ? "s" : ""}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreating(false);
          setEditingType(null);
          setFields([]);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreating ? "Create Content Model" : "Edit Content Model"}</DialogTitle>
            <DialogDescription>Define the structure and fields for this content type</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Promotion Banner"
                  data-testid="input-type-name"
                />
              </div>
              <div>
                <Label htmlFor="key">Key (unique identifier)</Label>
                <Input
                  id="key"
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                  placeholder="promotion_banner"
                  disabled={!!editingType}
                  data-testid="input-type-key"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Promotional banners displayed across the platform"
                data-testid="input-type-description"
              />
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Fields</Label>
                <Button variant="outline" size="sm" onClick={addField} data-testid="button-add-field">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add Field
                </Button>
              </div>

              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No fields defined. Add fields to define the data structure.
                </p>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-2 bg-gray-50" data-testid={`field-row-${index}`}>
                      <div className="flex gap-2 items-start">
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <div>
                            <Input
                              value={field.fieldKey}
                              onChange={(e) => updateField(index, { fieldKey: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
                              placeholder="field_key"
                              className="text-sm h-8"
                              data-testid={`input-field-key-${index}`}
                            />
                          </div>
                          <div>
                            <Input
                              value={field.label}
                              onChange={(e) => updateField(index, { label: e.target.value })}
                              placeholder="Field Label"
                              className="text-sm h-8"
                              data-testid={`input-field-label-${index}`}
                            />
                          </div>
                          <div>
                            <Select value={field.type} onValueChange={(v) => updateField(index, { type: v })}>
                              <SelectTrigger className="text-sm h-8" data-testid={`select-field-type-${index}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FIELD_TYPES.map(ft => (
                                  <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => removeField(index)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="flex gap-2 items-center">
                        <label className="flex items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(index, { required: e.target.checked })}
                            className="rounded"
                          />
                          Required
                        </label>
                        {field.type === "select" && (
                          <Input
                            value={field.options}
                            onChange={(e) => updateField(index, { options: e.target.value })}
                            placeholder="option1, option2, option3"
                            className="text-xs h-7 flex-1"
                          />
                        )}
                        <Input
                          value={field.placeholder}
                          onChange={(e) => updateField(index, { placeholder: e.target.value })}
                          placeholder="Placeholder text"
                          className="text-xs h-7 flex-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreating(false); setEditingType(null); setFields([]); }} data-testid="button-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-type"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              {isCreating ? "Create Model" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CmsLayout>
  );
}
