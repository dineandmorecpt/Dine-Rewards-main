interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const restaurantDailyLimits = new Map<string, RateLimitEntry>();
const phoneDailyLimits = new Map<string, RateLimitEntry>();
const globalDailyLimit: RateLimitEntry = { count: 0, resetAt: Date.now() + 24 * 60 * 60 * 1000 };

const RESTAURANT_DAILY_LIMIT = 100;
const PHONE_DAILY_LIMIT = 3;
const GLOBAL_DAILY_LIMIT = 1000;

function resetIfExpired(entry: RateLimitEntry): RateLimitEntry {
  if (Date.now() > entry.resetAt) {
    return { count: 0, resetAt: Date.now() + 24 * 60 * 60 * 1000 };
  }
  return entry;
}

export interface SMSRateLimitResult {
  allowed: boolean;
  error?: string;
  retryAfterSeconds?: number;
}

export function checkSMSRateLimit(phone: string, restaurantId?: string): SMSRateLimitResult {
  const now = Date.now();
  
  if (now > globalDailyLimit.resetAt) {
    globalDailyLimit.count = 0;
    globalDailyLimit.resetAt = now + 24 * 60 * 60 * 1000;
  }
  if (globalDailyLimit.count >= GLOBAL_DAILY_LIMIT) {
    const retryAfter = Math.ceil((globalDailyLimit.resetAt - now) / 1000);
    return {
      allowed: false,
      error: "SMS service temporarily unavailable. Please try again later.",
      retryAfterSeconds: retryAfter
    };
  }

  if (restaurantId) {
    let restaurantEntry = restaurantDailyLimits.get(restaurantId) || { count: 0, resetAt: now + 24 * 60 * 60 * 1000 };
    restaurantEntry = resetIfExpired(restaurantEntry);
    
    if (restaurantEntry.count >= RESTAURANT_DAILY_LIMIT) {
      const retryAfter = Math.ceil((restaurantEntry.resetAt - now) / 1000);
      return {
        allowed: false,
        error: `Daily SMS limit reached for your restaurant (${RESTAURANT_DAILY_LIMIT} per day). Resets in ${Math.ceil(retryAfter / 3600)} hours.`,
        retryAfterSeconds: retryAfter
      };
    }
  }

  let phoneEntry = phoneDailyLimits.get(phone) || { count: 0, resetAt: now + 24 * 60 * 60 * 1000 };
  phoneEntry = resetIfExpired(phoneEntry);
  
  if (phoneEntry.count >= PHONE_DAILY_LIMIT) {
    const retryAfter = Math.ceil((phoneEntry.resetAt - now) / 1000);
    return {
      allowed: false,
      error: `This phone number has received too many SMS today (${PHONE_DAILY_LIMIT} max). Please try again tomorrow.`,
      retryAfterSeconds: retryAfter
    };
  }

  return { allowed: true };
}

export function recordSMSSent(phone: string, restaurantId?: string): void {
  const now = Date.now();

  globalDailyLimit.count++;

  if (restaurantId) {
    let restaurantEntry = restaurantDailyLimits.get(restaurantId) || { count: 0, resetAt: now + 24 * 60 * 60 * 1000 };
    restaurantEntry = resetIfExpired(restaurantEntry);
    restaurantEntry.count++;
    restaurantDailyLimits.set(restaurantId, restaurantEntry);
  }

  let phoneEntry = phoneDailyLimits.get(phone) || { count: 0, resetAt: now + 24 * 60 * 60 * 1000 };
  phoneEntry = resetIfExpired(phoneEntry);
  phoneEntry.count++;
  phoneDailyLimits.set(phone, phoneEntry);
}

export function getSMSUsageStats(restaurantId?: string): {
  global: { used: number; limit: number; resetAt: Date };
  restaurant?: { used: number; limit: number; resetAt: Date };
} {
  const stats: any = {
    global: {
      used: globalDailyLimit.count,
      limit: GLOBAL_DAILY_LIMIT,
      resetAt: new Date(globalDailyLimit.resetAt)
    }
  };

  if (restaurantId) {
    const restaurantEntry = restaurantDailyLimits.get(restaurantId);
    if (restaurantEntry) {
      stats.restaurant = {
        used: restaurantEntry.count,
        limit: RESTAURANT_DAILY_LIMIT,
        resetAt: new Date(restaurantEntry.resetAt)
      };
    } else {
      stats.restaurant = {
        used: 0,
        limit: RESTAURANT_DAILY_LIMIT,
        resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
    }
  }

  return stats;
}
