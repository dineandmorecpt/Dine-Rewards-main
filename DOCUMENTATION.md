# Dine&More - Restaurant Loyalty Rewards Platform

## Complete Portal Documentation

**Version:** 1.0  
**Last Updated:** January 2026

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [User Types & Roles](#user-types--roles)
3. [Authentication & Security](#authentication--security)
4. [Diner Portal Features](#diner-portal-features)
5. [Restaurant Admin Portal Features](#restaurant-admin-portal-features)
6. [Loyalty Program Configuration](#loyalty-program-configuration)
7. [Voucher System](#voucher-system)
8. [Multi-Branch Architecture](#multi-branch-architecture)
9. [Transaction Processing](#transaction-processing)
10. [Reconciliation System](#reconciliation-system)
11. [Staff Management](#staff-management)
12. [Analytics & Reporting](#analytics--reporting)
13. [SMS Integration](#sms-integration)
14. [Data Privacy & Compliance](#data-privacy--compliance)
15. [API Reference](#api-reference)

---

## Platform Overview

Dine&More is a premium restaurant loyalty rewards platform that connects restaurants with their customers through a sophisticated points and voucher-based rewards system. The platform serves two primary user types:

- **Restaurant Administrators**: Manage loyalty programs, view analytics, handle voucher redemptions, and configure rewards for their establishments
- **Diners**: Earn points through spending, track balances across multiple restaurants, select and redeem vouchers

### Key Features

- Multi-restaurant support with organization-level or branch-specific loyalty tracking
- Flexible voucher earning modes (points-based or visits-based per voucher type)
- SMS-based registration and authentication
- Real-time voucher presentation with QR code scanning
- Comprehensive reconciliation tools for financial tracking
- Role-based access control for restaurant staff
- POPIA-compliant analytics with pseudonymized user data

---

## User Types & Roles

### Diners
Regular customers who:
- Register via SMS invitation or self-registration
- Earn points/visits at participating restaurants
- Select and redeem vouchers
- View transaction history and balances

### Restaurant Administrators

#### Owner
- Full access to all features
- Can add/remove staff members
- Configure all loyalty settings
- Access all branches

#### Manager
- Access to most admin features
- Cannot manage staff
- May have branch-specific access

#### Staff
- Basic operational access
- Can record transactions and redeem vouchers
- Limited to assigned branches

---

## Authentication & Security

### Login Methods

#### Email/Password Login
Standard authentication for both diners and restaurant admins.

#### SMS-Based Registration
Diners receive an SMS invitation with a registration link that:
1. Contains a unique token
2. Expires after a set period
3. Links the diner to the inviting restaurant

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Password Reset
Two methods available:
1. **Email Reset**: Sends a reset link valid for 1 hour
2. **SMS Reset** (Diners): Sends a reset link via SMS

### Phone Number Change Verification
Phone numbers are unique identifiers. To change:
1. User requests change with new phone number
2. 6-digit OTP sent to new phone (10-minute expiry)
3. User enters OTP to verify
4. Maximum 5 verification attempts

### Rate Limiting
- Authentication endpoints: 100 requests/second
- SMS endpoints: 5 requests/minute per IP

### Session Management
- Sessions stored in PostgreSQL
- Automatic session expiry
- Secure cookie-based authentication

---

## Diner Portal Features

### Dashboard (`/diner/dashboard`)
Displays:
- Points balances across all restaurants
- Available voucher credits (points-based and visits-based)
- Active vouchers with status
- Quick actions for voucher selection

### Points & Progress Tracking
For each restaurant membership:
- Current points balance
- Progress toward next voucher credit
- Current visits count
- Total visits and points earned

### Voucher Management
Diners can:
- View available voucher types at each restaurant
- Select a voucher type to generate
- Present voucher codes to staff (15-minute validity)
- View voucher history and status

### Voucher States
- **Active**: Available for redemption
- **Redeemed**: Already used
- **Expired**: Past expiry date

### Transaction History (`/diner/history`)
Complete record of:
- Earning transactions (amount, points, restaurant)
- Voucher redemptions
- Date and time stamps

### Profile Management (`/diner/profile`)
Editable fields:
- Name and surname
- Email address
- Phone number (requires OTP verification)

### Account Deletion
Two-step confirmation:
1. Request deletion (triggers confirmation email)
2. Click email link within 24 hours
3. Data archived for 90 days before permanent deletion

---

## Restaurant Admin Portal Features

### Dashboard (`/admin/dashboard`)
Overview including:
- Key statistics (active diners, transactions, vouchers)
- Recent activity feed
- Quick action buttons
- Performance charts

### Voucher Management (`/admin/vouchers`)

#### Voucher Types Tab
Create and manage voucher templates:

**Voucher Categories:**
1. **Rand Value** (`rand_value`): Fixed monetary discount (e.g., R100 off)
2. **Percentage** (`percentage`): Percentage discount (e.g., 20% off)
3. **Free Item** (`free_item`): Complimentary item
   - Sub-types: Beverage, Starter, Main, Dessert, Side, Other
4. **Registration** (`registration`): One-time welcome voucher for new diners

**Voucher Configuration:**
- Name and description
- Earning mode (points or visits)
- Credits cost (how many credits to redeem)
- Points per currency override (custom earning rate)
- Validity period (days)
- Redemption scope (all branches or specific branches)

#### Redeem Tab
Staff can redeem vouchers by:
- Entering voucher code manually
- Scanning QR code with camera
- Linking to bill ID for reconciliation

#### Reconciliation Tab
Upload CSV files to match redeemed vouchers with POS transactions.

### User Management (`/admin/users`)
View all registered diners:
- Name and contact information
- Points balance and credits
- Voucher count
- Last visit date
- Registration date

Search and filter capabilities.

### Staff Management (`/admin/users` - Staff Tab)
Owners can:
- Add new staff members
- Assign roles (Manager or Staff)
- Configure branch access
- Remove staff members

### Settings (`/admin/settings`)

#### Loyalty Settings
- Points per currency (default earning rate)
- Points threshold (credits from points)
- Visit threshold (credits from visits)
- Loyalty scope (organization or branch)
- Voucher scope (organization or branch)

#### General Settings
- Voucher validity days
- Restaurant configuration

### Business Profile (`/admin/profile`)
Comprehensive business information:

**Business Details:**
- Legal name and trading name
- Description
- Cuisine type
- Registration and VAT numbers

**Address:**
- Street address, city, province, postal code, country

**Contact:**
- Contact person name, email, phone
- Business hours

**Online Presence:**
- Website URL
- Facebook, Instagram, Twitter links
- Logo upload

### Activity Logs (`/admin/activity-logs`)
Audit trail of:
- Voucher redemptions
- Settings changes
- Profile updates
- Staff actions
- Transaction recordings

### Branch Management
For multi-branch restaurants:
- Add/edit branches
- Set default branch
- Configure branch-specific settings
- Assign staff to branches

---

## Loyalty Program Configuration

### Earning Modes (Per Voucher Type)

Each voucher type specifies whether it is earned through points or visits.

#### Points-Based Earning
- Points earned per currency spent (configurable rate)
- Voucher type can override the default rate with `pointsPerCurrencyOverride`
- When points reach threshold, credit is earned
- Points reset to 0 after earning a credit

#### Visits-Based Earning
- Each transaction counts as 1 visit
- When visits reach threshold, credit is earned
- Visits reset to 0 after earning a credit
- Ideal for "Buy X, get 1 free" programs

### Simultaneous Tracking
The system tracks BOTH points and visits simultaneously:
- `currentPoints` / `totalPointsEarned` for spending-based rewards
- `currentVisits` / `totalVisits` for frequency-based rewards
- `pointsCredits` for credits earned from points
- `visitCredits` for credits earned from visits

Diners choose voucher types based on whether they want to spend points-credits or visit-credits.

### Loyalty Scope

#### Organization-Wide (`loyaltyScope: 'organization'`)
- Points/visits earned at any branch count toward the same balance
- Diners have one balance per restaurant
- Default mode

#### Branch-Specific (`loyaltyScope: 'branch'`)
- Each branch tracks separate points/visits balances
- Diners have different balances per branch

### Voucher Scope

#### Organization-Wide (`voucherScope: 'organization'`)
- Vouchers can be redeemed at any branch
- Default mode

#### Branch-Specific (`voucherScope: 'branch'`)
- Vouchers can only be redeemed at the issuing branch

---

## Voucher System

### Voucher Lifecycle

1. **Credit Earned**: Diner accumulates enough points or visits
2. **Voucher Selection**: Diner selects a voucher type to claim
3. **Voucher Generated**: System creates voucher with unique code and expiry
4. **Presentation**: Diner "presents" voucher (activates code for 15 minutes)
5. **Redemption**: Staff redeems voucher using code

### Voucher Presentation Flow

1. Diner taps on voucher in app
2. Voucher code is activated (stored on user record)
3. Code valid for 15 minutes
4. Staff enters code or scans QR
5. System validates and processes redemption

### Branch-Specific Redemption

Voucher types can be restricted to specific branches:
- `redemptionScope: 'all_branches'`: Redeem anywhere
- `redemptionScope: 'specific_branches'`: Only at designated branches

When attempting to redeem at an invalid branch, the system returns a clear error listing valid locations.

### Registration Vouchers

Special one-time vouchers for new diners:
- Issued once per diner per restaurant
- Tracked via `registration_voucher_status` table
- Automatically granted on first transaction

---

## Multi-Branch Architecture

### Hierarchy
```
Restaurant (Organization)
└── Branches (Physical Locations)
    ├── Branch 1 (Default)
    ├── Branch 2
    └── Branch 3
```

### Branch Properties
- `name`: Display name (e.g., "Sandton City")
- `address`: Physical location
- `phone`: Contact number
- `isDefault`: Primary branch flag
- `isActive`: Operational status

### Data Tracking by Branch

All operational data can be branch-aware:
- Transactions record `branchId`
- Vouchers record redemption `branchId`
- Reconciliation batches are branch-specific
- Activity logs include branch context

### Branch Switcher

Admin portal includes a branch selector for:
- Filtering data to specific branch
- Recording transactions at correct branch
- Managing branch-specific settings

---

## Transaction Processing

### Recording a Transaction

**Required Information:**
- Phone number (diner identification)
- Amount spent
- Optional: Bill ID (for reconciliation)
- Optional: Branch ID (required if branch-specific loyalty)

### Processing Flow

1. **Diner Lookup**: Find diner by phone number
2. **Points Calculation**: `amountSpent × pointsPerCurrency`
3. **Balance Update**: Add points to current balance
4. **Visit Increment**: Add 1 to current visits
5. **Credit Check**: Award credits if thresholds met
6. **Response**: Return updated balance and credits earned

### Points Per Currency Override

Voucher types can specify a custom points rate via `pointsPerCurrencyOverride`:
- `null`: Use restaurant default rate
- Number: Override with specific rate

This allows different voucher types to have different earning speeds.

---

## Reconciliation System

### Purpose
Match redeemed vouchers with POS transaction data for financial verification.

### CSV Upload Process

1. Admin uploads CSV file with transaction data
2. System creates `reconciliationBatch` record
3. Each row becomes a `reconciliationRecord`
4. System attempts to match records with redeemed vouchers

### Matching Logic
Matches on:
- Bill ID (primary match key)
- Amount (validation)
- Date (within reasonable range)

### Batch Status
- `pending`: Awaiting processing
- `processing`: Currently being matched
- `completed`: All records processed
- `failed`: Processing error occurred

### Report Generation
Download reconciliation reports showing:
- Matched vouchers
- Unmatched records
- Discrepancies

---

## Staff Management

### Portal Users

The `portal_users` table grants access to restaurant admin features:

```
User (restaurant_admin type)
└── Portal User Assignment
    ├── Role: owner | manager | staff
    ├── hasAllBranchAccess: boolean
    └── Branch Assignments (if not all access)
```

### Adding Staff

1. Owner enters staff email
2. If user exists, portal access is granted
3. If not, invitation is sent
4. Role and branch access are assigned

### Branch Access Control

Staff can be restricted to specific branches via `portal_user_branches` table:
- `hasAllBranchAccess: true` = access to all branches
- `hasAllBranchAccess: false` = only assigned branches

### Role Permissions

| Feature | Owner | Manager | Staff |
|---------|-------|---------|-------|
| Record Transactions | ✓ | ✓ | ✓ |
| Redeem Vouchers | ✓ | ✓ | ✓ |
| View Users | ✓ | ✓ | ✓ |
| Manage Voucher Types | ✓ | ✓ | - |
| Upload Reconciliation | ✓ | ✓ | - |
| Manage Settings | ✓ | ✓ | - |
| Manage Staff | ✓ | - | - |
| Manage Branches | ✓ | - | - |

---

## Analytics & Reporting

### Privacy-First Analytics

Each diner has an `analyticsId`:
- 12-character random base62 string
- Used for anonymous trend reporting
- No PII exposure in analytics

### Demographic Data Collected

At registration, diners provide:
- Gender (male, female, other, prefer not to say)
- Age range (18-29, 30-39, 40-49, 50-59, 60+)
- Province (South African provinces)

### Restaurant Analytics

Available metrics:
- Active diner count
- Transaction volume and value
- Voucher redemption rates
- Points/visits distribution
- Demographic breakdowns (anonymized)

### Dashboard Stats

Key performance indicators:
- Total diners
- Active diners (last 30 days)
- Total transactions
- Total vouchers issued/redeemed
- Points/visits earned

---

## SMS Integration

### Provider
SMS Portal API (rest.smsportal.com)

### Endpoints Used
- `POST /v1/BulkMessages` - Send SMS

### Authentication
Basic Auth with:
- `SMS_CLIENT_ID`
- `SMS_API_SECRET`

### SMS Types Sent

1. **Registration Invitation**
   - Contains unique registration link
   - Expires after set period
   - Links diner to inviting restaurant

2. **Phone Change OTP**
   - 6-digit verification code
   - 10-minute expiry
   - Required for phone number changes

3. **Password Reset**
   - Contains reset link
   - 1-hour expiry

---

## Data Privacy & Compliance

### POPIA Compliance

- Pseudonymized analytics IDs
- Consent tracking (terms and privacy acceptance timestamps)
- 90-day data retention for deleted accounts
- Clear data deletion process

### Data Retention

**Active Accounts:**
- All data retained while account active
- Access tokens valid for 90 days

**Deleted Accounts:**
- User data archived
- `retentionExpiresAt` set to 90 days
- Data eligible for permanent deletion after retention period

### Archived Data

The `archivedUsers` table stores:
- Original user ID
- Email, name, phone (for potential recovery)
- Original creation date
- Archive date
- Deletion reason (optional)
- Retention expiration date

---

## API Reference

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| GET | `/api/auth/me` | Get current session |
| POST | `/api/auth/logout` | End session |
| POST | `/api/auth/register-diner` | Self-register diner |
| POST | `/api/auth/forgot-password` | Request email reset |
| POST | `/api/auth/forgot-password-sms` | Request SMS reset |
| POST | `/api/auth/reset-password` | Set new password |
| GET | `/api/auth/validate-reset-token` | Check token validity |

### Registration Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/request-otp` | Request phone verification |
| POST | `/api/auth/verify-otp` | Verify phone OTP |
| GET | `/api/invitations/:token` | Get invitation details |
| POST | `/api/invitations/:token/register` | Complete registration |

### User Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| PATCH | `/api/users/:userId/profile` | Update profile |
| POST | `/api/phone-change/request` | Request phone change |
| POST | `/api/phone-change/verify` | Verify phone change |
| POST | `/api/account/request-deletion` | Request account deletion |
| POST | `/api/account/confirm-deletion` | Confirm deletion |

### Diner Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/diners/:dinerId/points` | Get all points balances |
| GET | `/api/diners/:dinerId/vouchers` | Get all vouchers |
| GET | `/api/diners/:dinerId/transactions` | Get all transactions |
| POST | `/api/diners/:dinerId/vouchers/:voucherId/select` | Present voucher |

### Restaurant Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/restaurants` | List all restaurants |
| GET | `/api/restaurants/:id` | Get restaurant details |
| PATCH | `/api/restaurants/:id/settings` | Update settings |
| PATCH | `/api/restaurants/:id/profile` | Update profile |
| PATCH | `/api/restaurants/:id/onboarding` | Update onboarding |
| POST | `/api/restaurants/:id/onboarding/submit` | Submit onboarding |

### Branch Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/restaurants/:id/branches` | List branches |
| POST | `/api/restaurants/:id/branches` | Create branch |
| PUT | `/api/restaurants/:id/branches/:branchId` | Update branch |
| DELETE | `/api/restaurants/:id/branches/:branchId` | Delete branch |

### Transaction Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/transactions` | Record transaction |
| POST | `/api/restaurants/:id/transaction` | Record with phone lookup |

### Voucher Type Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/restaurants/:id/voucher-types` | List voucher types |
| POST | `/api/restaurants/:id/voucher-types` | Create voucher type |
| PUT | `/api/restaurants/:id/voucher-types/:typeId` | Update voucher type |
| DELETE | `/api/restaurants/:id/voucher-types/:typeId` | Delete voucher type |

### Voucher Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/restaurants/:id/vouchers/redeem` | Redeem voucher |
| GET | `/api/restaurants/:id/vouchers/pending` | Get pending vouchers |
| GET | `/api/restaurants/:id/vouchers/redeemed` | Get redeemed vouchers |

### Staff Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/restaurants/:id/portal-users` | List staff |
| POST | `/api/restaurants/:id/portal-users` | Add staff |
| DELETE | `/api/restaurants/:id/portal-users/:userId` | Remove staff |

### Reconciliation Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/restaurants/:id/reconciliation/upload` | Upload CSV |
| GET | `/api/restaurants/:id/reconciliation/batches` | List batches |
| GET | `/api/restaurants/:id/reconciliation/batches/:batchId` | Get batch details |

### Activity Log Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/restaurants/:id/activity-logs` | Get activity logs |

---

## Database Schema Summary

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | All user accounts (diners and admins) |
| `restaurants` | Restaurant organizations |
| `branches` | Physical locations per restaurant |
| `points_balances` | Points/visits tracking per diner per restaurant |
| `transactions` | Earning transaction records |
| `voucher_types` | Voucher templates/configurations |
| `vouchers` | Generated voucher instances |

### Supporting Tables

| Table | Purpose |
|-------|---------|
| `portal_users` | Staff access grants |
| `portal_user_branches` | Branch assignments for staff |
| `diner_invitations` | SMS registration invites |
| `registration_voucher_status` | One-time voucher tracking |
| `reconciliation_batches` | CSV upload batches |
| `reconciliation_records` | Individual match records |
| `activity_logs` | Audit trail |
| `password_reset_tokens` | Password reset flow |
| `account_deletion_requests` | Account deletion flow |
| `archived_users` | Deleted user data retention |
| `phone_change_requests` | Phone change verification |

---

## Technical Stack

### Frontend
- React 18 with TypeScript
- Vite build tool
- Tailwind CSS with shadcn/ui components
- TanStack React Query for state management
- Wouter for routing

### Backend
- Express.js with TypeScript
- Drizzle ORM
- PostgreSQL database

### External Services
- SMS Portal API (SMS messaging)
- Bird API (Email messaging)
- Google Cloud Storage (Object storage)

---

## Support & Contact

For technical support or questions about the Dine&More platform, please contact the development team.

---

*This documentation is maintained as part of the Dine&More codebase and updated with each feature release.*
