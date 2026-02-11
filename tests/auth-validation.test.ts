import { describe, it, expect } from "vitest";
import {
  passwordSchema,
  loginSchema,
  selfRegisterDinerSchema,
  recordTransactionSchema,
} from "../server/validation/auth-schemas";
import { getAuthUserId, getAuthUserType } from "../server/routes/auth";

describe("Password Validation", () => {
  it("should accept a valid password", () => {
    expect(passwordSchema.safeParse("Test1234!").success).toBe(true);
  });

  it("should reject passwords shorter than 8 chars", () => {
    const result = passwordSchema.safeParse("Te1!");
    expect(result.success).toBe(false);
  });

  it("should reject passwords without uppercase", () => {
    const result = passwordSchema.safeParse("test1234!");
    expect(result.success).toBe(false);
  });

  it("should reject passwords without lowercase", () => {
    const result = passwordSchema.safeParse("TEST1234!");
    expect(result.success).toBe(false);
  });

  it("should reject passwords without numbers", () => {
    const result = passwordSchema.safeParse("TestTest!");
    expect(result.success).toBe(false);
  });

  it("should reject passwords without special characters", () => {
    const result = passwordSchema.safeParse("Test1234");
    expect(result.success).toBe(false);
  });

  it("should accept complex passwords", () => {
    expect(passwordSchema.safeParse("MyP@ssw0rd!").success).toBe(true);
    expect(passwordSchema.safeParse("Str0ng#Pass").success).toBe(true);
  });
});

describe("Login Schema Validation", () => {
  it("should accept valid login data", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      captchaToken: "valid-token",
      portal: "diner",
    });
    expect(result.success).toBe(true);
  });

  it("should accept login without portal (optional)", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      captchaToken: "valid-token",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "password123",
      captchaToken: "valid-token",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty password", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "",
      captchaToken: "valid-token",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing captchaToken", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      captchaToken: "",
    });
    expect(result.success).toBe(false);
  });

  it("should only accept 'diner' or 'restaurant' portal values", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      captchaToken: "valid-token",
      portal: "admin",
    });
    expect(result.success).toBe(false);
  });
});

describe("Self-Register Diner Schema", () => {
  const validDiner = {
    name: "John",
    lastName: "Doe",
    email: "john@example.com",
    phone: "+27821234567",
    password: "Test1234!",
    gender: "male" as const,
    dateOfBirth: "1990-01-01",
    province: "Western Cape",
  };

  it("should accept valid diner registration", () => {
    const result = selfRegisterDinerSchema.safeParse(validDiner);
    expect(result.success).toBe(true);
  });

  it("should strip spaces and dashes from phone numbers", () => {
    const result = selfRegisterDinerSchema.safeParse({
      ...validDiner,
      phone: "+27 82 123-4567",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("+27821234567");
    }
  });

  it("should reject phone numbers shorter than 7 digits", () => {
    const result = selfRegisterDinerSchema.safeParse({
      ...validDiner,
      phone: "12345",
    });
    expect(result.success).toBe(false);
  });

  it("should reject phone numbers with letters", () => {
    const result = selfRegisterDinerSchema.safeParse({
      ...validDiner,
      phone: "+27abc1234",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing required fields", () => {
    expect(selfRegisterDinerSchema.safeParse({}).success).toBe(false);
    expect(selfRegisterDinerSchema.safeParse({ name: "John" }).success).toBe(false);
  });

  it("should reject invalid gender", () => {
    const result = selfRegisterDinerSchema.safeParse({
      ...validDiner,
      gender: "other",
    });
    expect(result.success).toBe(false);
  });

  it("should accept optional restaurantId", () => {
    const result = selfRegisterDinerSchema.safeParse({
      ...validDiner,
      restaurantId: "rest-123",
    });
    expect(result.success).toBe(true);
  });
});

describe("Record Transaction Schema", () => {
  it("should accept valid transaction data", () => {
    const result = recordTransactionSchema.safeParse({
      phone: "+27821234567",
      amountSpent: 150.50,
    });
    expect(result.success).toBe(true);
  });

  it("should coerce string amounts to numbers", () => {
    const result = recordTransactionSchema.safeParse({
      phone: "+27821234567",
      amountSpent: "250",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amountSpent).toBe(250);
    }
  });

  it("should reject zero amounts", () => {
    const result = recordTransactionSchema.safeParse({
      phone: "+27821234567",
      amountSpent: 0,
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative amounts", () => {
    const result = recordTransactionSchema.safeParse({
      phone: "+27821234567",
      amountSpent: -50,
    });
    expect(result.success).toBe(false);
  });

  it("should strip formatting from phone numbers", () => {
    const result = recordTransactionSchema.safeParse({
      phone: "082 123 4567",
      amountSpent: 100,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("0821234567");
    }
  });

  it("should accept optional billId and branchId", () => {
    const result = recordTransactionSchema.safeParse({
      phone: "+27821234567",
      amountSpent: 100,
      billId: "BILL-001",
      branchId: "branch-1",
    });
    expect(result.success).toBe(true);
  });
});

describe("Auth Helper Functions", () => {
  it("getAuthUserId should prefer header over session", () => {
    expect(getAuthUserId({ headers: { 'x-user-id': 'header-id' }, session: { userId: 'session-id' } })).toBe('header-id');
    expect(getAuthUserId({ headers: {}, session: { userId: 'session-id' } })).toBe('session-id');
    expect(getAuthUserId({ headers: {}, session: {} })).toBe(null);
    expect(getAuthUserId({ headers: {} })).toBe(null);
  });

  it("getAuthUserType should prefer header over session", () => {
    expect(getAuthUserType({ headers: { 'x-user-type': 'diner' }, session: { userType: 'restaurant_admin' } })).toBe('diner');
    expect(getAuthUserType({ headers: {}, session: { userType: 'restaurant_admin' } })).toBe('restaurant_admin');
    expect(getAuthUserType({ headers: {}, session: {} })).toBe(null);
  });
});
