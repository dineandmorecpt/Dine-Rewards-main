import type { Restaurant, PointsBalance, Transaction, Voucher, VoucherType, User, Diner } from "@shared/schema";

export function createMockRestaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: "rest-1",
    name: "Test Restaurant",
    adminUserId: "admin-1",
    voucherValue: "R100 Loyalty Voucher",
    voucherValidityDays: 30,
    color: "bg-primary",
    pointsPerCurrency: 1,
    pointsThreshold: 1000,
    voucherEarningMode: "points",
    visitThreshold: 10,
    loyaltyScope: "organization",
    voucherScope: "organization",
    onboardingStatus: "active",
    registrationNumber: "REG123",
    streetAddress: "123 Main St",
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "8001",
    country: "South Africa",
    contactName: "John",
    contactEmail: "john@test.com",
    contactPhone: "+27821234567",
    hasAdditionalBranches: false,
    logoUrl: null,
    onboardingCompletedAt: new Date(),
    tradingName: null,
    description: null,
    cuisineType: null,
    websiteUrl: null,
    vatNumber: null,
    facebookUrl: null,
    instagramUrl: null,
    twitterUrl: null,
    businessHours: null,
    dinerDiscoveryEnabled: false,
    dinerDiscoveryAcceptedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

export function createMockPointsBalance(overrides: Partial<PointsBalance> = {}): PointsBalance {
  return {
    id: "bal-1",
    dinerId: "diner-1",
    restaurantId: "rest-1",
    branchId: null,
    currentPoints: 0,
    totalPointsEarned: 0,
    currentVisits: 0,
    totalVisits: 0,
    totalVouchersGenerated: 0,
    availableVoucherCredits: 0,
    totalVoucherCreditsEarned: 0,
    pointsCredits: 0,
    visitCredits: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

export function createMockTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "txn-1",
    dinerId: "diner-1",
    restaurantId: "rest-1",
    branchId: null,
    amountSpent: "100",
    pointsEarned: 100,
    billId: null,
    createdAt: new Date(),
    restaurantNameOverride: null,
    ...overrides,
  };
}

export function createMockVoucher(overrides: Partial<Voucher> = {}): Voucher {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  return {
    id: "vouch-1",
    dinerId: "diner-1",
    restaurantId: "rest-1",
    branchId: null,
    voucherTypeId: "vt-1",
    title: "R100 Loyalty Voucher",
    code: null,
    expiryDate: futureDate,
    isRedeemed: false,
    redeemedAt: null,
    redeemedBillId: null,
    redeemedBranchId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

export function createMockVoucherType(overrides: Partial<VoucherType> = {}): VoucherType {
  return {
    id: "vt-1",
    restaurantId: "rest-1",
    branchId: null,
    name: "R100 Off Voucher",
    description: "Get R100 off your next bill",
    rewardDetails: null,
    category: null,
    earningMode: "points",
    pointsPerCurrencyOverride: null,
    value: 100,
    freeItemType: null,
    freeItemDescription: null,
    redemptionScope: "all_branches",
    redeemableBranchIds: null,
    creditsCost: 1,
    validityDays: 30,
    expiresAt: null,
    isActive: true,
    createdAt: new Date(),
    ...overrides,
  };
}

export function createMockStorage() {
  return {
    getRestaurant: vi.fn(),
    getBranch: vi.fn(),
    createTransaction: vi.fn(),
    getPointsBalance: vi.fn(),
    createPointsBalance: vi.fn(),
    updatePointsBalance: vi.fn(),
    getActiveVoucherTypesByRestaurant: vi.fn(),
    createVoucher: vi.fn(),
    getVoucherType: vi.fn(),
    getVouchersByDiner: vi.fn(),
    getPointsBalancesByDiner: vi.fn(),
    redeemVoucher: vi.fn(),
    updateUserActiveVoucherPresentation: vi.fn(),
    getUserWithActiveVoucher: vi.fn(),
    updateRestaurantSettings: vi.fn(),
  };
}
