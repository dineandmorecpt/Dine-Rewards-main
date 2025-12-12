import type { IStorage } from "../../storage";
import type { Voucher } from "@shared/schema";

export type VoucherStatus = "active" | "redeemed" | "expired";

export interface EnrichedVoucher extends Voucher {
  restaurantName: string;
  status: VoucherStatus;
}

export interface VoucherSelectionResult {
  code: string;
  voucher: EnrichedVoucher;
  codeExpiresAt: string;
}

export interface VoucherRedemptionResult {
  success: boolean;
  voucher: EnrichedVoucher;
  message: string;
}

export interface IVoucherService {
  getDinerVouchers(dinerId: string): Promise<EnrichedVoucher[]>;
  selectVoucherForPresentation(dinerId: string, voucherId: string): Promise<VoucherSelectionResult>;
  redeemVoucherByCode(restaurantId: string, code: string, billId?: string): Promise<VoucherRedemptionResult>;
  isVoucherValid(voucher: Voucher): { valid: boolean; reason?: string };
  isVoucherExpired(voucher: Voucher): boolean;
  getVoucherStatus(voucher: Voucher): VoucherStatus;
  isCodeExpired(codeSetAt: Date | string | null): boolean;
}

export class VoucherService implements IVoucherService {
  constructor(private storage: IStorage) {}

  private static CODE_VALIDITY_MINUTES = 15;

  getVoucherStatus(voucher: Voucher): VoucherStatus {
    if (voucher.isRedeemed) {
      return "redeemed";
    }
    if (this.isVoucherExpired(voucher)) {
      return "expired";
    }
    return "active";
  }

  isCodeExpired(codeSetAt: Date | string | null): boolean {
    if (!codeSetAt) return true;
    const setAtDate = typeof codeSetAt === 'string' ? new Date(codeSetAt) : codeSetAt;
    const now = new Date();
    const expiresAt = new Date(setAtDate.getTime() + VoucherService.CODE_VALIDITY_MINUTES * 60 * 1000);
    return now > expiresAt;
  }

  async getDinerVouchers(dinerId: string): Promise<EnrichedVoucher[]> {
    const vouchers = await this.storage.getVouchersByDiner(dinerId);
    
    return await Promise.all(
      vouchers.map(async (voucher) => {
        const restaurant = await this.storage.getRestaurant(voucher.restaurantId);
        return {
          ...voucher,
          restaurantName: restaurant?.name || "Unknown",
          status: this.getVoucherStatus(voucher)
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

    const restaurant = await this.storage.getRestaurant(voucher.restaurantId);
    const enrichedVoucher: EnrichedVoucher = {
      ...voucher,
      restaurantName: restaurant?.name || "Unknown",
      status: this.getVoucherStatus(voucher)
    };

    const codeExpiresAt = new Date(Date.now() + VoucherService.CODE_VALIDITY_MINUTES * 60 * 1000);

    return { code: voucher.code, voucher: enrichedVoucher, codeExpiresAt: codeExpiresAt.toISOString() };
  }

  async redeemVoucherByCode(
    restaurantId: string, 
    code: string,
    billId?: string
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

    const user = await this.storage.getUserByActiveVoucherCode(code);
    if (!user) {
      throw new Error("This voucher code has not been presented by the customer");
    }

    if (this.isCodeExpired(user.activeVoucherCodeSetAt)) {
      await this.storage.updateUserActiveVoucherCode(voucher.dinerId, null);
      throw new Error("This voucher code has expired. Please ask the customer to present the code again.");
    }

    const redeemedVoucher = await this.storage.redeemVoucher(voucher.id, billId);
    await this.storage.updateUserActiveVoucherCode(voucher.dinerId, null);

    const restaurant = await this.storage.getRestaurant(redeemedVoucher.restaurantId);
    const enrichedVoucher: EnrichedVoucher = {
      ...redeemedVoucher,
      restaurantName: restaurant?.name || "Unknown",
      status: this.getVoucherStatus(redeemedVoucher)
    };

    return {
      success: true,
      voucher: enrichedVoucher,
      message: `Voucher "${enrichedVoucher.title}" redeemed successfully!`
    };
  }
}
