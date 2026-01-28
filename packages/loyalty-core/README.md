# @loyaltycore/core

A complete loyalty platform engine that can be customized for different industries (restaurants, salons, retail, gyms, etc.).

## Package Contents

This package contains **everything** needed to build an industry-specific loyalty platform:

### Services (Backend)
- **Loyalty Engine** - Points calculation, credit earning, transaction recording
- **Voucher Management** - Create, claim, redeem vouchers with customizable types
- **Config Service** - Restaurant/business configuration management
- **Stats Service** - Analytics and reporting
- **Reconciliation Service** - CSV upload and batch processing
- **SMS Service** - SMS notifications with rate limiting
- **Email Service** - Email notifications (Bird API)
- **Captcha Service** - Cloudflare Turnstile integration
- **Auth Service** - Authentication helpers (password hashing, tokens)

### Storage
- **IStorage Interface** - Abstract storage interface
- **PostgreSQL Implementation** - Complete Drizzle ORM implementation with all queries

### Types & Schema
- **Drizzle Schema** - Complete database schema with all tables
- **Zod Schemas** - Validation schemas for all entities
- **TypeScript Types** - Full type definitions

### UI Components (56 components)
All shadcn/ui components including:
- Button, Input, Select, Checkbox, Switch
- Dialog, Sheet, Popover, Tooltip
- Table, Tabs, Card, Badge
- Form, Toast, Alert
- And many more...

### Hooks
- **useAuth** - Authentication state management
- **useBranch** - Branch selection and context
- **useMobile** - Mobile detection
- **useToast** - Toast notifications
- **useUpload** - File upload handling

### Utilities
- **queryClient** - React Query configuration with auth headers
- **utils** - Common utility functions (cn, etc.)

## Installation

```bash
npm install @loyaltycore/core
```

## Directory Structure

```
@loyaltycore/core/
├── src/
│   ├── types/           # Schema, types, Zod schemas
│   │   ├── schema.ts    # Complete Drizzle schema
│   │   └── base.ts      # Base interfaces
│   ├── storage/         # Database layer
│   │   ├── interface.ts # IStorage interface
│   │   └── postgres.storage.ts # Full implementation
│   ├── services/        # Business logic
│   │   ├── loyalty/     # Points, vouchers, stats, config
│   │   ├── auth/        # Authentication
│   │   ├── sms/         # SMS with rate limiting
│   │   ├── email/       # Email notifications
│   │   └── captcha/     # Captcha verification
│   ├── ui/              # React components
│   │   └── components/  # 56 shadcn components
│   ├── hooks/           # React hooks
│   └── lib/             # Utilities
├── package.json
└── tsconfig.json
```

## Usage Example

### 1. Initialize Services

```typescript
import { DatabaseStorage, createLoyaltyServices } from "@loyaltycore/core";

const storage = new DatabaseStorage();
const services = createLoyaltyServices(storage);
```

### 2. Record a Transaction

```typescript
const result = await services.loyalty.recordTransaction(
  customerId,
  businessId,
  { amountSpent: 150.00, billId: "INV-123" }
);
console.log(`Earned ${result.pointsEarned} points!`);
```

### 3. Use UI Components

```tsx
import { Button, Card, Input } from "@loyaltycore/core/ui";

function MyComponent() {
  return (
    <Card>
      <Input placeholder="Enter amount" />
      <Button>Record Transaction</Button>
    </Card>
  );
}
```

## Customizing for Your Industry

### Terminology Mapping

| Core Term | Restaurant | Salon | Retail | Gym |
|-----------|------------|-------|--------|-----|
| Customer | Diner | Client | Shopper | Member |
| Business | Restaurant | Salon | Store | Gym |
| Transaction | Bill | Appointment | Purchase | Check-in |
| Branch | Location | Branch | Outlet | Facility |

### Creating an Industry-Specific Platform

1. Create a new project
2. Install `@loyaltycore/core`
3. Extend or wrap types with industry-specific fields
4. Build your custom pages using core UI components
5. Use core services for all loyalty logic

## License

Private - All rights reserved.
