import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigService } from "../server/services/loyalty/config.service";
import { createMockStorage, createMockRestaurant } from "./mock-storage";

describe("ConfigService", () => {
  let service: ConfigService;
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    service = new ConfigService(mockStorage as any);
  });

  describe("validateSettings", () => {
    it("should accept valid settings", () => {
      const result = service.validateSettings({
        voucherValue: "R100 Voucher",
        voucherValidityDays: 30,
        pointsPerCurrency: 1,
        pointsThreshold: 1000,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should accept empty settings object", () => {
      const result = service.validateSettings({});
      expect(result.valid).toBe(true);
    });

    it("should reject voucherValidityDays less than 1", () => {
      const result = service.validateSettings({ voucherValidityDays: 0 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Voucher validity must be at least 1 day");
    });

    it("should reject voucherValidityDays greater than 365", () => {
      const result = service.validateSettings({ voucherValidityDays: 400 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Voucher validity cannot exceed 365 days");
    });

    it("should reject pointsPerCurrency less than 1", () => {
      const result = service.validateSettings({ pointsPerCurrency: 0 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Points per currency must be at least 1");
    });

    it("should reject pointsPerCurrency greater than 100", () => {
      const result = service.validateSettings({ pointsPerCurrency: 101 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Points per currency cannot exceed 100");
    });

    it("should reject pointsThreshold less than 100", () => {
      const result = service.validateSettings({ pointsThreshold: 50 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Points threshold must be at least 100");
    });

    it("should reject pointsThreshold greater than 10000", () => {
      const result = service.validateSettings({ pointsThreshold: 20000 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Points threshold cannot exceed 10,000");
    });

    it("should reject empty voucherValue", () => {
      const result = service.validateSettings({ voucherValue: "  " });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Voucher value cannot be empty");
    });

    it("should reject invalid loyaltyScope", () => {
      const result = service.validateSettings({ loyaltyScope: "invalid" as any });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Loyalty scope must be 'organization' or 'branch'");
    });

    it("should reject invalid voucherScope", () => {
      const result = service.validateSettings({ voucherScope: "invalid" as any });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Voucher scope must be 'organization' or 'branch'");
    });

    it("should reject invalid voucherEarningMode", () => {
      const result = service.validateSettings({ voucherEarningMode: "invalid" as any });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Voucher earning mode must be 'points' or 'visits'");
    });

    it("should reject visitThreshold less than 1", () => {
      const result = service.validateSettings({ visitThreshold: 0 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Visit threshold must be at least 1");
    });

    it("should reject visitThreshold greater than 100", () => {
      const result = service.validateSettings({ visitThreshold: 101 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Visit threshold cannot exceed 100");
    });

    it("should collect multiple errors", () => {
      const result = service.validateSettings({
        voucherValidityDays: 0,
        pointsPerCurrency: 0,
        pointsThreshold: 50,
        voucherValue: "  ",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(4);
    });

    it("should accept valid loyaltyScope values", () => {
      expect(service.validateSettings({ loyaltyScope: "organization" }).valid).toBe(true);
      expect(service.validateSettings({ loyaltyScope: "branch" }).valid).toBe(true);
    });

    it("should accept valid voucherEarningMode values", () => {
      expect(service.validateSettings({ voucherEarningMode: "points" }).valid).toBe(true);
      expect(service.validateSettings({ voucherEarningMode: "visits" }).valid).toBe(true);
    });
  });

  describe("updateRestaurantSettings", () => {
    it("should update settings when validation passes", async () => {
      const restaurant = createMockRestaurant();
      const updatedRestaurant = { ...restaurant, pointsThreshold: 500 };

      mockStorage.getRestaurant.mockResolvedValue(restaurant);
      mockStorage.updateRestaurantSettings.mockResolvedValue(updatedRestaurant);

      const result = await service.updateRestaurantSettings("rest-1", { pointsThreshold: 500 });

      expect(result.pointsThreshold).toBe(500);
      expect(mockStorage.updateRestaurantSettings).toHaveBeenCalledWith("rest-1", { pointsThreshold: 500 });
    });

    it("should throw if restaurant not found", async () => {
      mockStorage.getRestaurant.mockResolvedValue(null);

      await expect(
        service.updateRestaurantSettings("rest-1", { pointsThreshold: 500 })
      ).rejects.toThrow("Restaurant not found");
    });

    it("should throw with validation errors", async () => {
      const restaurant = createMockRestaurant();
      mockStorage.getRestaurant.mockResolvedValue(restaurant);

      await expect(
        service.updateRestaurantSettings("rest-1", { pointsThreshold: 50 })
      ).rejects.toThrow("Points threshold must be at least 100");
    });
  });
});
