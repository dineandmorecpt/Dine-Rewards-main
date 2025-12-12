# Dine&More - Restaurant Rewards Platform

## Overview

Dine&More is a premium restaurant loyalty rewards platform that serves two user types: restaurant administrators and diners. Restaurant admins can manage vouchers, view analytics, and configure loyalty point rules for their establishments. Diners can track their points across multiple restaurants, view and redeem vouchers, and monitor their transaction history.

The application is a full-stack TypeScript project with a React frontend and Express backend, using PostgreSQL for data persistence.

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
- `restaurants` - Restaurant entities with configurable loyalty rules
- `pointsBalances` - Points balance per diner per restaurant
- `transactions` - Transaction history for points earning
- `vouchers` - Generated vouchers with codes and expiry dates
- `campaigns` - Marketing campaigns (placeholder)

### Points System Design
- Points are earned based on configurable `pointsPerCurrency` rate (default: 1 point per R1 spent)
- Vouchers are automatically generated when points reach `pointsThreshold` (default: 1000 points)
- Points reset to 0 after voucher generation (rollover model)
- Vouchers have configurable validity periods per restaurant

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