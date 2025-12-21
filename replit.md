# Dine&More - Restaurant Rewards Platform

## Overview

Dine&More is a premium restaurant loyalty rewards platform that serves two user types: restaurant administrators and diners. Restaurant admins can manage vouchers, view analytics, and configure loyalty point rules for their establishments. Diners can track their points across multiple restaurants, view and redeem vouchers, and monitor their transaction history.

The application is a full-stack TypeScript project with a React frontend and Express backend, using PostgreSQL for data persistence.

## SMS Integration

The app uses a custom SMS Portal API for sending registration invitations to diners.
- **API Endpoint**: https://rest.smsportal.com/v1/BulkMessages
- **Authentication**: Basic Auth using SMS_CLIENT_ID and SMS_API_SECRET secrets
- **Service file**: server/services/sms.ts

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state caching and synchronization
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style variant)
- **Build Tool**: Vite with custom plugins for Replit integration

The frontend follows a page-based architecture with shared layouts for admin and diner views. Components are organized into:
- `/pages` - Route components (home, admin-dashboard, diner-dashboard, etc.)
- `/components/ui` - Reusable shadcn/ui primitives
- `/components/layout` - Layout wrappers for admin and diner views
- `/components/dashboard` - Dashboard-specific components like stats cards

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful endpoints under `/api` prefix
- **Service Layer**: Domain-driven services organized under `/server/services/loyalty`:
  - `LoyaltyService` - Points calculation and transaction recording
  - `VoucherService` - Voucher generation, selection, and redemption
  - `StatsService` - Restaurant analytics and reporting
  - `ConfigService` - Restaurant settings management

The backend uses a storage abstraction pattern (`IStorage` interface) that decouples business logic from the database implementation, making it easier to test and swap storage backends.

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `/shared/schema.ts` (shared between frontend and backend)
- **Migrations**: Managed via `drizzle-kit push` command

Core data models:
- `users` - Both diners and restaurant admins (distinguished by `userType`)
- `restaurants` - Restaurant entities (organization level) with configurable loyalty rules
- `branches` - Restaurant branches with name, address, phone, isDefault, isActive flags
- `pointsBalances` - Points balance per diner per restaurant (tracks branchId when loyaltyScope='branch')
- `transactions` - Transaction history for points earning (tracks branchId)
- `vouchers` - Generated vouchers with codes and expiry dates (tracks branchId)
- `campaigns` - Marketing campaigns (placeholder)

### Multi-Branch Architecture
- Restaurants are the organization level; branches are physical locations
- Each restaurant must have exactly one default branch
- Data is tracked per-branch (transactions, vouchers, reconciliation) with org-wide roll-ups
- Diners register at the organization level and can transact at any branch
- Admin UI includes a branch switcher for multi-branch restaurants
- Branch context managed via `useBranch` hook in `client/src/hooks/use-branch.tsx`

### Loyalty Scope Configuration
- **Points Accumulation** (`loyaltyScope` field):
  - **Organization-wide** (`loyaltyScope: 'organization'`): Points earned at any branch count towards the same balance. This is the default mode. Points balances are tracked at the restaurant level (branchId is null).
  - **Branch-specific** (`loyaltyScope: 'branch'`): Each branch tracks its own separate points balance. Diners have different point balances per branch.
- **Voucher Redemption** (`voucherScope` field):
  - **Organization-wide** (`voucherScope: 'organization'`): Vouchers can be redeemed at any branch. This is the default mode.
  - **Branch-specific** (`voucherScope: 'branch'`): Vouchers can only be redeemed at the branch where they were earned.
- When branch-specific points mode is enabled:
  - Transactions require a branchId parameter
  - Points balances are tracked per-branch (branchId is set)
  - Diner dashboard shows branch name on balance cards
- Admin settings page (`/admin/settings`) allows restaurant owners to configure both scopes

### Points System Design
- Points are earned based on configurable `pointsPerCurrency` rate (default: 1 point per R1 spent)
- Vouchers are automatically generated when points reach `pointsThreshold` (default: 1000 points)
- Points reset to 0 after voucher generation (rollover model)
- Vouchers have configurable validity periods per restaurant

### Admin User Management
- Restaurant admins can view all registered diners via the Users page (`/admin/users`)
- Diners list displays: name, contact info, points, credits, vouchers, last visit, join date
- Staff management allows owners to add/remove portal users (managers and staff)
- Portal users are restaurant-level access grants for multiple team members
- Only restaurant owners can add or remove staff members
- Search functionality for filtering diners by name, email, or phone

### Business Profile Management
- Restaurant admins can manage their business profile via the Profile page (`/admin/profile`)
- Profile fields include:
  - Business Details: Legal name, trading name, description, cuisine type, registration number, VAT number
  - Business Address: Street address, city, province, postal code, country
  - Contact Information: Contact person name, email, phone, business hours
  - Online Presence: Website URL, Facebook, Instagram, Twitter links
- All profile data is stored in the restaurants table

### Diner Profile Management
- Diners can edit their profile via the Profile page (`/diner/profile`)
- Transaction history shows full earning/redemption details (`/diner/history`)
- Profile includes name, email, phone number fields
- Diners can view their points balances across multiple restaurants

### Account Deletion
- Two-step confirmation flow: modal requiring "DELETE" text + email confirmation
- 24-hour token expiry for email confirmation links
- User data is archived before deletion (90-day retention for compliance)
- Cascading cleanup of related data: vouchers, transactions, points balances, portal users, invitations
- Archived data tracked in `archivedUsers` table with `purgeAfter` date for scheduled removal

## External Dependencies

### Database
- **PostgreSQL**: Primary database accessed via `DATABASE_URL` environment variable
- **connect-pg-simple**: Session storage for PostgreSQL (available but sessions not currently implemented)

### UI Component Libraries
- **Radix UI**: Headless UI primitives (accordion, dialog, dropdown, etc.)
- **shadcn/ui**: Pre-styled components built on Radix
- **Lucide React**: Icon library
- **Recharts**: Data visualization for admin dashboard charts
- **Embla Carousel**: Carousel component

### Form & Validation
- **Zod**: Schema validation for API requests and forms
- **drizzle-zod**: Auto-generates Zod schemas from Drizzle table definitions
- **React Hook Form**: Form state management with `@hookform/resolvers`

### Build & Development
- **Vite**: Frontend build tool with HMR
- **esbuild**: Server-side bundling for production
- **tsx**: TypeScript execution for development server

### Replit-Specific
- `@replit/vite-plugin-runtime-error-modal`: Error overlay during development
- `@replit/vite-plugin-cartographer`: Source mapping for Replit
- `@replit/vite-plugin-dev-banner`: Development environment indicator