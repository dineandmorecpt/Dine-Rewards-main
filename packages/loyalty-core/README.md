# @loyaltycore/core

A reusable loyalty platform engine that can be customized for different industries (restaurants, salons, retail, etc.).

## Installation

```bash
npm install @loyaltycore/core
```

## Features

- **Points & Credits System**: Configurable points-per-currency and threshold-based credit earning
- **Voucher Management**: Create, claim, and redeem vouchers with customizable types
- **Multi-Branch Support**: Organization-wide or branch-specific loyalty tracking
- **Flexible Earning Modes**: Points-based or visits-based credit accumulation
- **User Management**: Support for dual-role users (customer + business admin)

## Usage

### 1. Implement the Storage Interface

Create a storage adapter for your database:

```typescript
import { ILoyaltyStorage } from "@loyaltycore/core/storage";

class PostgresStorage implements ILoyaltyStorage {
  // Implement all required methods
  async getUser(id: string) { /* ... */ }
  async getUserByEmail(email: string) { /* ... */ }
  // ... etc
}
```

### 2. Initialize Services

```typescript
import { createLoyaltyServices } from "@loyaltycore/core/services";

const storage = new PostgresStorage();
const services = createLoyaltyServices(storage);

// Use the services
const result = await services.loyalty.recordTransaction({
  customerId: "cust-123",
  businessId: "biz-456",
  amountSpent: 150.00,
  billId: "BILL-789"
});

console.log(`Earned ${result.pointsEarned} points!`);
```

### 3. Customize for Your Industry

The core package uses generic terminology that you map to your industry:

| Core Term | Restaurant | Salon | Retail |
|-----------|------------|-------|--------|
| Customer | Diner | Client | Shopper |
| Business | Restaurant | Salon | Store |
| Transaction | Bill/Check | Appointment | Purchase |
| Branch | Location | Branch | Outlet |

## Architecture

```
@loyaltycore/core
├── types/           # Base interfaces and enums
├── storage/         # Storage interface (implement for your DB)
├── services/
│   ├── loyalty/     # Points & credits engine
│   ├── auth/        # Authentication helpers
│   └── voucher/     # Voucher management
└── utils/           # Shared utilities
```

## Extending for a New Industry

1. Create a new project that depends on `@loyaltycore/core`
2. Implement `ILoyaltyStorage` for your database
3. Extend base types with industry-specific fields
4. Build your industry-specific UI and routes
5. Use the core services for all loyalty logic

## Example: Restaurant Platform

```typescript
// Extend base types
interface Diner extends BaseUser {
  favoriteRestaurant?: string;
  dietaryPreferences?: string[];
}

// Use core services
const { loyalty, voucher } = createLoyaltyServices(storage);

// Record a dining transaction
await loyalty.recordTransaction({
  customerId: dinerId,
  businessId: restaurantId,
  branchId: branchId,
  amountSpent: billTotal,
  billId: invoiceNumber
});
```

## License

Private - All rights reserved.
