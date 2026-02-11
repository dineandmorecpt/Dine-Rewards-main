import { describe, it, expect, vi, beforeEach } from "vitest";
import { VoucherService } from "../server/services/loyalty/voucher.service";
import {
  createMockStorage,
  createMockVoucher,
  createMockVoucherType,
  createMockRestaurant,
} from "./mock-storage";

describe("VoucherService", () => {
  let service: VoucherService;
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    service = new VoucherService(mockStorage as any);
  });

  describe("getVoucherStatus", () => {
    it("should return 'redeemed' for redeemed vouchers", () => {
      const voucher = createMockVoucher({ isRedeemed: true });
      expect(service.getVoucherStatus(voucher)).toBe("redeemed");
    });

    it("should return 'expired' for expired vouchers", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const voucher = createMockVoucher({ expiryDate: pastDate, isRedeemed: false });
      expect(service.getVoucherStatus(voucher)).toBe("expired");
    });

    it("should return 'active' for valid, unredeemed vouchers", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const voucher = createMockVoucher({ expiryDate: futureDate, isRedeemed: false });
      expect(service.getVoucherStatus(voucher)).toBe("active");
    });

    it("should prioritise 'redeemed' over 'expired'", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const voucher = createMockVoucher({ isRedeemed: true, expiryDate: pastDate });
      expect(service.getVoucherStatus(voucher)).toBe("redeemed");
    });
  });

  describe("isVoucherExpired", () => {
    it("should return true for past dates", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const voucher = createMockVoucher({ expiryDate: pastDate });
      expect(service.isVoucherExpired(voucher)).toBe(true);
    });

    it("should return false for future dates", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const voucher = createMockVoucher({ expiryDate: futureDate });
      expect(service.isVoucherExpired(voucher)).toBe(false);
    });
  });

  describe("isVoucherValid", () => {
    it("should return valid for active vouchers", () => {
      const voucher = createMockVoucher();
      const result = service.isVoucherValid(voucher);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should return invalid with reason for redeemed vouchers", () => {
      const voucher = createMockVoucher({ isRedeemed: true });
      const result = service.isVoucherValid(voucher);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("already been redeemed");
    });

    it("should return invalid with reason for expired vouchers", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const voucher = createMockVoucher({ expiryDate: pastDate });
      const result = service.isVoucherValid(voucher);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("expired");
    });
  });

  describe("isCodeExpired", () => {
    it("should return true when codeSetAt is null", () => {
      expect(service.isCodeExpired(null)).toBe(true);
    });

    it("should return false for recently set codes", () => {
      const now = new Date();
      expect(service.isCodeExpired(now)).toBe(false);
    });

    it("should return true for codes older than 15 minutes", () => {
      const sixteenMinsAgo = new Date(Date.now() - 16 * 60 * 1000);
      expect(service.isCodeExpired(sixteenMinsAgo)).toBe(true);
    });

    it("should handle string dates", () => {
      const now = new Date().toISOString();
      expect(service.isCodeExpired(now)).toBe(false);
    });

    it("should return false for codes at exactly 14 minutes", () => {
      const fourteenMinsAgo = new Date(Date.now() - 14 * 60 * 1000);
      expect(service.isCodeExpired(fourteenMinsAgo)).toBe(false);
    });
  });

  describe("selectVoucherForPresentation", () => {
    it("should generate a presentation code for a valid voucher", async () => {
      const voucher = createMockVoucher();
      const restaurant = createMockRestaurant();

      mockStorage.getVouchersByDiner.mockResolvedValue([voucher]);
      mockStorage.updateUserActiveVoucherPresentation.mockResolvedValue({});
      mockStorage.getRestaurant.mockResolvedValue(restaurant);

      const result = await service.selectVoucherForPresentation("diner-1", "vouch-1");

      expect(result.code).toBeDefined();
      expect(result.code.length).toBe(12);
      expect(result.voucher.restaurantName).toBe("Test Restaurant");
      expect(result.codeExpiresAt).toBeDefined();
    });

    it("should throw if voucher not found", async () => {
      mockStorage.getVouchersByDiner.mockResolvedValue([]);

      await expect(
        service.selectVoucherForPresentation("diner-1", "nonexistent")
      ).rejects.toThrow("Voucher not found");
    });

    it("should throw if voucher is redeemed", async () => {
      const voucher = createMockVoucher({ isRedeemed: true });
      mockStorage.getVouchersByDiner.mockResolvedValue([voucher]);

      await expect(
        service.selectVoucherForPresentation("diner-1", "vouch-1")
      ).rejects.toThrow("already been redeemed");
    });
  });

  describe("redeemVoucherByCode", () => {
    it("should throw if code is empty", async () => {
      await expect(
        service.redeemVoucherByCode("rest-1", "")
      ).rejects.toThrow("code is required");
    });

    it("should throw if code not found", async () => {
      mockStorage.getUserWithActiveVoucher.mockResolvedValue(null);

      await expect(
        service.redeemVoucherByCode("rest-1", "INVALIDCODE1")
      ).rejects.toThrow("Invalid voucher code");
    });

    it("should throw if code has expired", async () => {
      const expiredCodeTime = new Date(Date.now() - 20 * 60 * 1000);
      const voucher = createMockVoucher();
      mockStorage.getUserWithActiveVoucher.mockResolvedValue({
        user: { activeVoucherCodeSetAt: expiredCodeTime },
        voucher,
      });
      mockStorage.updateUserActiveVoucherPresentation.mockResolvedValue({});

      await expect(
        service.redeemVoucherByCode("rest-1", "EXPIREDCODE1")
      ).rejects.toThrow("expired");
    });

    it("should throw if voucher belongs to different restaurant", async () => {
      const recentCodeTime = new Date();
      const voucher = createMockVoucher({ restaurantId: "other-rest" });
      const otherRestaurant = createMockRestaurant({ id: "other-rest", name: "Other Restaurant" });
      
      mockStorage.getUserWithActiveVoucher.mockResolvedValue({
        user: { activeVoucherCodeSetAt: recentCodeTime },
        voucher,
      });
      mockStorage.getRestaurant.mockResolvedValue(otherRestaurant);

      await expect(
        service.redeemVoucherByCode("rest-1", "VALIDCODE123")
      ).rejects.toThrow("cannot be redeemed here");
    });

    it("should successfully redeem a valid voucher", async () => {
      const recentCodeTime = new Date();
      const voucher = createMockVoucher({ restaurantId: "rest-1" });
      const restaurant = createMockRestaurant({ id: "rest-1" });
      const redeemedVoucher = { ...voucher, isRedeemed: true, redeemedAt: new Date() };

      mockStorage.getUserWithActiveVoucher.mockResolvedValue({
        user: { activeVoucherCodeSetAt: recentCodeTime },
        voucher,
      });
      mockStorage.getRestaurant.mockResolvedValue(restaurant);
      mockStorage.redeemVoucher.mockResolvedValue(redeemedVoucher);
      mockStorage.updateUserActiveVoucherPresentation.mockResolvedValue({});

      const result = await service.redeemVoucherByCode("rest-1", "VALIDCODE123");

      expect(result.success).toBe(true);
      expect(result.message).toContain("redeemed successfully");
      expect(mockStorage.redeemVoucher).toHaveBeenCalledWith("vouch-1", undefined, undefined);
    });

    it("should reject redemption at wrong branch for branch-specific voucher types", async () => {
      const recentCodeTime = new Date();
      const voucher = createMockVoucher({ restaurantId: "rest-1", voucherTypeId: "vt-1" });
      const restaurant = createMockRestaurant({ id: "rest-1" });
      const voucherType = createMockVoucherType({
        redemptionScope: "specific_branches",
        redeemableBranchIds: ["branch-a"],
      });

      mockStorage.getUserWithActiveVoucher.mockResolvedValue({
        user: { activeVoucherCodeSetAt: recentCodeTime },
        voucher,
      });
      mockStorage.getRestaurant.mockResolvedValue(restaurant);
      mockStorage.getVoucherType.mockResolvedValue(voucherType);
      mockStorage.getBranch
        .mockResolvedValueOnce({ id: "branch-b", name: "Wrong Branch" })
        .mockResolvedValueOnce({ id: "branch-a", name: "Correct Branch" });

      await expect(
        service.redeemVoucherByCode("rest-1", "VALIDCODE123", undefined, "branch-b")
      ).rejects.toThrow("cannot be redeemed at Wrong Branch");
    });
  });
});
