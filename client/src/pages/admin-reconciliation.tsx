import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Upload, FileUp, FileCheck, FileX, Download, ChevronRight, FileSpreadsheet } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function AdminReconciliation() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const { toast } = useToast();
  const { restaurant } = useAuth();
  const restaurantId = restaurant?.id;

  const reconciliationBatches = useQuery({
    queryKey: ['reconciliation-batches', restaurantId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/reconciliation/batches`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch batches');
      return res.json();
    },
    enabled: !!restaurantId
  });

  const batchDetails = useQuery({
    queryKey: ['batch-details', selectedBatchId],
    queryFn: async () => {
      if (!selectedBatchId) return null;
      const res = await fetch(`/api/admin/reconciliation/batches/${selectedBatchId}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch batch details');
      return res.json();
    },
    enabled: !!restaurantId && !!selectedBatchId
  });

  const uploadCSV = useMutation({
    mutationFn: async (file: File) => {
      const content = await file.text();
      const res = await fetch(`/api/admin/reconciliation/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, csvContent: content }),
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to upload CSV');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSelectedFile(null);
      setSelectedBatchId(data.batchId);
      reconciliationBatches.refetch();
      toast({
        title: 'CSV Processed',
        description: `Found ${data.summary.matched} matches out of ${data.summary.total} records.`
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Upload Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const generateReport = (batch: any, records: any[]) => {
    const headers = ['Date', 'Bill ID', 'Customer Phone', 'Recorded Amount', 'POS Amount', 'Variance', 'Status', 'Voucher Code'];
    const rows = records.map((r: any) => {
      const varianceNum = r.variance ? parseFloat(r.variance) : null;
      return [
        r.csvDate || '',
        r.billId,
        r.userPhone || '',
        r.recordedAmount ? `R${parseFloat(r.recordedAmount).toFixed(2)}` : '',
        r.csvAmount || '',
        varianceNum !== null ? `R${varianceNum.toFixed(2)}` : '',
        r.isMatched ? 'Matched' : 'Unmatched',
        r.voucherCode || ''
      ];
    });

    const summaryRows = [
      [],
      ['RECONCILIATION SUMMARY'],
      ['File Name', batch.fileName],
      ['Upload Date', new Date(batch.uploadedAt).toLocaleString()],
      ['Total Records', batch.totalRecords],
      ['Matched', batch.matchedRecords],
      ['Unmatched', batch.totalRecords - batch.matchedRecords],
      [],
      ['DETAILED RECORDS'],
      headers,
      ...rows
    ];

    const csvContent = summaryRows.map(row => 
      Array.isArray(row) ? row.map(cell => `"${cell}"`).join(',') : ''
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reconciliation-report-${batch.fileName.replace('.csv', '')}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Report Downloaded',
      description: 'Your reconciliation report has been downloaded.'
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Reconciliation</h1>
          <p className="text-muted-foreground mt-1">
            Upload POS exports to match redeemed vouchers with transactions and generate reports.
          </p>
        </div>

        <div className="grid gap-6">
          {/* Upload Card */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Upload POS Export
              </CardTitle>
              <CardDescription>
                Upload a CSV file from your POS system to match redeemed vouchers with bills.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  id="csv-upload"
                  data-testid="input-csv-upload"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setSelectedFile(file);
                  }}
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <FileUp className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">
                    {selectedFile ? selectedFile.name : "Click to select CSV file"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or drag and drop
                  </p>
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                CSV must contain a column with Bill IDs (bill_id, invoice_id, transaction_id, etc.)
              </p>
              <Button
                onClick={() => selectedFile && uploadCSV.mutate(selectedFile)}
                disabled={!selectedFile || uploadCSV.isPending}
                className="w-full gap-2"
                size="lg"
                data-testid="button-upload-csv"
              >
                {uploadCSV.isPending ? "Processing..." : (
                  <>
                    <FileSpreadsheet className="h-4 w-4" />
                    Upload & Process
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Recent Batches Card */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Uploads</CardTitle>
              <CardDescription>Click on a batch to view details and download report</CardDescription>
            </CardHeader>
            <CardContent>
              {reconciliationBatches.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : reconciliationBatches.data?.length === 0 ? (
                <div className="text-center py-8">
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No batches yet</p>
                  <p className="text-xs text-muted-foreground">Upload a CSV to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reconciliationBatches.data?.map((batch: any) => (
                    <div
                      key={batch.id}
                      className={`flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors ${selectedBatchId === batch.id ? 'border-primary bg-primary/5' : ''}`}
                      onClick={() => setSelectedBatchId(batch.id)}
                      data-testid={`batch-${batch.id}`}
                    >
                      <div>
                        <p className="text-sm font-medium">{batch.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(batch.uploadedAt).toLocaleDateString()} at {new Date(batch.uploadedAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={batch.matchedRecords > 0 ? "default" : "secondary"}>
                          {batch.matchedRecords}/{batch.totalRecords} matched
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Batch Details */}
        {selectedBatchId && batchDetails.data && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5" />
                    <span className="break-all">{batchDetails.data.batch.fileName}</span>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Uploaded on {new Date(batchDetails.data.batch.uploadedAt).toLocaleString()}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="gap-2 flex-1 sm:flex-none"
                    onClick={() => generateReport(batchDetails.data.batch, batchDetails.data.records)}
                    data-testid="button-download-report"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Download</span> Report
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedBatchId(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">{batchDetails.data.summary.total}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Records</p>
                </div>
                <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{batchDetails.data.summary.matched}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Matched</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{batchDetails.data.summary.unmatched}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Unmatched</p>
                </div>
              </div>

              {/* Records Table */}
              <div className="rounded-md border overflow-x-auto">
                <div className="min-w-[800px]">
                  <div className="grid grid-cols-7 border-b bg-muted/40 p-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <div>Date</div>
                    <div>Bill ID</div>
                    <div>Customer</div>
                    <div className="text-right">Recorded</div>
                    <div className="text-right">POS (CSV)</div>
                    <div className="text-right">Variance</div>
                    <div>Status</div>
                  </div>
                  <div className="divide-y max-h-[400px] overflow-y-auto">
                    {batchDetails.data.records.map((record: any) => {
                      const varianceNum = record.variance ? parseFloat(record.variance) : null;
                      const hasVariance = varianceNum !== null && varianceNum !== 0;
                      
                      return (
                        <div key={record.id} className="grid grid-cols-7 items-center p-3 text-sm min-w-[800px]">
                          <div className="text-xs text-muted-foreground">
                            {record.csvDate || '-'}
                          </div>
                          <div className="font-mono text-xs">{record.billId}</div>
                          <div className="text-xs">
                            {record.userPhone || '-'}
                          </div>
                          <div className="text-right font-mono text-xs">
                            {record.recordedAmount ? `R${parseFloat(record.recordedAmount).toFixed(2)}` : '-'}
                          </div>
                          <div className="text-right font-mono text-xs">
                            {record.csvAmount || '-'}
                          </div>
                          <div className={`text-right font-mono text-xs ${
                            hasVariance 
                              ? varianceNum! < 0 
                                ? 'text-red-600 font-medium' 
                                : 'text-amber-600 font-medium'
                              : 'text-green-600'
                          }`}>
                            {varianceNum !== null 
                              ? varianceNum === 0 
                                ? 'R0.00'
                                : `${varianceNum > 0 ? '+' : ''}R${varianceNum.toFixed(2)}`
                              : '-'}
                          </div>
                          <div>
                            {record.isMatched ? (
                              <Badge variant="default" className="gap-1 bg-green-600 text-xs">
                                <FileCheck className="h-3 w-3" /> Matched
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1 text-xs">
                                <FileX className="h-3 w-3" /> Unmatched
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
