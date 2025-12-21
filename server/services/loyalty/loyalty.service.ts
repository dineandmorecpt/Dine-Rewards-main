import type { IStorage } from "../../storage";
import type { Restaurant, Transaction, PointsBalance, Voucher, VoucherType } from "@shared/schema";

export interface TransactionResult {
  transaction: Transaction;
  balance: PointsBalance;
  creditsEarned: number; // How many voucher credits were earned from this transaction
}

export interface VoucherRedemptionResult {
  voucher: Voucher;
  balance: PointsBalance;
}

export interface EnrichedPointsBalance {
  id: string;
  dinerId: string;
  restaurantId: string;
  branchId: string | null;
  branchName: string | null;
  currentPoints: number;
  totalPointsEarned: number;
  totalVouchersGenerated: number;
  availableVoucherCredits: number;
  totalVoucherCreditsEarned: number;
  restaurantName: string;
  restaurantColor: string;
  pointsPerCurrency: number;
  pointsThreshold: number;
  loyaltyScope: string; // 'organization' | 'branch'
}

export interface ILoyaltyService {
  recordTransaction(dinerId: string, restaurantId: string, amountSpent: number, billId?: string, branchId?: string): Promise<TransactionResult>;
  getBalancesForDiner(dinerId: string): Promise<EnrichedPointsBalance[]>;
  calculatePointsEarned(amountSpent: number, restaurant: Restaurant): number;
  shouldEarnCredit(currentPoints: number, threshold: number): boolean;
  getPointsUntilNextCredit(currentPoints: number, threshold: number): number;
  redeemVoucherCredit(dinerId: string, restaurantId: string, voucherTypeId: string, branchId?: string): Promise<VoucherRedemptionResult>;
}

export class LoyaltyService implements ILoyaltyService {
  constructor(private storage: IStorage) {}

  async getBalancesForDiner(dinerId: string): Promise<EnrichedPointsBalance[]> {
    const balances = await this.storage.getPointsBalancesByDiner(dinerId);
    
    return await Promise.all(
      balances.map(async (balance) => {
        const restaurant = await this.storage.getRestaurant(balance.restaurantId);
        let branchName: string | null = null;
        if (balance.branchId) {
          const branch = await this.storage.getBranch(balance.branchId);
          branchName = branch?.name || null;
        }
        return {
          id: balance.id,
          dinerId: balance.dinerId,
          restaurantId: balance.restaurantId,
          branchId: balance.branchId || null,
          branchName,
          currentPoints: balance.currentPoints,
          totalPointsEarned: balance.totalPointsEarned,
          totalVouchersGenerated: balance.totalVouchersGenerated,
          availableVoucherCredits: balance.availableVoucherCredits,
          totalVoucherCreditsEarned: balance.totalVoucherCreditsEarned,
          restaurantName: restaurant?.name || "Unknown",
          restaurantColor: restaurant?.color || "bg-primary",
          pointsPerCurrency: restaurant?.pointsPerCurrency || 1,
          pointsThreshold: restaurant?.pointsThreshold || 1000,
          loyaltyScope: restaurant?.loyaltyScope || "organization"
        };
      })
    );
  }

  calculatePointsEarned(amountSpent: number, restaurant: Restaurant): number {
    return Math.floor(amountSpent * restaurant.pointsPerCurrency);
  }

  shouldEarnCredit(currentPoints: number, threshold: number): boolean {
    return currentPoints >= threshold;
  }

  getPointsUntilNextCredit(currentPoints: number, threshold: number): number {
    return Math.max(0, threshold - (currentPoints % threshold));
  }

