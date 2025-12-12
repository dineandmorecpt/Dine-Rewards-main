import type { IStorage } from "../../storage";
import type { Restaurant, Transaction, PointsBalance, Voucher } from "@shared/schema";

export interface TransactionResult {
  transaction: Transaction;
  balance: PointsBalance;
  vouchersGenerated: Voucher[];
}

export interface EnrichedPointsBalance {
  id: string;
  dinerId: string;
  restaurantId: string;
  currentPoints: number;
  totalPointsEarned: number;
  totalVouchersGenerated: number;
  restaurantName: string;
  restaurantColor: string;
  pointsPerCurrency: number;
  pointsThreshold: number;
}

export interface ILoyaltyService {
  recordTransaction(dinerId: string, restaurantId: string, amountSpent: number): Promise<TransactionResult>;
  getBalancesForDiner(dinerId: string): Promise<EnrichedPointsBalance[]>;
  calculatePointsEarned(amountSpent: number, restaurant: Restaurant): number;
  shouldGenerateVoucher(currentPoints: number, threshold: number): boolean;
  getPointsUntilNextVoucher(currentPoints: number, threshold: number): number;
}

export class LoyaltyService implements ILoyaltyService {
  constructor(private storage: IStorage) {}

  async getBalancesForDiner(dinerId: string): Promise<EnrichedPointsBalance[]> {
    const balances = await this.storage.getPointsBalancesByDiner(dinerId);
    
    return await Promise.all(
      balances.map(async (balance) => {
        const restaurant = await this.storage.getRestaurant(balance.restaurantId);
        return {
          id: balance.id,
          dinerId: balance.dinerId,
          restaurantId: balance.restaurantId,
          currentPoints: balance.currentPoints,
          totalPointsEarned: balance.totalPointsEarned,
          totalVouchersGenerated: balance.totalVouchersGenerated,
          restaurantName: restaurant?.name || "Unknown",
          restaurantColor: restaurant?.color || "bg-primary",
          pointsPerCurrency: restaurant?.pointsPerCurrency || 1,
          pointsThreshold: restaurant?.pointsThreshold || 1000
        };
      })
    );
  }

  calculatePointsEarned(amountSpent: number, restaurant: Restaurant): number {
    return Math.floor(amountSpent * restaurant.pointsPerCurrency);
  }

  shouldGenerateVoucher(currentPoints: number, threshold: number): boolean {
    return currentPoints >= threshold;
  }

  getPointsUntilNextVoucher(currentPoints: number, threshold: number): number {
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
    amountSpent: number
  ): Promise<TransactionResult> {
    const restaurant = await this.storage.getRestaurant(restaurantId);
    if (!restaurant) {
      throw new Error("Restaurant not found");
    }

    const pointsEarned = this.calculatePointsEarned(amountSpent, restaurant);

    const transaction = await this.storage.createTransaction({
      dinerId,
      restaurantId,
      amountSpent: amountSpent.toString(),
      pointsEarned
    });

    let balance = await this.storage.getPointsBalance(dinerId, restaurantId);
    if (!balance) {
      balance = await this.storage.createPointsBalance({
        dinerId,
        restaurantId,
        currentPoints: 0,
        totalPointsEarned: 0,
        totalVouchersGenerated: 0
      });
    }

    let newCurrentPoints = balance.currentPoints + pointsEarned;
    const newTotalPointsEarned = balance.totalPointsEarned + pointsEarned;
    let newVouchersGenerated = balance.totalVouchersGenerated;
    const vouchersToGenerate: Voucher[] = [];

    const threshold = restaurant.pointsThreshold;

    while (this.shouldGenerateVoucher(newCurrentPoints, threshold)) {
      newCurrentPoints -= threshold;
      newVouchersGenerated += 1;

      const voucher = await this.storage.createVoucher({
        dinerId,
        restaurantId,
        title: restaurant.voucherValue,
        code: this.generateVoucherCode(restaurant.name),
        expiryDate: this.calculateExpiryDate(restaurant.voucherValidityDays),
        isRedeemed: false,
        redeemedAt: null
      });

      vouchersToGenerate.push(voucher);
    }

    const updatedBalance = await this.storage.updatePointsBalance(
      balance.id,
      newCurrentPoints,
      newTotalPointsEarned,
      newVouchersGenerated
    );

    return {
      transaction,
      balance: updatedBalance,
      vouchersGenerated: vouchersToGenerate
    };
  }
}
