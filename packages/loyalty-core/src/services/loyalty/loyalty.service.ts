import type { IStorage } from "../../storage";
import type { Restaurant, Transaction, PointsBalance, Voucher, VoucherType } from "@shared/schema";

export interface TransactionResult {
  transaction: Transaction;
  balance: PointsBalance;
  creditsEarned: number; // How many voucher credits were earned from this transaction
  vouchersGenerated: Voucher[]; // Vouchers auto-generated from earned credits
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
  currentVisits: number;
  totalVisits: number;
  totalVouchersGenerated: number;
  pointsCredits: number;
  visitCredits: number;
  availableVoucherCredits: number;
  totalVoucherCreditsEarned: number;
  restaurantName: string;
  restaurantColor: string;
  pointsPerCurrency: number;
  pointsThreshold: number;
  voucherEarningMode: string; // 'points' | 'visits' (deprecated - now per voucher type)
  visitThreshold: number;
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
          currentVisits: balance.currentVisits,
          totalVisits: balance.totalVisits,
          totalVouchersGenerated: balance.totalVouchersGenerated,
          pointsCredits: balance.pointsCredits || 0,
          visitCredits: balance.visitCredits || 0,
          availableVoucherCredits: balance.availableVoucherCredits,
          totalVoucherCreditsEarned: balance.totalVoucherCreditsEarned,
          restaurantName: restaurant?.name || "Unknown",
          restaurantColor: restaurant?.color || "bg-primary",
          pointsPerCurrency: restaurant?.pointsPerCurrency || 1,
          pointsThreshold: restaurant?.pointsThreshold || 1000,
          voucherEarningMode: restaurant?.voucherEarningMode || "points",
          visitThreshold: restaurant?.visitThreshold || 10,
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
        currentVisits: 0,
        totalVisits: 0,
        totalVouchersGenerated: 0,
        availableVoucherCredits: 0,
        totalVoucherCreditsEarned: 0
      });
    }

    let newCurrentPoints = balance.currentPoints + pointsEarned;
    const newTotalPointsEarned = balance.totalPointsEarned + pointsEarned;
    let newCurrentVisits = balance.currentVisits + 1; // Each transaction = 1 visit
    const newTotalVisits = balance.totalVisits + 1;
    let newTotalCreditsEarned = balance.totalVoucherCreditsEarned;
    
    // Mode-specific credits
    let newPointsCredits = balance.pointsCredits;
    let newVisitCredits = balance.visitCredits;
    let creditsEarned = 0;

    // Award points credits when points threshold is reached
    const pointsThreshold = restaurant.pointsThreshold;
    while (this.shouldEarnCredit(newCurrentPoints, pointsThreshold)) {
      newCurrentPoints -= pointsThreshold;
      newPointsCredits += 1;
      newTotalCreditsEarned += 1;
      creditsEarned += 1;
    }

    // Award visit credits when visit threshold is reached
    const visitThreshold = restaurant.visitThreshold || 10;
    while (newCurrentVisits >= visitThreshold) {
      newCurrentVisits -= visitThreshold;
      newVisitCredits += 1;
      newTotalCreditsEarned += 1;
      creditsEarned += 1;
    }

    const updatedBalance = await this.storage.updatePointsBalance(balance.id, {
      currentPoints: newCurrentPoints,
      totalPointsEarned: newTotalPointsEarned,
      currentVisits: newCurrentVisits,
      totalVisits: newTotalVisits,
      pointsCredits: newPointsCredits,
      visitCredits: newVisitCredits,
      totalVoucherCreditsEarned: newTotalCreditsEarned
    });

    // Auto-generate vouchers for earned credits
    const vouchersGenerated: Voucher[] = [];
    let currentBalance = updatedBalance;
    
    // Get active voucher types for this restaurant
    const voucherTypes = await this.storage.getActiveVoucherTypesByRestaurant(restaurantId);
    
    if (voucherTypes.length > 0) {
      // Process points credits - find voucher types that use 'points' earning mode
      const pointsVoucherType = voucherTypes.find(vt => vt.earningMode === 'points');
      if (pointsVoucherType && currentBalance.pointsCredits >= pointsVoucherType.creditsCost) {
        // Generate vouchers for each credit the diner can afford
        while (currentBalance.pointsCredits >= pointsVoucherType.creditsCost) {
          const voucher = await this.storage.createVoucher({
            dinerId,
            restaurantId,
            branchId: isBranchSpecific ? branchId : null,
            voucherTypeId: pointsVoucherType.id,
            title: pointsVoucherType.name,
            code: null,
            expiryDate: this.calculateExpiryDate(pointsVoucherType.validityDays),
            isRedeemed: false,
            redeemedAt: null
          });
          vouchersGenerated.push(voucher);
          
          // Deduct credits
          currentBalance = await this.storage.updatePointsBalance(currentBalance.id, {
            pointsCredits: currentBalance.pointsCredits - pointsVoucherType.creditsCost,
            totalVouchersGenerated: currentBalance.totalVouchersGenerated + 1
          });
        }
      }
      
      // Process visit credits - find voucher types that use 'visits' earning mode
      const visitsVoucherType = voucherTypes.find(vt => vt.earningMode === 'visits');
      if (visitsVoucherType && currentBalance.visitCredits >= visitsVoucherType.creditsCost) {
        while (currentBalance.visitCredits >= visitsVoucherType.creditsCost) {
          const voucher = await this.storage.createVoucher({
            dinerId,
            restaurantId,
            branchId: isBranchSpecific ? branchId : null,
            voucherTypeId: visitsVoucherType.id,
            title: visitsVoucherType.name,
            code: null,
            expiryDate: this.calculateExpiryDate(visitsVoucherType.validityDays),
            isRedeemed: false,
            redeemedAt: null
          });
          vouchersGenerated.push(voucher);
          
          currentBalance = await this.storage.updatePointsBalance(currentBalance.id, {
            visitCredits: currentBalance.visitCredits - visitsVoucherType.creditsCost,
            totalVouchersGenerated: currentBalance.totalVouchersGenerated + 1
          });
        }
      }
    }

    return {
      transaction,
      balance: currentBalance,
      creditsEarned,
      vouchersGenerated
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

    // Determine which credits to consume based on voucher type's earning mode
    const voucherEarningMode = voucherType.earningMode || 'points';
    const availableCredits = voucherEarningMode === 'visits' ? balance.visitCredits : balance.pointsCredits;
    
    // Check if diner has enough credits of the right type
    if (availableCredits < voucherType.creditsCost) {
      const creditsType = voucherEarningMode === 'visits' ? 'visit' : 'points';
      throw new Error(`You need ${voucherType.creditsCost} ${creditsType} credit(s) but only have ${availableCredits}`);
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
      code: null,
      expiryDate: this.calculateExpiryDate(voucherType.validityDays),
      isRedeemed: false,
      redeemedAt: null
    });

    // Deduct credits from the correct mode-specific balance
    const balanceUpdates: Record<string, number> = {
      totalVouchersGenerated: balance.totalVouchersGenerated + 1
    };
    
    if (voucherEarningMode === 'visits') {
      balanceUpdates.visitCredits = balance.visitCredits - voucherType.creditsCost;
    } else {
      balanceUpdates.pointsCredits = balance.pointsCredits - voucherType.creditsCost;
    }
    
    const updatedBalance = await this.storage.updatePointsBalance(balance.id, balanceUpdates);

    return {
      voucher,
      balance: updatedBalance
    };
  }
}
