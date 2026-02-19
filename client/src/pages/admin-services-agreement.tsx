import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";

const AGREEMENT_CONTENT = `# Services Agreement

## 1. Introduction

This Services Agreement governs the relationship between your restaurant and Dine&More. By using our platform, you agree to these terms.

## 2. Platform Services

2.1. Dine&More provides a loyalty rewards platform that enables your restaurant to create and manage customer loyalty programs.

2.2. Services include point tracking, voucher management, transaction reconciliation, and analytics.

## 3. Restaurant Obligations

3.1. You are responsible for maintaining accurate business information on the platform.

3.2. You must honour all vouchers and rewards issued through the platform to your customers.

3.3. You must ensure that your staff are trained on the proper use of the platform.

## 4. Data and Privacy

4.1. Customer data collected through the platform is processed in accordance with POPIA and our Privacy Policy.

4.2. You may not use customer data collected through the platform for purposes outside of the loyalty program.

## 5. Fees and Billing

5.1. Platform usage fees are as agreed in your subscription plan.

5.2. Fees are billed monthly and are due within 30 days of invoice.

## 6. Termination

6.1. Either party may terminate this agreement with 30 days written notice.

6.2. Upon termination, outstanding loyalty obligations to customers must still be honoured.

## 7. Limitation of Liability

7.1. Dine&More provides the platform on an "as is" basis.

7.2. We are not liable for losses arising from system downtime or technical issues beyond our control.`;

function handleDownload(content: string, title: string) {
  const plainText = content
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^- /gm, '  - ');

  const blob = new Blob([plainText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AdminServicesAgreement() {
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
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            data-testid="button-download-agreement"
            onClick={() => handleDownload(AGREEMENT_CONTENT, "Services Agreement")}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div
              className="prose prose-sm sm:prose max-w-none prose-headings:text-gray-900 prose-p:text-gray-600 prose-li:text-gray-600 prose-strong:text-gray-800"
              data-testid="text-agreement-content"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(AGREEMENT_CONTENT) }}
            />
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
