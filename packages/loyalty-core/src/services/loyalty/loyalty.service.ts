import type { ILoyaltyStorage } from "../../storage";
import type { BaseTransaction, BasePointsBalance, BaseBusiness } from "../../types";

export interface RecordTransactionParams {
  customerId: string;
  businessId: string;
  branchId?: string | null;
  billId?: string | null;
  amountSpent: number;
}

export interface RecordTransactionResult {
  transaction: BaseTransaction;
  pointsEarned: number;
  creditsEarned: number;
  newBalance: BasePointsBalance;
  voucherGenerated?: boolean;
}

export interface ILoyaltyService {
  recordTransaction(params: RecordTransactionParams): Promise<RecordTransactionResult>;
  getCustomerBalance(customerId: string, businessId: string, branchId?: string | null): Promise<BasePointsBalance | null>;
  calculatePointsForAmount(business: BaseBusiness, amount: number): number;
  calculateCreditsEarned(business: BaseBusiness, currentPoints: number, newPoints: number): number;
}

export class LoyaltyService implements ILoyaltyService {
  constructor(private storage: ILoyaltyStorage) {}

  async recordTransaction(params: RecordTransactionParams): Promise<RecordTransactionResult> {
    const { customerId, businessId, branchId, billId, amountSpent } = params;

    const business = await this.storage.getBusiness(businessId);
    if (!business) {
      throw new Error("Business not found");
    }

    const pointsEarned = this.calculatePointsForAmount(business, amountSpent);

    const transaction = await this.storage.createTransaction({
      customerId,
      businessId,
      branchId: branchId || null,
      billId: billId || null,
      amountSpent: amountSpent.toString(),
      pointsEarned,
      transactionDate: new Date(),
    });

    const effectiveBranchId = business.loyaltyScope === "branch" ? branchId : null;
    let balance = await this.storage.getPointsBalance(customerId, businessId, effectiveBranchId);

    const previousPoints = balance?.currentPoints || 0;
    const newPoints = previousPoints + pointsEarned;
    const creditsEarned = this.calculateCreditsEarned(business, previousPoints, newPoints);
    const remainingPoints = newPoints % business.pointsThreshold;

    if (balance) {
      balance = await this.storage.updatePointsBalance(balance.id, {
        totalPoints: balance.totalPoints + pointsEarned,
        currentPoints: remainingPoints,
        totalCredits: balance.totalCredits + creditsEarned,
        currentCredits: balance.currentCredits + creditsEarned,
        visitCount: balance.visitCount + 1,
        lastVisitAt: new Date(),
      }) as BasePointsBalance;
    } else {
      balance = await this.storage.upsertPointsBalance({
        customerId,
        businessId,
        branchId: effectiveBranchId || null,
        totalPoints: pointsEarned,
        currentPoints: remainingPoints,
        totalCredits: creditsEarned,
        currentCredits: creditsEarned,
        visitCount: 1,
        lastVisitAt: new Date(),
      });
    }

    return {
      transaction,
      pointsEarned,
      creditsEarned,
      newBalance: balance,
      voucherGenerated: creditsEarned > 0,
    };
  }

  async getCustomerBalance(
    customerId: string,
    businessId: string,
    branchId?: string | null
  ): Promise<BasePointsBalance | null> {
    const balance = await this.storage.getPointsBalance(customerId, businessId, branchId);
    return balance || null;
  }

  calculatePointsForAmount(business: BaseBusiness, amount: number): number {
    return Math.floor(amount * business.pointsPerCurrency);
  }

  calculateCreditsEarned(business: BaseBusiness, currentPoints: number, newPoints: number): number {
    const threshold = business.pointsThreshold;
    const previousCredits = Math.floor(currentPoints / threshold);
    const newCredits = Math.floor(newPoints / threshold);
    return newCredits - previousCredits;
  }
}
