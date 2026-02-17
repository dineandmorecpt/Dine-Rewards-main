import { fetchAndProcessFtpFiles, getLastFetchResult, type FtpFetchResult } from "./ftp-fetch";
import { storage } from "../storage";

let schedulerTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
const lastResultsByRestaurant: Map<string, FtpFetchResult> = new Map();

const SCHEDULE_HOUR = 8;
const SCHEDULE_MINUTE = 15;

function getNextRunTime(): Date {
  const now = new Date();
  const next = new Date(now);
  next.setHours(SCHEDULE_HOUR, SCHEDULE_MINUTE, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

function getMillisUntilNext(): number {
  return getNextRunTime().getTime() - Date.now();
}

async function runScheduledFetch(): Promise<void> {
  if (isRunning) {
    console.log("[Scheduler] FTP fetch already running, skipping");
    return;
  }

  isRunning = true;
  console.log(`[Scheduler] Starting scheduled FTP fetch at ${new Date().toISOString()}`);

  try {
    const FANCY_FRANKS_ID = "46599b72-a7dd-4098-ba1d-1a4ebe7929b7";
    const restaurant = await storage.getRestaurant(FANCY_FRANKS_ID);

    if (!restaurant) {
      console.log("[Scheduler] Fancy Franks restaurant not found, skipping FTP fetch");
      return;
    }

    console.log(`[Scheduler] Processing FTP files for restaurant: ${restaurant.name}`);
    const result = await fetchAndProcessFtpFiles(restaurant.id);
    lastResultsByRestaurant.set(restaurant.id, result);

    if (result.success) {
      console.log(`[Scheduler] FTP fetch for ${restaurant.name} completed. Files processed: ${result.filesProcessed.length}, skipped: ${result.filesSkipped.length}`);
    } else {
      console.log(`[Scheduler] FTP fetch for ${restaurant.name} completed with errors: ${result.errors.join(", ")}`);
    }
  } catch (error: any) {
    console.error(`[Scheduler] FTP fetch failed: ${error.message}`);
  } finally {
    isRunning = false;
    scheduleNext();
  }
}

function scheduleNext(): void {
  const ms = getMillisUntilNext();
  const nextRun = getNextRunTime();
  console.log(`[Scheduler] Next FTP fetch scheduled for ${nextRun.toLocaleString()}`);

  schedulerTimer = setTimeout(runScheduledFetch, ms);
}

export function startScheduler(): void {
  console.log("[Scheduler] FTP fetch scheduler starting...");
  console.log(`[Scheduler] Configured to run daily at ${SCHEDULE_HOUR}:${String(SCHEDULE_MINUTE).padStart(2, "0")}`);
  scheduleNext();
}

export function stopScheduler(): void {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
    console.log("[Scheduler] Scheduler stopped");
  }
}

export function getSchedulerStatus(restaurantId?: string) {
  return {
    nextRun: getNextRunTime().toISOString(),
    scheduleTime: `${SCHEDULE_HOUR}:${String(SCHEDULE_MINUTE).padStart(2, "0")}`,
    isRunning,
    lastResult: restaurantId ? (lastResultsByRestaurant.get(restaurantId) ?? null) : null,
  };
}

export function recordFetchResult(restaurantId: string, result: FtpFetchResult): void {
  lastResultsByRestaurant.set(restaurantId, result);
}

export { fetchAndProcessFtpFiles, getLastFetchResult, type FtpFetchResult };