  private generateVoucherCode(restaurantName: string): string {
    const prefix = restaurantName.substring(0, 4).toUpperCase().replace(/\s/g, '');
    const suffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${suffix}`;
  }

  private calculateExpiryDate(validityDays: number): Date {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + validityDays);
    return expiry;
  }

  async recordTransaction(
    dinerId: string, 
    restaurantId: string, 
    amountSpent: number,
    billId?: string,
    branchId?: string
  ): Promise<TransactionResult> {
    const restaurant = await this.storage.getRestaurant(restaurantId);
    if (!restaurant) {
      throw new Error("Restaurant not found");
    }

    // Enforce branchId when loyaltyScope is 'branch'
    const isBranchSpecific = restaurant.loyaltyScope === 'branch';
    if (isBranchSpecific && !branchId) {
      throw new Error("Branch ID is required for branch-specific loyalty programs");
    }

    const pointsEarned = this.calculatePointsEarned(amountSpent, restaurant);

    // Create transaction with branch info
    const transaction = await this.storage.createTransaction({
      dinerId,
      restaurantId,
      branchId: branchId || null,
      amountSpent: amountSpent.toString(),
      pointsEarned,
      billId: billId || null
    });

    // Determine which balance to use based on loyaltyScope
    const balanceBranchId = isBranchSpecific ? branchId : null;

    let balance = await this.storage.getPointsBalance(dinerId, restaurantId, balanceBranchId);
    if (!balance) {
      balance = await this.storage.createPointsBalance({
        dinerId,
        restaurantId,
        branchId: balanceBranchId,
        currentPoints: 0,
        totalPointsEarned: 0,
        totalVouchersGenerated: 0,
        availableVoucherCredits: 0,
        totalVoucherCreditsEarned: 0
      });
    }

    let newCurrentPoints = balance.currentPoints + pointsEarned;
    const newTotalPointsEarned = balance.totalPointsEarned + pointsEarned;
    let newAvailableCredits = balance.availableVoucherCredits;
    let newTotalCreditsEarned = balance.totalVoucherCreditsEarned;
    let creditsEarned = 0;

    const threshold = restaurant.pointsThreshold;

    // Award voucher credits (not actual vouchers) when threshold is reached
    while (this.shouldEarnCredit(newCurrentPoints, threshold)) {
      newCurrentPoints -= threshold;
      newAvailableCredits += 1;
      newTotalCreditsEarned += 1;
      creditsEarned += 1;
    }

    const updatedBalance = await this.storage.updatePointsBalance(balance.id, {
      currentPoints: newCurrentPoints,
      totalPointsEarned: newTotalPointsEarned,
      availableVoucherCredits: newAvailableCredits,
      totalVoucherCreditsEarned: newTotalCreditsEarned
    });

    return {
      transaction,
      balance: updatedBalance,
      creditsEarned
    };
  }

  // Redeem a voucher credit by selecting a voucher type - creates an actual voucher
  async redeemVoucherCredit(
    dinerId: string, 
    restaurantId: string, 
    voucherTypeId: string,
    branchId?: string
  ): Promise<VoucherRedemptionResult> {
    // Get the voucher type
    const voucherType = await this.storage.getVoucherType(voucherTypeId);
    if (!voucherType) {
      throw new Error("Voucher type not found");
    }
    if (!voucherType.isActive) {
      throw new Error("This voucher type is no longer available");
    }
    if (voucherType.restaurantId !== restaurantId) {
      throw new Error("Voucher type does not belong to this restaurant");
    }

    // Get the restaurant
    const restaurant = await this.storage.getRestaurant(restaurantId);
    if (!restaurant) {
      throw new Error("Restaurant not found");
    }

    // Enforce branchId when loyaltyScope is 'branch'
    const isBranchSpecific = restaurant.loyaltyScope === 'branch';
    if (isBranchSpecific && !branchId) {
      throw new Error("Branch ID is required for branch-specific loyalty programs");
    }
    const balanceBranchId = isBranchSpecific ? branchId : null;

    // Get the diner's balance
    const balance = await this.storage.getPointsBalance(dinerId, restaurantId, balanceBranchId);
    if (!balance) {
      throw new Error("No points balance found for this restaurant");
    }

    // Check if diner has enough credits
    if (balance.availableVoucherCredits < voucherType.creditsCost) {
      throw new Error(`You need ${voucherType.creditsCost} credit(s) but only have ${balance.availableVoucherCredits}`);
    }

    // For branch-specific restaurants, voucher is tied to the branch
    const voucherBranchId = isBranchSpecific ? (branchId || voucherType.branchId || null) : null;

    // Create the actual voucher
    const voucher = await this.storage.createVoucher({
      dinerId,
      restaurantId,
      branchId: voucherBranchId,
      voucherTypeId,
      title: voucherType.name,
      code: this.generateVoucherCode(restaurant.name),
      expiryDate: this.calculateExpiryDate(voucherType.validityDays),
      isRedeemed: false,
      redeemedAt: null
    });

    // Deduct credits and increment vouchers generated
    const updatedBalance = await this.storage.updatePointsBalance(balance.id, {
      availableVoucherCredits: balance.availableVoucherCredits - voucherType.creditsCost,
      totalVouchersGenerated: balance.totalVouchersGenerated + 1
    });

    return {
      voucher,
      balance: updatedBalance
    };
  }
}
