import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/queryClient";

export default function AdminServicesAgreement() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["content", "services-agreement"],
    queryFn: async () => {
      const res = await fetch("/api/admin/content/services-agreement", {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to load services agreement");
      return res.json();
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 rounded-full p-2">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900" data-testid="text-agreement-title">
              Services Agreement
            </h1>
            {data?.updatedAt && (
              <p className="text-xs text-muted-foreground" data-testid="text-agreement-updated">
                Last updated: {new Date(data.updatedAt).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading && (
              <div className="space-y-4" data-testid="skeleton-agreement">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-6 w-1/2 mt-4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            )}

            {error && (
              <div className="text-center py-8" data-testid="text-agreement-error">
                <p className="text-muted-foreground">Unable to load the services agreement. Please try again later.</p>
              </div>
            )}

            {data?.content && (
              <div
                className="prose prose-sm sm:prose max-w-none prose-headings:text-gray-900 prose-p:text-gray-600 prose-li:text-gray-600 prose-strong:text-gray-800"
                data-testid="text-agreement-content"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(data.content) }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*"(.+?)"\*\*/g, '<strong>"$1"</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/^(\d+\.\d+)\. (.+)$/gm, '<p><strong>$1.</strong> $2</p>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hpul])(.*\S.*)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<h[123]>)/g, '$1')
    .replace(/(<\/h[123]>)<\/p>/g, '$1')
    .replace(/<p>(<ul>)/g, '$1')
    .replace(/(<\/ul>)<\/p>/g, '$1');
}
