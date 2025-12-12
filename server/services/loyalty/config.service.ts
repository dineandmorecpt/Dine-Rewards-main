import type { IStorage } from "../../storage";
import type { Restaurant } from "@shared/schema";

export interface RestaurantSettings {
  voucherValue?: string;
  voucherValidityDays?: number;
  pointsPerCurrency?: number;
  pointsThreshold?: number;
}

export interface IConfigService {
  updateRestaurantSettings(restaurantId: string, settings: RestaurantSettings): Promise<Restaurant>;
  validateSettings(settings: RestaurantSettings): { valid: boolean; errors: string[] };
}

export class ConfigService implements IConfigService {
  constructor(private storage: IStorage) {}

  validateSettings(settings: RestaurantSettings): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (settings.voucherValidityDays !== undefined) {
      if (settings.voucherValidityDays < 1) {
        errors.push("Voucher validity must be at least 1 day");
      }
      if (settings.voucherValidityDays > 365) {
        errors.push("Voucher validity cannot exceed 365 days");
      }
    }

    if (settings.pointsPerCurrency !== undefined) {
      if (settings.pointsPerCurrency < 1) {
        errors.push("Points per currency must be at least 1");
      }
      if (settings.pointsPerCurrency > 100) {
        errors.push("Points per currency cannot exceed 100");
      }
    }

    if (settings.pointsThreshold !== undefined) {
      if (settings.pointsThreshold < 100) {
        errors.push("Points threshold must be at least 100");
      }
      if (settings.pointsThreshold > 10000) {
        errors.push("Points threshold cannot exceed 10,000");
      }
    }

    if (settings.voucherValue !== undefined && !settings.voucherValue.trim()) {
      errors.push("Voucher value cannot be empty");
    }

    return { valid: errors.length === 0, errors };
  }

  async updateRestaurantSettings(
    restaurantId: string, 
    settings: RestaurantSettings
  ): Promise<Restaurant> {
    const restaurant = await this.storage.getRestaurant(restaurantId);
    if (!restaurant) {
      throw new Error("Restaurant not found");
    }

    const validation = this.validateSettings(settings);
    if (!validation.valid) {
      throw new Error(validation.errors.join(", "));
    }

    return await this.storage.updateRestaurantSettings(restaurantId, settings);
  }
}
