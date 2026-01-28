export * from "./loyalty.service";
export * from "./voucher.service";

import type { ILoyaltyStorage } from "../../storage";
import { LoyaltyService, type ILoyaltyService } from "./loyalty.service";
import { VoucherService, type IVoucherService } from "./voucher.service";

export interface LoyaltyServices {
  loyalty: ILoyaltyService;
  voucher: IVoucherService;
}

export function createLoyaltyServices(storage: ILoyaltyStorage): LoyaltyServices {
  return {
    loyalty: new LoyaltyService(storage),
    voucher: new VoucherService(storage),
  };
}
