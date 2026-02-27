import { describe, it, expect } from "vitest";
import {
  recordTransactionSchema,
  createVoucherTypeSchema,
} from "../server/validation/auth-schemas";
import {
  validateDiscoveryRequest,
  validateDiscoveryEligibility,
  getSubscriptionStatus,
} from "../server/validation/discovery-rules";

describe("Discovery Request Validation (imported)", () => {
  it("should accept valid enable request with terms accepted", () => {
    const result = validateDiscoveryRequest({ enabled: true, termsAccepted: true });
    expect(result.valid).toBe(true);
  });

  it("should accept valid disable request", () => {
    const result = validateDiscoveryRequest({ enabled: false });
    expect(result.valid).toBe(true);
  });

  it("should reject non-boolean enabled", () => {
    const result = validateDiscoveryRequest({ enabled: "yes" as any });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("enabled must be a boolean");
  });

  it("should reject enabling without terms accepted", () => {
    const result = validateDiscoveryRequest({ enabled: true, termsAccepted: false });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("You must accept the terms and conditions to enable diner discovery");
  });

  it("should reject enabling with missing termsAccepted", () => {
    const result = validateDiscoveryRequest({ enabled: true });
    expect(result.valid).toBe(false);
  });
});

describe("Discovery Eligibility (imported)", () => {
  it("should allow active restaurants", () => {
    const result = validateDiscoveryEligibility("active");
    expect(result.eligible).toBe(true);
    expect(result.error).toBeNull();
  });

  it("should reject pending onboarding", () => {
    const result = validateDiscoveryEligibility("pending");
    expect(result.eligible).toBe(false);
    expect(result.error).toContain("onboarding must be completed");
  });

  it("should reject draft onboarding", () => {
    const result = validateDiscoveryEligibility("draft");
    expect(result.eligible).toBe(false);
  });

  it("should reject submitted onboarding", () => {
    const result = validateDiscoveryEligibility("submitted");
    expect(result.eligible).toBe(false);
  });
});

describe("Subscription Status Logic (imported)", () => {
  it("should return free plan when no subscription", () => {
    const result = getSubscriptionStatus(null);
    expect(result.isSubscribed).toBe(false);
    expect(result.plan).toBe("free");
  });

  it("should return active for valid subscription without expiry", () => {
    const result = getSubscriptionStatus({
      isSubscribed: true,
      plan: "premium",
      expiresAt: null,
    });
    expect(result.isSubscribed).toBe(true);
    expect(result.plan).toBe("premium");
  });

  it("should return active for subscription with future expiry", () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 1);
    const result = getSubscriptionStatus({
      isSubscribed: true,
      plan: "premium",
      expiresAt: futureDate,
    });
    expect(result.isSubscribed).toBe(true);
  });

  it("should return inactive for expired subscription", () => {
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 1);
    const result = getSubscriptionStatus({
      isSubscribed: true,
      plan: "premium",
      expiresAt: pastDate,
    });
    expect(result.isSubscribed).toBe(false);
  });

  it("should return inactive when isSubscribed is false", () => {
    const result = getSubscriptionStatus({
      isSubscribed: false,
      plan: "premium",
      expiresAt: null,
    });
    expect(result.isSubscribed).toBe(false);
  });
});

describe("Transaction Record Validation (imported schema)", () => {
  it("should accept a valid transaction", () => {
    const result = recordTransactionSchema.safeParse({
      phone: "+27821234567",
      amountSpent: 150.50,
    });
    expect(result.success).toBe(true);
  });

  it("should strip phone formatting", () => {
    const result = recordTransactionSchema.safeParse({
      phone: "082 123 4567",
      amountSpent: 100,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("0821234567");
    }
  });

  it("should reject missing amount", () => {
    const result = recordTransactionSchema.safeParse({
      phone: "+27821234567",
    });
    expect(result.success).toBe(false);
  });

  it("should coerce string amounts", () => {
    const result = recordTransactionSchema.safeParse({
      phone: "+27821234567",
      amountSpent: "99.99",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amountSpent).toBe(99.99);
    }
  });
});

describe("Voucher Type Validation (imported schema)", () => {
  it("should accept valid voucher type data", () => {
    const result = createVoucherTypeSchema.safeParse({
      name: "R100 Off",
      validityDays: 30,
      earningMode: "points",
      creditsCost: 1,
      redemptionScope: "all_branches",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing name", () => {
    const result = createVoucherTypeSchema.safeParse({
      name: "",
      validityDays: 30,
      earningMode: "points",
      creditsCost: 1,
      redemptionScope: "all_branches",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid earning mode", () => {
    const result = createVoucherTypeSchema.safeParse({
      name: "Test",
      validityDays: 30,
      earningMode: "stamps",
      creditsCost: 1,
      redemptionScope: "all_branches",
    });
    expect(result.success).toBe(false);
  });

  it("should reject validity days over 365", () => {
    const result = createVoucherTypeSchema.safeParse({
      name: "Test",
      validityDays: 400,
      earningMode: "points",
      creditsCost: 1,
      redemptionScope: "all_branches",
    });
    expect(result.success).toBe(false);
  });

  it("should reject credits cost less than 1", () => {
    const result = createVoucherTypeSchema.safeParse({
      name: "Test",
      validityDays: 30,
      earningMode: "points",
      creditsCost: 0,
      redemptionScope: "all_branches",
    });
    expect(result.success).toBe(false);
  });

  it("should accept specific branches with branch IDs", () => {
    const result = createVoucherTypeSchema.safeParse({
      name: "Test",
      validityDays: 30,
      earningMode: "points",
      creditsCost: 1,
      redemptionScope: "specific_branches",
      redeemableBranchIds: ["branch-1", "branch-2"],
    });
    expect(result.success).toBe(true);
  });
});
