import type { IStorage } from "../../storage";

export interface RestaurantStats {
  dinersLast30Days: number;
  totalSpent: number;
  vouchersRedeemed: number;
  totalRegisteredDiners: number;
  transactions: any[];
}

export interface IStatsService {
  getRestaurantStats(restaurantId: string, branchId?: string | null): Promise<RestaurantStats>;
}

export class StatsService implements IStatsService {
  constructor(private storage: IStorage) {}

  async getRestaurantStats(restaurantId: string, branchId?: string | null): Promise<RestaurantStats> {
    const recentTransactions = await this.storage.getTransactionsByRestaurant(restaurantId, true, branchId);
    
    const uniqueDinerIds = new Set(recentTransactions.map(t => t.dinerId));
    const dinersLast30Days = uniqueDinerIds.size;
    
    const totalSpent = recentTransactions.reduce(
      (sum, t) => sum + Number(t.amountSpent), 
      0
    );
    
    const restaurantVouchers = await this.storage.getVouchersByRestaurant(restaurantId, branchId);
    const vouchersRedeemed = restaurantVouchers.filter(v => v.isRedeemed).length;
    
    const totalRegisteredDiners = await this.storage.countAllDiners();

    return {
      dinersLast30Days,
      totalSpent,
      vouchersRedeemed,
      totalRegisteredDiners,
      transactions: recentTransactions
    };
  }
}
