import type { IStorage } from "../../storage";
import type { Voucher } from "@shared/schema";

export interface VoucherSelectionResult {
  code: string;
  voucher: Voucher;
}

export interface VoucherRedemptionResult {
  success: boolean;
  voucher: Voucher;
  message: string;
}

export interface EnrichedVoucher extends Voucher {
  restaurantName: string;
}

export interface IVoucherService {
  getDinerVouchers(dinerId: string): Promise<EnrichedVoucher[]>;
  selectVoucherForPresentation(dinerId: string, voucherId: string): Promise<VoucherSelectionResult>;
  redeemVoucherByCode(restaurantId: string, code: string): Promise<VoucherRedemptionResult>;
  isVoucherValid(voucher: Voucher): { valid: boolean; reason?: string };
  isVoucherExpired(voucher: Voucher): boolean;
}

export class VoucherService implements IVoucherService {
  constructor(private storage: IStorage) {}

  async getDinerVouchers(dinerId: string): Promise<EnrichedVoucher[]> {
    const vouchers = await this.storage.getVouchersByDiner(dinerId);
    
    return await Promise.all(
      vouchers.map(async (voucher) => {
        const restaurant = await this.storage.getRestaurant(voucher.restaurantId);
        return {
          ...voucher,
          restaurantName: restaurant?.name || "Unknown"
        };
      })
    );
  }

  isVoucherExpired(voucher: Voucher): boolean {
    return new Date(voucher.expiryDate) < new Date();
  }

  isVoucherValid(voucher: Voucher): { valid: boolean; reason?: string } {
    if (voucher.isRedeemed) {
      return { valid: false, reason: "Voucher has already been redeemed" };
    }
    if (this.isVoucherExpired(voucher)) {
      return { valid: false, reason: "Voucher has expired" };
    }
    return { valid: true };
  }

  async selectVoucherForPresentation(
    dinerId: string, 
    voucherId: string
  ): Promise<VoucherSelectionResult> {
    const dinerVouchers = await this.storage.getVouchersByDiner(dinerId);
    const voucher = dinerVouchers.find(v => v.id === voucherId);

    if (!voucher) {
      throw new Error("Voucher not found");
    }

    const validation = this.isVoucherValid(voucher);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    await this.storage.updateUserActiveVoucherCode(dinerId, voucher.code);

    return { code: voucher.code, voucher };
  }

  async redeemVoucherByCode(
    restaurantId: string, 
    code: string
  ): Promise<VoucherRedemptionResult> {
    if (!code || !code.trim()) {
      throw new Error("Voucher code is required");
    }

    const voucher = await this.storage.getVoucherByCode(code);

    if (!voucher) {
      throw new Error("Invalid voucher code");
    }

    if (voucher.restaurantId !== restaurantId) {
      throw new Error("This voucher is not valid at this restaurant");
    }

    const validation = this.isVoucherValid(voucher);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const redeemedVoucher = await this.storage.redeemVoucher(voucher.id);
    await this.storage.updateUserActiveVoucherCode(voucher.dinerId, null);

    return {
      success: true,
      voucher: redeemedVoucher,
      message: `Voucher "${redeemedVoucher.title}" redeemed successfully!`
    };
  }
}
