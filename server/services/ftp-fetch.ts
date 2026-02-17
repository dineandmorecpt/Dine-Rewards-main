import * as ftp from "basic-ftp";
import { createLoyaltyServices } from "./loyalty";
import { storage } from "../storage";

const services = createLoyaltyServices(storage);

export interface FtpFetchResult {
  success: boolean;
  filesProcessed: string[];
  filesSkipped: string[];
  errors: string[];
  timestamp: Date;
}

let lastFetchResult: FtpFetchResult | null = null;

export function getLastFetchResult(): FtpFetchResult | null {
  return lastFetchResult;
}

export async function fetchAndProcessFtpFiles(restaurantId: string): Promise<FtpFetchResult> {
  const result: FtpFetchResult = {
    success: false,
    filesProcessed: [],
    filesSkipped: [],
    errors: [],
    timestamp: new Date(),
  };

  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USERNAME;
  const password = process.env.FTP_PASSWORD;
  const remotePath = process.env.FTP_PATH;

  if (!host || !user || !password || !remotePath) {
    result.errors.push("FTP credentials not configured. Check FTP_HOST, FTP_USERNAME, FTP_PASSWORD, FTP_PATH secrets.");
    lastFetchResult = result;
    return result;
  }

  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host,
      port: 21,
      user,
      password,
      secure: false,
    });

    console.log(`[FTP] Connected to ${host}`);

    await client.cd(remotePath);
    const fileList = await client.list();

    const csvFiles = fileList.filter(
      (f) => f.type === ftp.FileType.File && f.name.toLowerCase().endsWith(".csv")
    );

    if (csvFiles.length === 0) {
      console.log("[FTP] No CSV files found in remote directory");
      result.success = true;
      lastFetchResult = result;
      return result;
    }

    console.log(`[FTP] Found ${csvFiles.length} CSV file(s)`);

    const existingBatches = await storage.getReconciliationBatchesByRestaurant(restaurantId);
    const processedFileNames = new Set(existingBatches.map((b) => b.fileName));

    for (const file of csvFiles) {
      const ftpFileName = `ftp-${file.name}`;

      if (processedFileNames.has(ftpFileName)) {
        console.log(`[FTP] Skipping already processed file: ${file.name}`);
        result.filesSkipped.push(file.name);
        continue;
      }

      try {
        const chunks: Buffer[] = [];
        const writable = new (await import("stream")).Writable({
          write(chunk, _encoding, callback) {
            chunks.push(Buffer.from(chunk));
            callback();
          },
        });

        await client.downloadTo(writable, file.name);
        const csvContent = Buffer.concat(chunks).toString("utf-8");

        if (!csvContent.trim()) {
          result.errors.push(`${file.name}: File is empty`);
          continue;
        }

        const reconciliationResult = await services.reconciliation.processCSV(
          restaurantId,
          `ftp-${file.name}`,
          csvContent
        );

        console.log(
          `[FTP] Processed ${file.name}: ${reconciliationResult.summary.matched} matched, ${reconciliationResult.summary.unmatched} unmatched out of ${reconciliationResult.summary.total} records`
        );

        result.filesProcessed.push(file.name);
      } catch (fileError: any) {
        const errorMsg = `${file.name}: ${fileError.message || "Processing failed"}`;
        console.error(`[FTP] Error processing file: ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    result.success = result.filesProcessed.length > 0 || result.errors.length === 0;
  } catch (error: any) {
    const errorMsg = `FTP connection error: ${error.message || "Unknown error"}`;
    console.error(`[FTP] ${errorMsg}`);
    result.errors.push(errorMsg);
  } finally {
    client.close();
  }

  lastFetchResult = result;
  return result;
}
