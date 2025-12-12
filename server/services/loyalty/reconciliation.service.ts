import type { IStorage } from "../../storage";
import type { ReconciliationBatch, ReconciliationRecord } from "@shared/schema";

export interface CsvRecord {
  billId: string;
  amount?: string;
  date?: string;
}

export interface ReconciliationResult {
  batch: ReconciliationBatch;
  records: EnrichedReconciliationRecord[];
  summary: {
    total: number;
    matched: number;
    unmatched: number;
  };
}

export interface EnrichedReconciliationRecord extends ReconciliationRecord {
  voucherCode?: string;
  voucherTitle?: string;
  redeemedAt?: Date | null;
}

export interface IReconciliationService {
  processCSV(restaurantId: string, fileName: string, csvContent: string): Promise<ReconciliationResult>;
  getBatches(restaurantId: string): Promise<ReconciliationBatch[]>;
  getBatchDetails(batchId: string): Promise<ReconciliationResult | null>;
}

export class ReconciliationService implements IReconciliationService {
  constructor(private storage: IStorage) {}

  private parseCSV(csvContent: string): CsvRecord[] {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      return [];
    }

    const headerLine = lines[0].toLowerCase();
    const headers = headerLine.split(',').map(h => h.trim().replace(/['"]/g, ''));
    
    const billIdIndex = headers.findIndex(h => 
      h === 'bill_id' || h === 'billid' || h === 'bill id' || h === 'invoice_id' || h === 'invoiceid' || h === 'invoice'
    );
    const amountIndex = headers.findIndex(h => 
      h === 'amount' || h === 'total' || h === 'value' || h === 'bill_amount'
    );
    const dateIndex = headers.findIndex(h => 
      h === 'date' || h === 'transaction_date' || h === 'bill_date'
    );

    if (billIdIndex === -1) {
      throw new Error("CSV must contain a column for Bill ID (e.g., 'bill_id', 'billid', 'invoice_id')");
    }

    const records: CsvRecord[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',').map(v => v.trim().replace(/['"]/g, ''));
      
      const billId = values[billIdIndex];
      if (!billId) continue;
      
      records.push({
        billId,
        amount: amountIndex >= 0 ? values[amountIndex] : undefined,
        date: dateIndex >= 0 ? values[dateIndex] : undefined
      });
    }

    return records;
  }

  async processCSV(restaurantId: string, fileName: string, csvContent: string): Promise<ReconciliationResult> {
    const csvRecords = this.parseCSV(csvContent);
    
    if (csvRecords.length === 0) {
      throw new Error("No valid records found in CSV file");
    }

    const batch = await this.storage.createReconciliationBatch({
      restaurantId,
      fileName,
      totalRecords: csvRecords.length,
      matchedRecords: 0,
      unmatchedRecords: 0,
      status: 'processing'
    });

    let matchedCount = 0;
    const enrichedRecords: EnrichedReconciliationRecord[] = [];

    for (const csvRecord of csvRecords) {
      const voucher = await this.storage.getVoucherByBillId(restaurantId, csvRecord.billId);
      
      const isMatched = !!voucher;
      if (isMatched) matchedCount++;

      const record = await this.storage.createReconciliationRecord({
        batchId: batch.id,
        billId: csvRecord.billId,
        csvAmount: csvRecord.amount || null,
        csvDate: csvRecord.date || null,
        isMatched,
        matchedVoucherId: voucher?.id || null
      });

      enrichedRecords.push({
        ...record,
        voucherCode: voucher?.code,
        voucherTitle: voucher?.title,
        redeemedAt: voucher?.redeemedAt
      });
    }

    const unmatchedCount = csvRecords.length - matchedCount;

    const updatedBatch = await this.storage.updateReconciliationBatch(batch.id, {
      matchedRecords: matchedCount,
      unmatchedRecords: unmatchedCount,
      status: 'completed',
      processedAt: new Date()
    });

    return {
      batch: updatedBatch,
      records: enrichedRecords,
      summary: {
        total: csvRecords.length,
        matched: matchedCount,
        unmatched: unmatchedCount
      }
    };
  }

  async getBatches(restaurantId: string): Promise<ReconciliationBatch[]> {
    return await this.storage.getReconciliationBatchesByRestaurant(restaurantId);
  }

  async getBatchDetails(batchId: string): Promise<ReconciliationResult | null> {
    const batch = await this.storage.getReconciliationBatch(batchId);
    if (!batch) return null;

    const records = await this.storage.getReconciliationRecordsByBatch(batchId);
    
    const enrichedRecords: EnrichedReconciliationRecord[] = await Promise.all(
      records.map(async (record) => {
        if (record.matchedVoucherId) {
          const voucher = await this.storage.getVoucherById(record.matchedVoucherId);
          return {
            ...record,
            voucherCode: voucher?.code,
            voucherTitle: voucher?.title,
            redeemedAt: voucher?.redeemedAt
          };
        }
        return record;
      })
    );

    return {
      batch,
      records: enrichedRecords,
      summary: {
        total: batch.totalRecords,
        matched: batch.matchedRecords,
        unmatched: batch.unmatchedRecords
      }
    };
  }
}
