# Dine&More - Complete Technical Documentation

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [System Architecture](#2-system-architecture)
3. [Database Schema](#3-database-schema)
4. [Authentication & Security](#4-authentication--security)
5. [Loyalty Program Engine](#5-loyalty-program-engine)
6. [Voucher System](#6-voucher-system)
7. [Restaurant Management](#7-restaurant-management)
8. [Diner Management](#8-diner-management)
9. [Reconciliation System](#9-reconciliation-system)
10. [FTP Automated Import](#10-ftp-automated-import)
11. [Diner Discovery](#11-diner-discovery)
12. [SMS & Email Services](#12-sms--email-services)
13. [Insights & Analytics](#13-insights--analytics)
14. [API Reference](#14-api-reference)
15. [Frontend Architecture](#15-frontend-architecture)
16. [Business Rules Summary](#16-business-rules-summary)
17. [External Integrations](#17-external-integrations)

---

## 1. Platform Overview

Dine&More is a premium loyalty rewards platform connecting diners with restaurants in South Africa. The platform serves two distinct user types through separate portals:

- **Restaurant Admin Portal** (`/admin/*`): Restaurant owners and staff manage loyalty programs, voucher types, reconciliation, staff, branches, analytics, and business profiles.
- **Diner Portal** (`/diner/*`): Loyalty members track points, view and redeem vouchers, browse transaction history, discover new restaurants, and manage their profiles.

The platform supports **dual-identity**: a single person can be both a diner AND a restaurant staff member using the same email/phone number.

### Key Platform Capabilities

| Capability | Description |
|---|---|
| Multi-branch architecture | Restaurants can have multiple physical locations with branch-specific or organization-wide loyalty |
| Flexible loyalty modes | Points-based (spend) and visits-based (frequency) earning, configurable per voucher type |
| CSV reconciliation | Match POS transaction data with platform records, with automated daily FTP import |
| Diner discovery | Restaurants opt-in to be listed as rewards partners, allowing diners to join new programs |
| Role-based access | Owner, manager, and staff roles with branch-specific permissions |
| POPIA compliance | Anonymized analytics IDs, data archiving on deletion, privacy-conscious design |

---

## 2. System Architecture

### Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Routing | Wouter |
| State Management | TanStack React Query |
| Styling | Tailwind CSS, shadcn/ui (Radix UI primitives) |
| Backend | Express.js, TypeScript |
| Database | PostgreSQL (Neon-backed on Replit) |
| ORM | Drizzle ORM |
| Validation | Zod, drizzle-zod |
| Charts | Recharts |
| Icons | Lucide React |

### High-Level Architecture

```
Browser
  |
  |--- Diner Portal (React SPA) ---> /api/diner/*  ---> DinerApiRoutes
  |                                                        |
  |--- Admin Portal (React SPA) ---> /api/admin/*  ---> AdminApiRoutes
  |                                                        |
  |--- Auth flows              ---> /api/auth/*   ---> AuthRoutes
  |                                                        |
  +-----------------------------------------------------> Service Layer
                                                           |
                                            LoyaltyService | VoucherService
                                            StatsService   | ConfigService
                                            ReconciliationService
                                                           |
                                                    Storage (IStorage)
                                                           |
                                                    PostgreSQL (Drizzle)
```

### Backend Structure

```
server/
  index.ts              # Express app setup, session config, server startup
  routes.ts             # Route composer - registers all route modules
  storage.ts            # IStorage interface + DbStorage implementation
  static.ts             # Production static file serving
  vite.ts               # Development Vite HMR setup
  routes/
    auth.ts             # Authentication (login, register, OTP, password reset, deletion)
    admin-api.ts        # Admin portal endpoints (session-based, restaurantId from auth)
    diner-api.ts        # Diner portal endpoints (session-based, dinerId from auth)
    diners.ts           # Legacy diner-specific routes
    restaurants.ts      # Legacy restaurant routes
    vouchers.ts         # Legacy voucher routes
    transactions.ts     # Legacy transaction routes
    reconciliation.ts   # Legacy reconciliation routes
    invitations.ts      # Diner invitation flows
  services/
    loyalty/
      index.ts               # Service factory - creates all services
      loyalty.service.ts      # Points/visits tracking, credit earning, voucher auto-generation
      voucher.service.ts      # Voucher presentation, validation, code-based redemption
      stats.service.ts        # Dashboard statistics
      config.service.ts       # Restaurant settings validation and updates
      reconciliation.service.ts # CSV parsing and bill matching
    sms.ts                    # SMS Portal API integration
    email.ts                  # Bird (MessageBird) email integration
    ftp-fetch.ts              # FTP client for automated CSV imports
    scheduler.ts              # Daily scheduled FTP fetch (06:35 UTC)
    smsRateLimiter.ts         # Multi-tier SMS rate limiting
    captcha.ts                # Cloudflare Turnstile verification
  validation/
    auth-schemas.ts           # Zod schemas for auth-related requests
```

### Frontend Structure

```
client/src/
  App.tsx                     # Router with all page routes
  pages/
    home.tsx                  # Landing/login page
    register.tsx              # Diner self-registration
    forgot-password.tsx       # Password reset request
    reset-password.tsx        # Password reset form
    confirm-account-deletion.tsx # Account deletion confirmation
    admin-dashboard.tsx       # Admin main dashboard
    admin-vouchers.tsx        # Voucher type management
    admin-reconciliation.tsx  # CSV upload and batch viewing
    admin-settings.tsx        # Loyalty program configuration
    admin-insights.tsx        # Analytics and charts
    admin-activity-logs.tsx   # Audit trail
    admin-onboarding.tsx      # Restaurant onboarding wizard
    admin-users.tsx           # Staff management
    admin-profile.tsx         # Business profile editing
    diner-dashboard.tsx       # Points, vouchers, restaurant cards
    diner-history.tsx         # Transaction history
    diner-profile.tsx         # Personal profile, phone change
    diner-faq.tsx             # FAQ page
    diner-terms.tsx           # Static terms and conditions
  components/
    auth-guard.tsx            # AdminGuard, DinerGuard route protection
    layout/                   # AdminLayout, DinerLayout wrappers
    dashboard/                # Dashboard-specific components
    ui/                       # shadcn/ui component library
    ObjectUploader.tsx        # Object storage file upload component
  lib/
    queryClient.ts            # React Query client, getAuthHeaders utility
```

---

## 3. Database Schema

### Entity Relationship Overview

```
diners ──────────────┐
                     │
users (legacy) ──────┤── pointsBalances ── restaurants ── branches
                     │                          │
restaurantStaff ─────┘                          │── voucherTypes
                                                │── vouchers
                                                │── campaigns
                                                │── reconciliationBatches ── reconciliationRecords
                                                │── dinerInvitations
                                                │── portalUsers ── portalUserBranches
                                                │── activityLogs
                                                └── restaurantSubscriptions
```

### Core Tables

#### `diners`
Loyalty program members who earn and redeem rewards.

| Column | Type | Description |
|---|---|---|
| id | varchar (UUID) | Primary key |
| analyticsId | text (unique) | 12-char base62 anonymous ID for POPIA-compliant analytics |
| email | text (unique) | Login email |
| password | text | bcrypt hashed password |
| name | text | First name |
| lastName | text | Surname |
| phone | text (unique) | Mobile number (South African format) |
| gender | text | 'male' or 'female' |
| dateOfBirth | text | DD/MM/YYYY format |
| province | text | South African province |
| accessToken | text (unique) | Persistent auto-login token (90-day validity) |
| accessTokenExpiresAt | timestamp | Token expiry |
| phoneVerified | boolean | Whether phone has been OTP-verified |
| activeVoucherCode | text | Temporary 12-char alphanumeric presentation code |
| activeVoucherId | text | ID of voucher currently being presented |
| activeVoucherCodeSetAt | timestamp | When presentation code was generated (15-min validity) |
| termsAcceptedAt | timestamp | T&C acceptance timestamp |
| privacyAcceptedAt | timestamp | Privacy policy acceptance |
| createdAt | timestamp | Account creation date |

#### `restaurant_staff`
Restaurant administrators and staff members.

| Column | Type | Description |
|---|---|---|
| id | varchar (UUID) | Primary key |
| email | text (unique) | Login email |
| password | text | bcrypt hashed password |
| name | text | Full name |
| phone | text (unique) | Contact number |
| accessToken | text (unique) | Auto-login token |
| accessTokenExpiresAt | timestamp | Token expiry |
| createdAt | timestamp | Account creation date |

#### `users` (Legacy)
Kept for backward compatibility. Uses composite unique constraints on `(email, user_type)` and `(phone, user_type)`.

| Column | Type | Description |
|---|---|---|
| id | varchar (UUID) | Primary key (referenced by most FK relationships) |
| userType | text | 'diner' or 'restaurant_admin' |
| analyticsId | text (unique) | Anonymous analytics ID |
| ... | ... | Same profile fields as diners table |

**Important**: The legacy `users` table is currently the source of truth for foreign key relationships. New tables (`diners`, `restaurant_staff`) are being populated in parallel during migration.

#### `restaurants`
Restaurant organizations.

| Column | Type | Description |
|---|---|---|
| id | varchar (UUID) | Primary key |
| name | text | Legal business name |
| tradingName | text | Trading name if different |
| adminUserId | varchar (FK -> users) | Owner's user ID |
| voucherValue | text | Default voucher description (e.g., "R100 Loyalty Voucher") |
| voucherValidityDays | integer | Default days until voucher expires (default: 30) |
| pointsPerCurrency | integer | Points earned per R1 spent (default: 1) |
| pointsThreshold | integer | Points needed to earn a credit (default: 1000) |
| voucherEarningMode | text | 'points' or 'visits' (default: 'points') |
| visitThreshold | integer | Visits needed to earn a credit (default: 10) |
| loyaltyScope | text | 'organization' or 'branch' (default: 'organization') |
| voucherScope | text | 'organization' or 'branch' (default: 'organization') |
| onboardingStatus | text | 'draft', 'submitted', or 'active' |
| dinerDiscoveryEnabled | boolean | Whether listed in diner discovery (default: false) |
| ftpPath | text | Per-restaurant FTP folder path for automated CSV imports |
| logoUrl | text | Business logo URL (object storage) |
| ... | ... | Address, contact, social media fields |

#### `branches`
Physical locations under a restaurant organization.

| Column | Type | Description |
|---|---|---|
| id | varchar (UUID) | Primary key |
| restaurantId | varchar (FK -> restaurants) | Parent restaurant |
| name | text | Branch name (e.g., "Sandton City") |
| address | text | Physical address |
| phone | text | Branch contact number |
| isActive | boolean | Whether branch is operational |
| isDefault | boolean | Default branch for the restaurant |

#### `points_balances`
Points/visits tracking per diner per restaurant (or per branch).

| Column | Type | Description |
|---|---|---|
| id | varchar (UUID) | Primary key |
| dinerId | varchar (FK -> users) | Diner's user ID |
| restaurantId | varchar (FK -> restaurants) | Restaurant |
| branchId | varchar (FK -> branches) | null = org-wide, set when loyaltyScope='branch' |
| currentPoints | integer | Points accumulated since last threshold reset |
| totalPointsEarned | integer | Lifetime points earned |
| currentVisits | integer | Visits since last visit-threshold reset |
| totalVisits | integer | Lifetime visit count |
| pointsCredits | integer | Available credits earned from points threshold |
| visitCredits | integer | Available credits earned from visit threshold |
| totalVouchersGenerated | integer | Lifetime vouchers generated |
| totalVoucherCreditsEarned | integer | Lifetime credits earned |

#### `transactions`
Every recorded spending transaction.

| Column | Type | Description |
|---|---|---|
| id | varchar (UUID) | Primary key |
| dinerId | varchar (FK -> users) | Diner who spent |
| restaurantId | varchar (FK -> restaurants) | Where they spent |
| branchId | varchar (FK -> branches) | Which branch |
| billId | text | POS bill/invoice number |
| amountSpent | decimal(10,2) | Amount in Rands |
| pointsEarned | integer | Points calculated from spend |
| transactionDate | timestamp | When transaction occurred |

#### `voucher_types`
Templates created by restaurant owners defining what vouchers diners can choose.

| Column | Type | Description |
|---|---|---|
| id | varchar (UUID) | Primary key |
| restaurantId | varchar (FK -> restaurants) | Owner restaurant |
| branchId | varchar (FK -> branches) | Branch-specific type (null = org-wide) |
| category | text | 'rand_value', 'percentage', 'free_item', or 'registration' |
| earningMode | text | 'points' or 'visits' - which credits to consume |
| pointsPerCurrencyOverride | integer | Override restaurant default (null = use restaurant setting) |
| name | text | Display name (e.g., "R100 Off Your Bill") |
| description | text | Details about the voucher |
| rewardDetails | text | Fine print/terms |
| value | integer | Rand amount or percentage (null for free_item) |
| freeItemType | text | 'beverage', 'starter', 'main', 'dessert', 'side', 'other' |
| freeItemDescription | text | Specific item for free_item category |
| redemptionScope | text | 'all_branches' or 'specific_branches' |
| redeemableBranchIds | text[] | Branch IDs where voucher can be redeemed |
| creditsCost | integer | Credits needed to redeem (default: 1) |
| validityDays | integer | Days until individual voucher expires after issue |
| expiresAt | timestamp | When voucher type itself expires (min 6 months from creation) |
| isActive | boolean | Whether diners can select this type |

#### `vouchers`
Individual voucher instances issued to diners.

| Column | Type | Description |
|---|---|---|
| id | varchar (UUID) | Primary key |
| dinerId | varchar (FK -> users) | Owner diner |
| restaurantId | varchar (FK -> restaurants) | Issuing restaurant |
| branchId | varchar (FK -> branches) | Branch where redeemed |
| voucherTypeId | varchar (FK -> voucher_types) | Source voucher type |
| title | text | Voucher name |
| expiryDate | timestamp | When this specific voucher expires |
| isRedeemed | boolean | Whether used |
| redeemedAt | timestamp | When used |
| billId | text | POS bill ID for reconciliation |

#### `registration_voucher_status`
Tracks one-time registration vouchers per diner per restaurant.

| Column | Type | Description |
|---|---|---|
| dinerId | varchar (FK -> users) | Diner |
| restaurantId | varchar (FK -> restaurants) | Restaurant |
| voucherId | varchar (FK -> vouchers) | The registration voucher issued |
| issuedAt | timestamp | When issued |
| redeemedAt | timestamp | When redeemed (first visit) |

#### `reconciliation_batches`
CSV upload batches for bill matching.

| Column | Type | Description |
|---|---|---|
| id | varchar (UUID) | Primary key |
| restaurantId | varchar (FK -> restaurants) | Owner restaurant |
| branchId | varchar (FK -> branches) | Branch association |
| fileName | text | Original CSV filename (prefixed 'ftp-' for automated imports) |
| totalRecords | integer | Total rows in CSV |
| matchedRecords | integer | Rows matched to platform transactions |
| unmatchedRecords | integer | Rows with no match |
| status | text | 'pending', 'processing', 'completed' |
| csvHeaders | jsonb | Original CSV column headers |
| processedAt | timestamp | When processing completed |

#### `reconciliation_records`
Individual CSV rows with match results.

| Column | Type | Description |
|---|---|---|
| batchId | varchar (FK -> reconciliation_batches) | Parent batch |
| billId | text | Bill ID from CSV |
| csvAmount | text | Amount from CSV |
| csvDate | text | Date from CSV |
| csvData | jsonb | All CSV row data as key-value pairs |
| isMatched | boolean | Whether matched to a platform transaction |
| matchedVoucherId | varchar (FK -> vouchers) | Matched voucher if any |

#### `diner_invitations`
SMS registration invitations sent to potential diners.

| Column | Type | Description |
|---|---|---|
| restaurantId | varchar (FK -> restaurants) | Inviting restaurant |
| branchId | varchar (FK -> branches) | Branch that sent invite |
| phone | text | Recipient phone number |
| token | text (unique) | Registration link token |
| status | text | 'pending', 'registered', 'expired' |
| invitedBy | varchar (FK -> users) | Admin who sent invite |
| dinerId | varchar (FK -> users) | User created after registration |
| expiresAt | timestamp | Link expiration |

#### `portal_users`
Additional staff members who can access a restaurant's admin portal.

| Column | Type | Description |
|---|---|---|
| restaurantId | varchar (FK -> restaurants) | Restaurant |
| userId | varchar (FK -> users) | Staff member |
| role | text | 'owner', 'manager', 'staff' |
| hasAllBranchAccess | boolean | Whether can access all branches |
| addedBy | varchar (FK -> users) | Who added them |

#### `portal_user_branches`
Branch-level access assignments for portal users.

| Column | Type | Description |
|---|---|---|
| portalUserId | varchar (FK -> portal_users) | Portal user (cascade delete) |
| branchId | varchar (FK -> branches) | Accessible branch (cascade delete) |

#### `activity_logs`
Audit trail for important actions.

| Column | Type | Description |
|---|---|---|
| restaurantId | varchar (FK -> restaurants) | Restaurant context |
| branchId | varchar (FK -> branches) | Branch context (null = org-level) |
| userId | varchar (FK -> users) | Who performed action (null = system) |
| action | text | Action type (e.g., 'voucher_redeemed', 'settings_updated') |
| details | text | JSON string with additional context |
| targetType | text | Entity type: 'voucher', 'transaction', 'settings', 'user' |
| targetId | text | ID of affected entity |

#### Other Tables
- **`account_deletion_requests`**: Tracks deletion confirmation tokens (24h expiry)
- **`archived_users`**: Stores user data for 90 days post-deletion (POPIA compliance)
- **`password_reset_tokens`**: Reset link tokens (1h expiry)
- **`phone_change_requests`**: OTP-verified phone number changes (10min expiry, max 5 attempts)
- **`campaigns`**: Future feature for push voucher campaigns
- **`restaurant_subscriptions`**: Subscription/billing tracking

---

## 4. Authentication & Security

### Authentication Flow

1. **Login** (`POST /api/auth/login`):
   - Requires email, password, captchaToken, and portal ('diner' or 'restaurant')
   - Portal parameter determines which user type to authenticate against
   - Cloudflare Turnstile captcha verification required
   - Password verified with bcrypt (supports legacy plaintext fallback)
   - Creates express-session with userId and userType
   - Returns user info, restaurant info (for admins), and portal role

2. **Session Management**:
   - Express sessions stored in MemoryStore (pruned every 24h)
   - 90-day cookie lifespan
   - Secure, httpOnly, sameSite=none cookies (for Replit webview)

3. **Dual Authentication Support**:
   - Sessions (cookie-based): `req.session.userId`
   - Headers: `X-User-Id` and `X-User-Type` headers
   - `getAuthUserId(req)` checks headers first, falls back to session
   - Frontend sends both via `credentials: "include"` and `getAuthHeaders()`

4. **Token-Based Auto-Login** (`POST /api/auth/login-token`):
   - Access tokens stored per user (90-day validity)
   - Allows persistent login without re-entering credentials

### Registration Paths

| Path | Flow |
|---|---|
| Self-registration | Single form -> creates account -> phone verified post-login via OTP |
| Invitation-based | Restaurant sends SMS invite -> diner clicks link -> registers with pre-verified phone |

### Password Rules
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Security Measures

| Measure | Implementation |
|---|---|
| Captcha | Cloudflare Turnstile on login (test key in dev, real key in prod) |
| Rate Limiting | express-rate-limit: 100 req/sec on auth, 5 req/min on SMS |
| SMS Rate Limiting | Multi-tier: 3/day per phone, 100/day per restaurant, 1000/day global |
| Password Hashing | bcrypt with salt rounds of 12 |
| OTP Verification | 6-digit code, 10-minute expiry, max 5 attempts |
| Account Deletion | Two-step: email confirmation link (24h) -> data archived 90 days -> permanent deletion |
| Analytics Privacy | Unique 12-char base62 `analyticsId` for pseudonymized reporting (POPIA) |

---

## 5. Loyalty Program Engine

### How Points Work

1. **Transaction Recording**: When a diner spends money, a transaction is created.
2. **Points Calculation**: `pointsEarned = floor(amountSpent * restaurant.pointsPerCurrency)`
   - Default: 1 point per R1 spent
   - Configurable per restaurant (1-100 points per R1)
3. **Credit Earning**: When `currentPoints >= pointsThreshold`, a credit is earned.
   - Points reset: `currentPoints -= pointsThreshold` (remainder carries over)
   - Credit is added to `pointsCredits` on the balance
4. **Visit Tracking**: Each transaction counts as 1 visit.
   - When `currentVisits >= visitThreshold`, a visit credit is earned
   - Visits reset similarly to points

### Dual Earning Modes

Each voucher type specifies its earning mode:

| Mode | Credit Source | Threshold |
|---|---|---|
| Points-based | Accumulated spend | `pointsThreshold` (default: 1000) |
| Visits-based | Number of transactions | `visitThreshold` (default: 10) |

Both modes can operate simultaneously - a restaurant can have voucher types for both points and visits.

### Credit Consumption

When a diner redeems a credit for a voucher:
1. System checks the voucher type's `earningMode` (points or visits)
2. Deducts `creditsCost` credits from the matching credit pool (`pointsCredits` or `visitCredits`)
3. Creates a `voucher` instance with calculated expiry date

### Auto-Generation

After each transaction, the system checks if any active voucher types can be automatically fulfilled:
- Finds the first active voucher type for each earning mode
- If the diner has enough credits, auto-generates vouchers
- Deducts credits accordingly

### Loyalty Scope

| Scope | Points Behavior | Balance Key |
|---|---|---|
| Organization | Points accumulate across all branches | `(dinerId, restaurantId, null)` |
| Branch | Points tracked per individual branch | `(dinerId, restaurantId, branchId)` |

When `loyaltyScope = 'branch'`, every transaction MUST include a `branchId`.

### Key Business Rules

- Points never expire (no time-based decay)
- Points reset to zero (minus remainder) when a credit is earned
- Visits reset similarly when a visit credit is earned
- Credits persist until the diner manually redeems them
- A diner can accumulate credits from both points and visits simultaneously
- Registration vouchers are one-time per diner per restaurant

---

## 6. Voucher System

### Voucher Categories

| Category | Description | Value Field |
|---|---|---|
| rand_value | Fixed Rand discount off bill | Rand amount (e.g., 100 = R100 off) |
| percentage | Percentage discount | Percentage value (e.g., 20 = 20% off) |
| free_item | Complimentary item | freeItemType + freeItemDescription |
| registration | One-time welcome voucher | Rand amount (one per diner per restaurant) |

### Voucher Lifecycle

```
Voucher Type Created (by admin)
        |
        v
Diner Earns Credits (via transactions)
        |
        v
Diner Redeems Credit -> Voucher Instance Created
        |                 (status: active, expiry set)
        v
Diner Taps Voucher -> Presentation Code Generated
        |              (12-char alphanumeric, 15-min validity)
        v
Admin Enters Code -> Voucher Marked as Redeemed
        |              (redeemedAt set, billId recorded)
        v
Voucher Appears in Reconciliation
```

### Presentation Code System

The platform uses a **tap-to-present** model instead of static voucher codes:

1. Diner taps a voucher in the app -> system generates a random 12-character alphanumeric code
2. Code is stored on the user record (`activeVoucherCode`, `activeVoucherId`, `activeVoucherCodeSetAt`)
3. Code is valid for **15 minutes** from generation
4. Restaurant staff enters the code to redeem
5. System validates: code exists, not expired, voucher belongs to this restaurant, voucher is valid
6. After redemption (or expiry), code is cleared

### Redemption Scope

| Scope | Behavior |
|---|---|
| all_branches | Voucher can be redeemed at any branch |
| specific_branches | Voucher only redeemable at branches listed in `redeemableBranchIds` |

### Validation Rules

- Voucher must not be already redeemed
- Voucher must not be expired (past `expiryDate`)
- Voucher must belong to the restaurant attempting redemption
- If `specific_branches`, current branch must be in the allowed list
- Presentation code must not be expired (15-minute window)

---

## 7. Restaurant Management

### Onboarding Flow

Restaurants go through a three-stage onboarding process:

```
Draft -> Submitted -> Active
```

**Draft**: Initial state. Admin fills in:
- Registration number (required for submission)
- Address details (street, city, province, postal code - required)
- Contact details (name, email, phone - required)
- Additional optional fields (trading name, description, cuisine, social links, hours)

**Submitted**: Admin submits for review. Validation checks:
- Registration number present
- Street address and city present
- Contact name, email, and phone present

**Active**: Restaurant is activated and can fully operate on the platform.

### Restaurant Settings

| Setting | Range | Default | Description |
|---|---|---|---|
| pointsPerCurrency | 1-100 | 1 | Points per R1 spent |
| pointsThreshold | 100-10,000 | 1,000 | Points to earn a credit |
| voucherEarningMode | points/visits | points | Primary earning method |
| visitThreshold | 1-100 | 10 | Visits to earn a credit |
| loyaltyScope | organization/branch | organization | Points tracking scope |
| voucherScope | organization/branch | organization | Voucher redemption scope |
| voucherValidityDays | 1-365 | 30 | Default voucher expiry |

### Branch Management

- Restaurants can have multiple branches
- One branch must be marked as default
- Default branch cannot be deleted (must reassign first)
- Branches can be activated/deactivated
- Staff can have branch-specific access

### Staff Management

Only the restaurant **owner** (the user whose ID is `adminUserId` on the restaurant) can manage staff.

| Role | Permissions |
|---|---|
| Owner | Full access to all features and branches |
| Manager | Access to assigned branches, can manage operations |
| Staff | Access to assigned branches, operational tasks only |

Staff members are created as `restaurant_admin` user type accounts and linked via `portal_users` with role and branch assignments.

---

## 8. Diner Management

### Registration

**Self-Registration Form Fields**:
- First name (required)
- Surname (required)
- Email (required, unique among diners)
- Phone (required, unique among diners)
- Password (must meet strength requirements)
- Gender (male/female, required)
- Date of birth (DD/MM/YYYY, required)
- Province (South African province, required)
- Optional: restaurantId (if registering via restaurant QR code)

**Invitation-Based Registration**:
- Restaurant admin sends SMS invite to phone number
- SMS contains a unique registration link with token
- Diner clicks link, completes registration form
- Phone is pre-verified through invitation OTP flow

### Phone Verification

New diner accounts require post-login phone verification:
1. App shows verification modal on first login
2. System sends 6-digit OTP via SMS to registered phone
3. Diner enters OTP (max 5 attempts, 10-minute expiry)
4. On success, `phoneVerified` flag set to true

### Phone Number Changes

Existing diners can change their phone number:
1. Request change with new phone number
2. System checks new number isn't already registered
3. SMS rate limit check
4. OTP sent to NEW phone number
5. Diner verifies OTP
6. Phone updated on user record

### Profile Management

Diners can update:
- First name
- Last name
- Email (uniqueness checked)
- Phone (via separate OTP flow)

### Account Deletion

Two-step confirmation process:
1. Diner requests deletion -> confirmation email sent (24h expiry)
2. Diner clicks email link -> account archived and then deleted
3. Archived data retained 90 days for compliance, then permanently removed
4. Session destroyed on deletion

---

## 9. Reconciliation System

### Purpose

The reconciliation system allows restaurants to match their POS (Point of Sale) transaction data with transactions recorded on the Dine&More platform. This verifies that voucher redemptions and transactions are accurately captured.

### CSV Format Requirements

The CSV must contain a **bill_id** column (recognized names: `bill_id`, `billid`, `bill id`, `invoice_id`, `invoiceid`, `invoice`).

Optional recognized columns:
- Amount: `amount`, `total`, `value`, `bill_amount`
- Date: `date`, `transaction_date`, `bill_date`
- Restaurant: `restaurant`, `restaurant_name`, `store`, `branch`, `outlet`
- Customer: `customer`, `name`, `user`, `guest`, `diner`, `client`, `member` (anonymized to "User 1", "User 2", etc.)

### Processing Flow

1. CSV is uploaded (manually or via FTP)
2. System parses CSV, identifying headers and records
3. For each row, system looks up `billId` in platform transactions for that restaurant
4. Matched records are linked to their platform transaction and any associated voucher
5. Variance is calculated: `csvAmount - recordedAmount`
6. Batch summary created with match/unmatch counts
7. Customer names are anonymized (replaced with "User 1", "User 2", etc.)

### Privacy Features in Reconciliation

- Customer names from CSV are replaced with sequential pseudonyms ("User 1", "User 2")
- Restaurant name in CSV can be overridden with the platform's restaurant name
- Phone numbers are displayed as "User N" in enriched records

---

## 10. FTP Automated Import

### Overview

The platform supports automated CSV import from an SFTP server, enabling restaurants to have their POS data automatically reconciled without manual uploads.

### Configuration

- **Per-restaurant FTP path**: Each restaurant can have a unique `ftpPath` configured
- **Global FTP credentials**: Shared via environment variables:
  - `FTP_HOST`: SFTP server hostname
  - `FTP_USERNAME`: Login username
  - `FTP_PASSWORD`: Login password
  - `FTP_PATH`: Default path (overridden by per-restaurant `ftpPath`)

### Schedule

- Runs daily at **06:35 UTC**
- Implemented as a `setTimeout` loop in `server/services/scheduler.ts`
- If the app restarts after 06:35, the next run is scheduled for the following day

### Processing Logic

1. Scheduler triggers at 06:35 UTC
2. Queries all restaurants with `ftpPath` configured
3. For each restaurant:
   a. Connects to FTP server
   b. Lists CSV files in the restaurant's folder
   c. Skips files already processed (checks `reconciliation_batches` by filename prefix `ftp-`)
   d. Downloads new CSV files
   e. Processes through reconciliation service
   f. Records results

### Duplicate Prevention

Files are tracked by name with an `ftp-` prefix. If a batch with filename `ftp-{filename}` already exists for that restaurant, the file is skipped.

### Manual Trigger

Admins can trigger an immediate FTP fetch via the admin portal, which calls the same `fetchAndProcessFtpFiles` function.

### Status Monitoring

The scheduler exposes status via `getSchedulerStatus()`:
- Next scheduled run time
- Whether a fetch is currently running
- Last result per restaurant (files processed, skipped, errors)

---

## 11. Diner Discovery

### Overview

Restaurants can opt-in to be listed as rewards partners visible to all Dine&More diners, allowing diners to discover and join new loyalty programs.

### How It Works

1. Restaurant admin enables discovery in settings
2. Admin accepts terms and conditions (timestamp recorded)
3. Restaurant appears in diner's "Available Restaurants" list
4. Requirements:
   - Restaurant must have `onboardingStatus = 'active'`
   - Discovery must be enabled (`dinerDiscoveryEnabled = true`)
5. Diner can "join" a restaurant, which creates an initial `pointsBalance` record

### Joining Flow

1. Diner browses available restaurants (filtered to show only those not yet joined)
2. Diner clicks "Join"
3. System creates a points balance with all zeros
4. Diner can now earn points and access vouchers at that restaurant

### Billing Consideration

Enabling diner discovery includes acknowledgment that new diner registrations through discovery may incur billing charges per the restaurant's subscription plan.

---

## 12. SMS & Email Services

### SMS (SMS Portal API)

**Provider**: SMS Portal (rest.smsportal.com)

**Authentication**: Basic auth with `SMS_CLIENT_ID:SMS_API_SECRET` base64 encoded

**Usage**:
- Registration invitations (link to register)
- Phone change OTP codes
- Password reset links (alternative to email)

**Rate Limits**:
| Level | Limit | Period |
|---|---|---|
| Per phone | 3 | 24 hours |
| Per restaurant | 100 | 24 hours |
| Global | 1,000 | 24 hours |

**Phone Number Handling**: South African numbers are normalized and searched in multiple formats:
- Local: `0821234567`
- International with plus: `+27821234567`
- International without plus: `27821234567`

### Email (Bird / MessageBird)

**Provider**: Bird (api.bird.com)

**Authentication**: AccessKey header with `BIRD_API_KEY`

**Configuration**:
- `BIRD_WORKSPACE_ID`: Bird workspace
- `BIRD_EMAIL_CHANNEL_ID`: Email channel

**Usage**:
- Password reset emails (HTML + text versions)
- Account deletion confirmation emails

---

## 13. Insights & Analytics

### Admin Dashboard Statistics

The stats service provides:
- **Diners (last 30 days)**: Unique diners who transacted in the last 30 days
- **Total Spent**: Sum of transaction amounts in last 30 days
- **Vouchers Redeemed**: Count of redeemed vouchers
- **Total Registered Diners**: Platform-wide diner count

### Revenue Analytics

- Revenue data queryable by date range and branch
- Returns daily revenue amounts for charting
- Default range: last 30 days

### Insights Dashboard Features

- Diner registration trends over time
- Voucher redemption breakdown by type
- Revenue charts
- Branch-specific filtering (respects staff branch access)

### Branch Access Enforcement

All analytics endpoints enforce branch-level access:
- Owners see all branches
- Staff/managers only see assigned branches
- If no branchId specified, defaults to first accessible branch

---

## 14. API Reference

### Authentication Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /api/auth/login | Login with email/password/captcha |
| POST | /api/auth/logout | Destroy session |
| GET | /api/auth/me | Get current authenticated user |
| POST | /api/auth/register-diner | Self-register as diner |
| POST | /api/auth/login-token | Auto-login with access token |
| POST | /api/auth/forgot-password | Request email password reset |
| POST | /api/auth/forgot-password-sms | Request SMS password reset |
| POST | /api/auth/reset-password | Reset password with token |
| GET | /api/auth/validate-reset-token | Check if reset token is valid |
| POST | /api/auth/request-otp | Request phone verification OTP |
| POST | /api/auth/verify-otp | Verify phone OTP |
| POST | /api/account/request-deletion | Request account deletion |
| POST | /api/account/confirm-deletion | Confirm deletion with token |

### Admin Portal Endpoints (`/api/admin/*`)

All require restaurant_admin authentication. RestaurantId derived from session.

| Method | Path | Description |
|---|---|---|
| GET | /api/admin/restaurant | Get restaurant details |
| PATCH | /api/admin/restaurant/settings | Update loyalty settings |
| PATCH | /api/admin/restaurant/profile | Update business profile |
| PATCH | /api/admin/restaurant/onboarding | Update onboarding data |
| POST | /api/admin/restaurant/onboarding/submit | Submit for review |
| POST | /api/admin/restaurant/onboarding/activate | Activate restaurant |
| GET | /api/admin/branches | List branches |
| POST | /api/admin/branches | Create branch |
| PATCH | /api/admin/branches/:branchId | Update branch |
| DELETE | /api/admin/branches/:branchId | Delete branch |
| GET | /api/admin/stats | Dashboard statistics |
| GET | /api/admin/revenue | Revenue by date range |
| GET | /api/admin/diners | List registered diners |
| GET | /api/admin/staff | List staff members (owner only) |
| POST | /api/admin/staff | Add staff member (owner only) |
| DELETE | /api/admin/staff/:portalUserId | Remove staff member |
| PATCH | /api/admin/staff/:portalUserId/branch-access | Update branch access |
| GET | /api/admin/voucher-types | List voucher types |
| POST | /api/admin/voucher-types | Create voucher type |
| PATCH | /api/admin/voucher-types/:id | Update voucher type |
| DELETE | /api/admin/voucher-types/:id | Delete voucher type |
| POST | /api/admin/record-transaction | Record transaction by phone |
| POST | /api/admin/redeem-voucher | Redeem voucher by code |
| GET | /api/admin/reconciliation/batches | List reconciliation batches |
| POST | /api/admin/reconciliation/upload | Upload CSV for reconciliation |
| GET | /api/admin/reconciliation/batches/:batchId | Get batch details |
| POST | /api/admin/invite-diner | Send SMS invitation |
| GET | /api/admin/invitations | List sent invitations |
| GET | /api/admin/activity-logs | View audit trail |
| GET | /api/admin/ftp-status | Get FTP scheduler status |
| POST | /api/admin/ftp-fetch | Trigger manual FTP fetch |
| GET | /api/admin/discovery | Get discovery settings |
| PATCH | /api/admin/discovery | Update discovery settings |
| GET | /api/admin/insights/registrations | Diner registration trends |
| GET | /api/admin/insights/voucher-redemptions | Redemption by type |

### Diner Portal Endpoints (`/api/diner/*`)

All require diner authentication. DinerId derived from session.

| Method | Path | Description |
|---|---|---|
| GET | /api/diner/points | Get all points balances with enriched data |
| GET | /api/diner/transactions | Get all transactions across restaurants |
| GET | /api/diner/restaurants/:restaurantId/transactions | Transaction history per restaurant |
| POST | /api/diner/transactions | Record a transaction |
| GET | /api/diner/vouchers | Get all vouchers with status |
| POST | /api/diner/vouchers/:voucherId/select | Generate presentation code |
| POST | /api/diner/restaurants/:restaurantId/redeem-credit | Redeem a credit for voucher |
| PATCH | /api/diner/profile | Update profile (name, email) |
| POST | /api/diner/phone-change/request | Request phone change OTP |
| POST | /api/diner/phone-change/verify | Verify phone change OTP |
| GET | /api/diner/available-restaurants | Browse discoverable restaurants |
| POST | /api/diner/join-restaurant | Join a restaurant's rewards program |

---

## 15. Frontend Architecture

### Routing

The app uses Wouter for client-side routing with route guards:

- **Public Routes**: `/`, `/register`, `/forgot-password`, `/reset-password`
- **Admin Routes**: `/admin/*` wrapped in `<AdminGuard>`
- **Diner Routes**: `/diner/*` wrapped in `<DinerGuard>`

### Authentication Guards

`AdminGuard` and `DinerGuard` check the user's authentication status via `/api/auth/me`:
- If not authenticated, redirect to login
- If wrong user type, redirect appropriately

### State Management

TanStack React Query handles all server state:
- Queries cache API responses
- Mutations handle create/update/delete operations
- `getAuthHeaders()` utility ensures every request includes auth credentials

### API Call Pattern

Every frontend API call MUST include:
```typescript
fetch(url, {
  credentials: "include",      // Session cookie
  headers: getAuthHeaders(),   // X-User-Id and X-User-Type
})
```

---

## 16. Business Rules Summary

### Points & Credits

1. Points = floor(amountSpent * pointsPerCurrency)
2. Points never expire
3. Points reset (minus remainder) when threshold reached, earning a credit
4. Credits persist until manually redeemed by diner
5. Visits counted per transaction (1 transaction = 1 visit)
6. Both points and visit credits can accumulate simultaneously

### Vouchers

7. Voucher types define templates; voucher instances are issued to diners
8. Each voucher type specifies earning mode (points or visits) independently
9. Presentation codes are temporary (15 minutes), generated on-demand
10. Vouchers can be branch-restricted via redemption scope
11. Registration vouchers are one-time per diner per restaurant
12. Voucher type expiry must be minimum 6 months from creation

### Restaurant Operations

13. Only owners can manage staff
14. Default branch cannot be deleted
15. Staff access is branch-specific or all-branch
16. Onboarding requires registration number, address, and contact details
17. Discovery opt-in requires T&C acceptance

### Security

18. All auth flows require Cloudflare Turnstile captcha
19. SMS rate limited at phone, restaurant, and global levels
20. OTP codes expire in 10 minutes with max 5 attempts
21. Account deletion requires email confirmation within 24 hours
22. Archived user data retained 90 days post-deletion

### Data Privacy (POPIA)

23. Analytics use pseudonymized analyticsId, never PII
24. Reconciliation anonymizes customer names from CSV data
25. Account deletion archives data before removal
26. Phone numbers stored in normalized South African format

---

## 17. External Integrations

### Configured Services

| Service | Purpose | Credentials |
|---|---|---|
| SMS Portal API | Send SMS (invites, OTPs, resets) | SMS_CLIENT_ID, SMS_API_SECRET |
| Bird (MessageBird) | Send emails (resets, deletion) | BIRD_API_KEY, BIRD_WORKSPACE_ID, BIRD_EMAIL_CHANNEL_ID |
| Cloudflare Turnstile | Captcha verification | TURNSTILE_SECRET_KEY, VITE_TURNSTILE_SITE_KEY |
| FTP Server | Automated CSV import | FTP_HOST, FTP_USERNAME, FTP_PASSWORD, FTP_PATH |
| Replit Object Storage | Logo and file uploads | DEFAULT_OBJECT_STORAGE_BUCKET_ID |
| PostgreSQL (Neon) | Primary database | DATABASE_URL |

### FTP Integration Details

- Protocol: FTP (port 21, non-secure)
- Per-restaurant paths configured via `ftpPath` field
- Files detected by `.csv` extension
- Duplicate prevention via filename tracking (`ftp-` prefix)
- Scheduled daily at 06:35 UTC

---

*Last updated: February 2026*
