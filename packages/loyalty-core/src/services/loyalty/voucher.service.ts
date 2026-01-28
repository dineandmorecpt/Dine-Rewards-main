import type { ILoyaltyStorage } from "../../storage";
import type { BaseVoucher, BaseVoucherType } from "../../types";

export interface ClaimVoucherParams {
  customerId: string;
  businessId: string;
  voucherTypeId: string;
}

export interface RedeemVoucherParams {
  code: string;
  businessId: string;
  billId: string;
  branchId?: string | null;
}

export interface IVoucherService {
  claimVoucher(params: ClaimVoucherParams): Promise<BaseVoucher>;
  redeemVoucher(params: RedeemVoucherParams): Promise<{ success: boolean; voucher: BaseVoucher; message: string }>;
  getCustomerVouchers(customerId: string, businessId: string): Promise<BaseVoucher[]>;
  generateVoucherCode(prefix?: string): string;
}

export class VoucherService implements IVoucherService {
  constructor(private storage: ILoyaltyStorage) {}

  async claimVoucher(params: ClaimVoucherParams): Promise<BaseVoucher> {
    const { customerId, businessId, voucherTypeId } = params;

    const voucherType = await this.storage.getVoucherType(voucherTypeId);
    if (!voucherType) {
      throw new Error("Voucher type not found");
    }

    if (!voucherType.isActive) {
      throw new Error("This voucher type is no longer available");
    }

    const balance = await this.storage.getPointsBalance(customerId, businessId);
    if (!balance || balance.currentCredits < voucherType.creditsCost) {
      throw new Error("Insufficient credits to claim this voucher");
    }

    await this.storage.updatePointsBalance(balance.id, {
      currentCredits: balance.currentCredits - voucherType.creditsCost,
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + voucherType.validityDays);

    const voucher = await this.storage.createVoucher({
      customerId,
      businessId,
      voucherTypeId,
      code: this.generateVoucherCode(),
      status: "active",
      earnedAt: new Date(),
      expiresAt,
      redeemedAt: null,
      redeemedBillId: null,
    });

    return voucher;
  }

  async redeemVoucher(params: RedeemVoucherParams): Promise<{ success: boolean; voucher: BaseVoucher; message: string }> {
    const { code, businessId, billId, branchId } = params;

    const voucher = await this.storage.getVoucherByCode(code);
    if (!voucher) {
      throw new Error("Invalid voucher code");
    }

    if (voucher.businessId !== businessId) {
      throw new Error("This voucher cannot be redeemed at this business");
    }

    if (voucher.status === "redeemed") {
      throw new Error("This voucher has already been redeemed");
    }

    if (voucher.status === "expired" || new Date() > voucher.expiresAt) {
      throw new Error("This voucher has expired");
    }

    const updatedVoucher = await this.storage.updateVoucher(voucher.id, {
      status: "redeemed",
      redeemedAt: new Date(),
      redeemedBillId: billId,
    });

    return {
      success: true,
      voucher: updatedVoucher as BaseVoucher,
      message: "Voucher redeemed successfully",
    };
  }

  async getCustomerVouchers(customerId: string, businessId: string): Promise<BaseVoucher[]> {
    return this.storage.getVouchersByCustomer(customerId, businessId);
  }

  generateVoucherCode(prefix?: string): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code += "-";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return prefix ? `${prefix}-${code}` : code;
  }
}
