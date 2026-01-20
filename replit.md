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

### Data Storage
PostgreSQL is the primary database, accessed via Drizzle ORM. The schema is defined in `/shared/schema.ts` and includes core models for `users` (diners and admins), `restaurants`, `branches`, `pointsBalances`, `transactions`, and `vouchers`. The system supports multi-branch architecture, tracking data per-branch with organization-wide roll-ups.

### Loyalty Program Features
The platform offers flexible loyalty configurations, including:
- **Loyalty Scope**: Points accumulation and voucher redemption can be configured as either organization-wide or branch-specific.
- **Voucher Earning Modes**: Restaurants can choose between 'Points-based' (earning credits after reaching a points threshold) and 'Visits-based' (earning credits after a set number of visits).

### Security & Privacy
SMS rate limiting is implemented across multiple layers (per-IP, per-phone, per-restaurant, global daily limits) to prevent abuse. Cloudflare Turnstile provides captcha protection for authentication flows. For analytics, diners have a unique `analyticsId` for anonymous trend reporting, ensuring POPIA-compliant pseudonymization of data.

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