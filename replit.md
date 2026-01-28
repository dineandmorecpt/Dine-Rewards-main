# Dine&More - Restaurant Rewards Platform

## Overview
Dine&More is a premium loyalty rewards platform connecting diners with restaurants. It allows restaurant administrators to manage loyalty programs, vouchers, and analytics, while diners can track points, redeem vouchers, and view transaction history across various restaurants. The project aims to provide a comprehensive solution for restaurant loyalty, enhancing customer engagement and providing valuable insights for businesses.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built with React 18 and TypeScript, utilizing Wouter for routing, TanStack React Query for state management, and Tailwind CSS with shadcn/ui for styling. It features a microservices-style architecture with separate portals for diners and administrators, allowing independent deployment and optimized builds. The architecture includes shared UI components and utilities while maintaining separate entry points and build configurations for each portal.

### Backend Architecture
The backend uses Express.js with TypeScript, providing RESTful API endpoints. It incorporates a service layer for domain-driven logic, including `LoyaltyService`, `VoucherService`, `StatsService`, and `ConfigService`. A storage abstraction pattern ensures decoupling of business logic from the database.

#### Route Organization
Routes are organized into feature-based modules in `server/routes/`:
- **auth.ts**: Authentication (login, logout, OTP, password reset, account deletion)
- **diners.ts**: Diner-specific endpoints (points, vouchers, profile, phone changes)
- **restaurants.ts**: Restaurant management (settings, branches, staff, stats)
- **vouchers.ts**: Voucher type CRUD and redemptions
- **transactions.ts**: Transaction recording and history
- **reconciliation.ts**: Bulk transaction upload and batch management
- **invitations.ts**: Diner invitation and registration flows

The main `server/routes.ts` acts as a composer, importing and registering all feature routes.

#### Consumer-Specific API Endpoints
The API provides consumer-specific endpoints optimized for each portal:

**Diner Portal API (`/api/diner/*`)**:
- Session-based authentication - no dinerId required in URLs
- Endpoints: `/api/diner/points`, `/api/diner/vouchers`, `/api/diner/transactions`, `/api/diner/profile`
- Defined in `server/routes/diner-api.ts`

**Admin Portal API (`/api/admin/*`)**:
- Session-based authentication - restaurantId derived from authenticated admin's associated restaurant
- Endpoints: `/api/admin/restaurant`, `/api/admin/branches`, `/api/admin/staff`, `/api/admin/voucher-types`, `/api/admin/stats`, etc.
- Defined in `server/routes/admin-api.ts`

This separation provides:
- Tailored responses for each consumer
- Cleaner URLs without ID parameters
- Independent API evolution for each portal
- Clear security boundaries

### Data Storage
PostgreSQL is the primary database, accessed via Drizzle ORM. The schema is defined in `/shared/schema.ts` and includes core models for `users` (diners and admins), `restaurants`, `branches`, `pointsBalances`, `transactions`, and `vouchers`. The system supports multi-branch architecture, tracking data per-branch with organization-wide roll-ups.

### User Model Architecture
A person can be both a **diner** AND a **restaurant staff member** on the platform. The `users` table uses composite unique constraints:
- `(email, user_type)` - Same email can exist for both 'diner' and 'restaurant_admin' user types
- `(phone, user_type)` - Same phone can exist for both user types

This allows:
- Restaurant staff to also be loyalty members at the same or other restaurants
- No duplicate records within the same entity (e.g., can't have two diner accounts with the same email)

### Loyalty Program Features
The platform offers flexible loyalty configurations, including:
- **Loyalty Scope**: Points accumulation and voucher redemption can be configured as either organization-wide or branch-specific.
- **Voucher Earning Modes**: Restaurants can choose between 'Points-based' (earning credits after reaching a points threshold) and 'Visits-based' (earning credits after a set number of visits).

### Security & Privacy
SMS rate limiting is implemented across multiple layers (per-IP, per-phone, per-restaurant, global daily limits) to prevent abuse. Cloudflare Turnstile provides captcha protection for authentication flows. For analytics, diners have a unique `analyticsId` for anonymous trend reporting, ensuring POPIA-compliant pseudonymization of data.

### Authentication Requirements (CRITICAL)
**All API calls must include proper authentication credentials.** This is essential for consistent behavior across the application.

**Frontend API Calls:**
Every `fetch` request to `/api/admin/*` or `/api/diner/*` endpoints MUST include:
```typescript
fetch(url, {
  credentials: "include",           // Required for session cookies
  headers: getAuthHeaders(),        // Required for X-User-Id and X-User-Type headers
})
```

Import `getAuthHeaders` from `@/lib/queryClient`:
```typescript
import { getAuthHeaders } from "@/lib/queryClient";
```

**Backend Authentication:**
- Use `getAuthUserId(req)` from `server/routes/auth.ts` to get the authenticated user ID
- Use `getAuthUserType(req)` to get the user type (diner or restaurant_admin)
- These functions check both session cookies AND X-User-Id/X-User-Type headers for dual authentication support

**DO NOT:**
- Make API calls without `credentials: "include"`
- Make API calls without `headers: getAuthHeaders()`
- Modify authentication logic without thorough testing of both admin and diner portals

### Core Features
- **User Management**: Restaurant admins can view and manage diners, and owners can manage staff with role-based access.
- **Profile Management**: Admins manage business profiles, while diners can manage their personal profiles and view transaction history.
- **Phone Number Verification**: Secure OTP-based verification for phone number changes.
- **Diner Registration**: An invitation-based, OTP-verified registration flow for diners.
- **Account Deletion**: A two-step confirmation process with email verification and data archiving for compliance.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.

### UI Component Libraries
- **Radix UI**: Headless UI primitives.
- **shadcn/ui**: Styled components built on Radix.
- **Lucide React**: Icon library.
- **Recharts**: Charting library for data visualization.
- **Embla Carousel**: Carousel component.

### Form & Validation
- **Zod**: Schema validation.
- **drizzle-zod**: Zod schema generation from Drizzle.
- **React Hook Form**: Form state management.

### Security
- **Cloudflare Turnstile**: Captcha service.

### SMS Service
- **SMS Portal API**: For sending SMS messages.