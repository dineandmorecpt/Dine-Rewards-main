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
  redeemVoucherByCode(restaurantId: string, code: string, billId?: string, branchId?: string): Promise<VoucherRedemptionResult>;
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

  private generatePresentationCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
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

    // Generate a fresh temporary presentation code
    const presentationCode = this.generatePresentationCode();
    
    // Store both the code and voucher ID with the user
    await this.storage.updateUserActiveVoucherPresentation(dinerId, voucherId, presentationCode);

    const restaurant = await this.storage.getRestaurant(voucher.restaurantId);
    const enrichedVoucher: EnrichedVoucher = {
      ...voucher,
      restaurantName: restaurant?.name || "Unknown",
      status: this.getVoucherStatus(voucher)
    };

    const codeExpiresAt = new Date(Date.now() + VoucherService.CODE_VALIDITY_MINUTES * 60 * 1000);

    return { code: presentationCode, voucher: enrichedVoucher, codeExpiresAt: codeExpiresAt.toISOString() };
  }

  async redeemVoucherByCode(
    restaurantId: string, 
    code: string,
    billId?: string,
    branchId?: string
  ): Promise<VoucherRedemptionResult> {
    if (!code || !code.trim()) {
      throw new Error("Voucher code is required");
    }

    // Look up the user and their active voucher by the presentation code
    const result = await this.storage.getUserWithActiveVoucher(code);

    if (!result) {
      throw new Error("Invalid voucher code. Ask the customer to tap on the voucher first.");
    }

    const { user, voucher } = result;

    // Check if the presentation code has expired
    if (this.isCodeExpired(user.activeVoucherCodeSetAt)) {
      await this.storage.updateUserActiveVoucherPresentation(voucher.dinerId, null, null);
      throw new Error("This voucher code has expired. Please ask the customer to present the code again.");
    }

    const voucherRestaurant = await this.storage.getRestaurant(voucher.restaurantId);
    
    if (voucher.restaurantId !== restaurantId) {
      const voucherRestaurantName = voucherRestaurant?.name || "another restaurant";
      throw new Error(`This voucher belongs to ${voucherRestaurantName}. It cannot be redeemed here.`);
    }

    // Check branch-specific redemption scope if voucher has a voucherTypeId
    if (voucher.voucherTypeId && branchId) {
      const voucherType = await this.storage.getVoucherType(voucher.voucherTypeId);
      if (voucherType && voucherType.redemptionScope === "specific_branches") {
        const redeemableBranchIds = voucherType.redeemableBranchIds || [];
        if (redeemableBranchIds.length > 0 && !redeemableBranchIds.includes(branchId)) {
          // Get the branch name for a clearer error message
          const currentBranch = await this.storage.getBranch(branchId);
          const currentBranchName = currentBranch?.name || "this branch";
          
          // Get the names of valid branches
          const validBranchNames: string[] = [];
          for (const validBranchId of redeemableBranchIds) {
            const validBranch = await this.storage.getBranch(validBranchId);
            if (validBranch) {
              validBranchNames.push(validBranch.name);
            }
          }
          
          const validBranchList = validBranchNames.length > 0 
            ? validBranchNames.join(", ") 
            : "specific branches only";
          
          throw new Error(`This voucher cannot be redeemed at ${currentBranchName}. It is only valid at: ${validBranchList}.`);
        }
      }
    }

    const validation = this.isVoucherValid(voucher);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const redeemedVoucher = await this.storage.redeemVoucher(voucher.id, billId, branchId);
    
    // Clear both the active code and voucher ID
    await this.storage.updateUserActiveVoucherPresentation(voucher.dinerId, null, null);

    const enrichedVoucher: EnrichedVoucher = {
      ...redeemedVoucher,
      restaurantName: voucherRestaurant?.name || "Unknown",
      status: this.getVoucherStatus(redeemedVoucher)
    };

    return {
      success: true,
      voucher: enrichedVoucher,
      message: `Voucher "${enrichedVoucher.title}" redeemed successfully!`
    };
  }
}
