import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoyaltyService } from "../server/services/loyalty/loyalty.service";
import {
  createMockStorage,
  createMockRestaurant,
  createMockPointsBalance,
  createMockTransaction,
  createMockVoucher,
  createMockVoucherType,
} from "./mock-storage";

describe("LoyaltyService", () => {
  let service: LoyaltyService;
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    service = new LoyaltyService(mockStorage as any);
  });

  describe("calculatePointsEarned", () => {
    it("should calculate points at 1 point per R1 spent", () => {
      const restaurant = createMockRestaurant({ pointsPerCurrency: 1 });
      expect(service.calculatePointsEarned(100, restaurant)).toBe(100);
    });

    it("should calculate points at 2 points per R1 spent", () => {
      const restaurant = createMockRestaurant({ pointsPerCurrency: 2 });
      expect(service.calculatePointsEarned(100, restaurant)).toBe(200);
    });

    it("should calculate points at 10 points per R1 spent", () => {
      const restaurant = createMockRestaurant({ pointsPerCurrency: 10 });
      expect(service.calculatePointsEarned(50, restaurant)).toBe(500);
    });

    it("should floor decimal amounts", () => {
      const restaurant = createMockRestaurant({ pointsPerCurrency: 3 });
      expect(service.calculatePointsEarned(33.33, restaurant)).toBe(99);
    });

    it("should return 0 points for 0 amount", () => {
      const restaurant = createMockRestaurant({ pointsPerCurrency: 1 });
      expect(service.calculatePointsEarned(0, restaurant)).toBe(0);
    });
  });

  describe("shouldEarnCredit", () => {
    it("should return true when points equal threshold", () => {
      expect(service.shouldEarnCredit(1000, 1000)).toBe(true);
    });

    it("should return true when points exceed threshold", () => {
      expect(service.shouldEarnCredit(1500, 1000)).toBe(true);
    });

    it("should return false when points are below threshold", () => {
      expect(service.shouldEarnCredit(999, 1000)).toBe(false);
    });

    it("should return false when points are 0", () => {
      expect(service.shouldEarnCredit(0, 1000)).toBe(false);
    });
  });

  describe("getPointsUntilNextCredit", () => {
    it("should return full threshold when at 0 points", () => {
      expect(service.getPointsUntilNextCredit(0, 1000)).toBe(1000);
    });

    it("should return remaining points when partially there", () => {
      expect(service.getPointsUntilNextCredit(750, 1000)).toBe(250);
    });

    it("should return threshold when exactly at threshold", () => {
      expect(service.getPointsUntilNextCredit(1000, 1000)).toBe(1000);
    });

    it("should return correct value after multiple thresholds", () => {
      expect(service.getPointsUntilNextCredit(2500, 1000)).toBe(500);
    });

    it("should return 0 when never possible (edge case)", () => {
      expect(service.getPointsUntilNextCredit(0, 1000)).toBe(1000);
    });
  });

  describe("recordTransaction", () => {
    it("should record a transaction and update points balance", async () => {
      const restaurant = createMockRestaurant({ pointsPerCurrency: 1, pointsThreshold: 1000 });
      const existingBalance = createMockPointsBalance({ currentPoints: 0, totalPointsEarned: 0 });
      const transaction = createMockTransaction({ amountSpent: "500", pointsEarned: 500 });

      mockStorage.getRestaurant.mockResolvedValue(restaurant);
      mockStorage.getPointsBalance.mockResolvedValue(existingBalance);
      mockStorage.createTransaction.mockResolvedValue(transaction);
      mockStorage.updatePointsBalance.mockResolvedValue({
        ...existingBalance,
        currentPoints: 500,
        totalPointsEarned: 500,
        currentVisits: 1,
        totalVisits: 1,
      });
      mockStorage.getActiveVoucherTypesByRestaurant.mockResolvedValue([]);

      const result = await service.recordTransaction("diner-1", "rest-1", 500);

      expect(result.transaction).toEqual(transaction);
      expect(result.creditsEarned).toBe(0);
      expect(result.vouchersGenerated).toEqual([]);
      expect(mockStorage.createTransaction).toHaveBeenCalledWith({
        dinerId: "diner-1",
        restaurantId: "rest-1",
        branchId: null,
        amountSpent: "500",
        pointsEarned: 500,
        billId: null,
      });
    });

    it("should earn a credit when points reach threshold", async () => {
      const restaurant = createMockRestaurant({ pointsPerCurrency: 1, pointsThreshold: 1000 });
      const existingBalance = createMockPointsBalance({ currentPoints: 800, totalPointsEarned: 800 });
      const transaction = createMockTransaction({ amountSpent: "300", pointsEarned: 300 });

      mockStorage.getRestaurant.mockResolvedValue(restaurant);
      mockStorage.getPointsBalance.mockResolvedValue(existingBalance);
      mockStorage.createTransaction.mockResolvedValue(transaction);
      mockStorage.updatePointsBalance.mockResolvedValue({
        ...existingBalance,
        currentPoints: 100,
        totalPointsEarned: 1100,
        pointsCredits: 1,
        currentVisits: 1,
        totalVisits: 1,
      });
      mockStorage.getActiveVoucherTypesByRestaurant.mockResolvedValue([]);

      const result = await service.recordTransaction("diner-1", "rest-1", 300);

      expect(result.creditsEarned).toBe(1);
      expect(mockStorage.updatePointsBalance).toHaveBeenCalledWith("bal-1", expect.objectContaining({
        currentPoints: 100,
        totalPointsEarned: 1100,
        pointsCredits: 1,
      }));
    });

    it("should create a new balance when none exists", async () => {
      const restaurant = createMockRestaurant();
      const newBalance = createMockPointsBalance();
      const transaction = createMockTransaction();

      mockStorage.getRestaurant.mockResolvedValue(restaurant);
      mockStorage.getPointsBalance.mockResolvedValue(null);
      mockStorage.createPointsBalance.mockResolvedValue(newBalance);
      mockStorage.createTransaction.mockResolvedValue(transaction);
      mockStorage.updatePointsBalance.mockResolvedValue({ ...newBalance, currentPoints: 100, currentVisits: 1, totalVisits: 1 });
      mockStorage.getActiveVoucherTypesByRestaurant.mockResolvedValue([]);

      await service.recordTransaction("diner-1", "rest-1", 100);

      expect(mockStorage.createPointsBalance).toHaveBeenCalled();
    });

    it("should throw error if restaurant not found", async () => {
      mockStorage.getRestaurant.mockResolvedValue(null);

      await expect(
        service.recordTransaction("diner-1", "rest-1", 100)
      ).rejects.toThrow("Restaurant not found");
    });

    it("should require branchId for branch-specific loyalty", async () => {
      const restaurant = createMockRestaurant({ loyaltyScope: "branch" });
      mockStorage.getRestaurant.mockResolvedValue(restaurant);
      mockStorage.createTransaction.mockResolvedValue(createMockTransaction());

      await expect(
        service.recordTransaction("diner-1", "rest-1", 100)
      ).rejects.toThrow("Branch ID is required");
    });

    it("should award visit credits when visit threshold is reached", async () => {
      const restaurant = createMockRestaurant({ visitThreshold: 5 });
      const existingBalance = createMockPointsBalance({ currentVisits: 4, totalVisits: 4 });
      const transaction = createMockTransaction();

      mockStorage.getRestaurant.mockResolvedValue(restaurant);
      mockStorage.getPointsBalance.mockResolvedValue(existingBalance);
      mockStorage.createTransaction.mockResolvedValue(transaction);
      mockStorage.updatePointsBalance.mockResolvedValue({
        ...existingBalance,
        currentVisits: 0,
        totalVisits: 5,
        visitCredits: 1,
      });
      mockStorage.getActiveVoucherTypesByRestaurant.mockResolvedValue([]);

      const result = await service.recordTransaction("diner-1", "rest-1", 100);

      expect(result.creditsEarned).toBe(1);
      expect(mockStorage.updatePointsBalance).toHaveBeenCalledWith("bal-1", expect.objectContaining({
        currentVisits: 0,
        visitCredits: 1,
      }));
    });

    it("should auto-generate vouchers when points credits earned and voucher type exists", async () => {
      const restaurant = createMockRestaurant({ pointsPerCurrency: 1, pointsThreshold: 100 });
      const existingBalance = createMockPointsBalance({ currentPoints: 50, totalPointsEarned: 50 });
      const transaction = createMockTransaction({ amountSpent: "100", pointsEarned: 100 });
      const voucherType = createMockVoucherType({ earningMode: "points", creditsCost: 1 });
      const generatedVoucher = createMockVoucher();

      mockStorage.getRestaurant.mockResolvedValue(restaurant);
      mockStorage.getPointsBalance.mockResolvedValue(existingBalance);
      mockStorage.createTransaction.mockResolvedValue(transaction);
      mockStorage.updatePointsBalance
        .mockResolvedValueOnce({ ...existingBalance, currentPoints: 50, pointsCredits: 1, currentVisits: 1, totalVisits: 1, totalVoucherCreditsEarned: 1 })
        .mockResolvedValueOnce({ ...existingBalance, currentPoints: 50, pointsCredits: 0, totalVouchersGenerated: 1, currentVisits: 1, totalVisits: 1 });
      mockStorage.getActiveVoucherTypesByRestaurant.mockResolvedValue([voucherType]);
      mockStorage.createVoucher.mockResolvedValue(generatedVoucher);

      const result = await service.recordTransaction("diner-1", "rest-1", 100);

      expect(result.vouchersGenerated).toHaveLength(1);
      expect(mockStorage.createVoucher).toHaveBeenCalled();
    });
  });

  describe("redeemVoucherCredit", () => {
    it("should redeem a voucher credit successfully", async () => {
      const restaurant = createMockRestaurant();
      const balance = createMockPointsBalance({ pointsCredits: 2 });
      const voucherType = createMockVoucherType({ creditsCost: 1 });
      const voucher = createMockVoucher();

      mockStorage.getVoucherType.mockResolvedValue(voucherType);
      mockStorage.getRestaurant.mockResolvedValue(restaurant);
      mockStorage.getPointsBalance.mockResolvedValue(balance);
      mockStorage.createVoucher.mockResolvedValue(voucher);
      mockStorage.updatePointsBalance.mockResolvedValue({ ...balance, pointsCredits: 1, totalVouchersGenerated: 1 });

      const result = await service.redeemVoucherCredit("diner-1", "rest-1", "vt-1");

      expect(result.voucher).toEqual(voucher);
      expect(mockStorage.createVoucher).toHaveBeenCalled();
    });

    it("should throw if not enough credits", async () => {
      const restaurant = createMockRestaurant();
      const balance = createMockPointsBalance({ pointsCredits: 0 });
      const voucherType = createMockVoucherType({ creditsCost: 1 });

      mockStorage.getVoucherType.mockResolvedValue(voucherType);
      mockStorage.getRestaurant.mockResolvedValue(restaurant);
      mockStorage.getPointsBalance.mockResolvedValue(balance);

      await expect(
        service.redeemVoucherCredit("diner-1", "rest-1", "vt-1")
      ).rejects.toThrow("credit(s) but only have 0");
    });

    it("should throw if voucher type not found", async () => {
      mockStorage.getVoucherType.mockResolvedValue(null);

      await expect(
        service.redeemVoucherCredit("diner-1", "rest-1", "vt-1")
      ).rejects.toThrow("Voucher type not found");
    });

    it("should throw if voucher type is inactive", async () => {
      mockStorage.getVoucherType.mockResolvedValue(
        createMockVoucherType({ isActive: false })
      );

      await expect(
        service.redeemVoucherCredit("diner-1", "rest-1", "vt-1")
      ).rejects.toThrow("no longer available");
    });

    it("should throw if voucher type belongs to different restaurant", async () => {
      mockStorage.getVoucherType.mockResolvedValue(
        createMockVoucherType({ restaurantId: "other-rest" })
      );

      await expect(
        service.redeemVoucherCredit("diner-1", "rest-1", "vt-1")
      ).rejects.toThrow("does not belong");
    });

    it("should use visit credits for visits-based voucher types", async () => {
      const restaurant = createMockRestaurant();
      const balance = createMockPointsBalance({ visitCredits: 2, pointsCredits: 0 });
      const voucherType = createMockVoucherType({ earningMode: "visits", creditsCost: 1 });
      const voucher = createMockVoucher();

      mockStorage.getVoucherType.mockResolvedValue(voucherType);
      mockStorage.getRestaurant.mockResolvedValue(restaurant);
      mockStorage.getPointsBalance.mockResolvedValue(balance);
      mockStorage.createVoucher.mockResolvedValue(voucher);
      mockStorage.updatePointsBalance.mockResolvedValue({ ...balance, visitCredits: 1, totalVouchersGenerated: 1 });

      const result = await service.redeemVoucherCredit("diner-1", "rest-1", "vt-1");

      expect(result.voucher).toEqual(voucher);
      expect(mockStorage.updatePointsBalance).toHaveBeenCalledWith("bal-1", expect.objectContaining({
        visitCredits: 1,
      }));
    });
  });
});
