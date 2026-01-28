import type { IStorage } from "../../storage";
import { LoyaltyService, type ILoyaltyService } from "./loyalty.service";
import { VoucherService, type IVoucherService } from "./voucher.service";
import { StatsService, type IStatsService } from "./stats.service";
import { ConfigService, type IConfigService } from "./config.service";
import { ReconciliationService, type IReconciliationService } from "./reconciliation.service";

export interface LoyaltyServices {
  loyalty: ILoyaltyService;
  voucher: IVoucherService;
  stats: IStatsService;
  config: IConfigService;
  reconciliation: IReconciliationService;
}

export function createLoyaltyServices(storage: IStorage): LoyaltyServices {
  return {
    loyalty: new LoyaltyService(storage),
    voucher: new VoucherService(storage),
    stats: new StatsService(storage),
    config: new ConfigService(storage),
    reconciliation: new ReconciliationService(storage)
  };
}

export { LoyaltyService, VoucherService, StatsService, ConfigService, ReconciliationService };
export type { ILoyaltyService, IVoucherService, IStatsService, IConfigService, IReconciliationService };
