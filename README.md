# FlatMate Ledger — Shared Expense Splitter SaaS

FlatMate Ledger is a responsive, feature-rich React + TypeScript + Express + Prisma SaaS dashboard application designed to let flatmates record expenses, divide bills using multiple splitting models (Equal, Exact, and Percentage shares), track settlements, generate UPI payment QR codes, and monitor household metrics.

## 🚀 Key Features

* **SaaS Dashboard & Analytics**: High-quality dashboard featuring monthly spending trends, category distributions, roommate contribution bar charts, highest spender stats, and reports.
* **Smart Bill Splitting**: Add expenses with splits calculated equally, by exact dollar amounts, or by percentage shares. Supports receipt uploads.
* **Automated Recurring Expenses**: Set recurring bills (Rent, Internet, Gas) that automatically post expenses to the ledger on their due date.
* **Ledger Approvals Workflow**: Roommates approve or reject pending expenses to ensure split integrity.
* **UPI QR Code Settle Up**: Record payments instantly. Generates dynamic UPI payment QR codes.
* **Household Management**: Add, remove, update members, transfer household ownership, and trace comprehensive activity audit logs.
* **Sleek Light & Dark Themes**: Fully responsive, clean layout styled with Tailwind CSS, Lucide icons, skeleton loaders, and interactive transitions.
* **Report Exporter**: Generate and download detailed PDF summaries and Excel ledger spreadsheets.

---

## 🏗️ Architecture & Project Structure

The project uses a client-server architecture split into two main packages:

```
Project-2/
├── backend/                  # Node.js + Express REST API Server
│   ├── prisma/               # Database schemas, migrations, and seeds
│   │   ├── schema.prisma     # Prisma database schema definition
│   │   └── seed.ts           # Seeding category lists
│   ├── src/
│   │   ├── controllers/      # Route controllers (express endpoint handles)
│   │   ├── middleware/       # JWT auth, validator wrapper, multer file upload
│   │   ├── routes/           # Routing groups (auth, expenses, households, etc.)
│   │   ├── services/         # Core business logic handlers
│   │   ├── utils/            # UPI QR builders, Excel / PDF generators
│   │   ├── validators/       # Zod endpoint schemas
│   │   └── server.ts         # Server startup script
│   └── package.json
│
└── frontend/                 # Vite + React Client
    ├── src/
    │   ├── assets/           # Static logos and icons
    │   ├── components/       # Reusable layout shell, modals, routes protection
    │   ├── context/          # Global Auth, Theme, and Toast notifications state
    │   ├── pages/            # View pages (Dashboard, Ledger, Balances, Settings)
    │   ├── utils/            # Axios API config, custom TanStack Query hooks
    │   ├── App.tsx           # Router endpoints map
    │   └── main.tsx          # Application mount entrypoint
    └── package.json
```

---

## 🗄️ Database Schema (ER Diagram)

Below is the visual map of database entities and relationships managed by Prisma ORM:

```mermaid
erDiagram
    User ||--o{ Member : joined
    User ||--o{ Household : owns
    User ||--o{ Expense : paid
    User ||--o{ ExpenseParticipant : owes
    User ||--o{ Settlement : settles
    User ||--o{ Notification : receives
    User ||--o{ ActivityLog : logs
    
    Household ||--o{ Member : contains
    Household ||--o{ Expense : tracks
    Household ||--o{ Settlement : lists
    Household ||--o{ Invite : issues
    Household ||--o{ RecurringExpense : schedules
    Household ||--o{ ActivityLog : logs
    
    Category ||--o{ Expense : classifies
    Category ||--o{ RecurringExpense : classifies
    
    Expense ||--o{ ExpenseParticipant : splits
    Expense ||--o{ ExpenseApproval : requires
    RecurringExpense ||--o{ Expense : spawns

    User {
        Int id PK
        String email UK
        String name
        String passwordHash
        String avatar
        DateTime createdAt
    }
    Household {
        Int id PK
        String name
        String inviteCode UK
        Int ownerId FK
        DateTime createdAt
    }
    Member {
        Int id PK
        Int userId FK
        Int householdId FK
        Enum role
        Enum status
        DateTime joinedAt
    }
    Expense {
        Int id PK
        String title
        Float amount
        Int categoryId FK
        Int paidById FK
        Int householdId FK
        String receiptUrl
        Enum status
        DateTime date
    }
    ExpenseParticipant {
        Int id PK
        Int expenseId FK
        Int userId FK
        Float amountOwed
        Float sharePercentage
        Float shareAmount
    }
    Settlement {
        Int id PK
        Int householdId FK
        Int fromUserId FK
        Int toUserId FK
        Float amount
        Enum status
        DateTime date
    }
    RecurringExpense {
        Int id PK
        Int householdId FK
        String title
        Float amount
        Int categoryId FK
        Int paidById FK
        Enum interval
        DateTime nextDueDate
    }
```

---

## 🔌 API Documentation

All routes are prefixed by `/api`. Authenticated endpoints require a standard Bearer JWT token in the `Authorization` header.

### Authentication (`/auth`)
* `POST /auth/register` - Create user account (body: `name, email, password`).
* `POST /auth/login` - Authenticate user (body: `email, password`). Sets secure cookie refresh token.
* `POST /auth/refresh` - Generate new access token using refresh token.
* `POST /auth/logout` - Clear cookies and invalidate token.
* `POST /auth/forgot-password` - Request verification code (body: `email`).
* `POST /auth/reset-password` - Reset password (body: `email, code, passwordNew`).
* `GET /auth/profile` - Retrieve current user profile.
* `PUT /auth/profile` - Update display details or change password.

### Households (`/households`)
* `POST /households` - Create a new household (body: `name`).
* `GET /households` - Retrieve households current user is active in.
* `GET /households/:householdId` - Get members list, owner details, and invite code.
* `POST /households/join` - Join group (body: `code`). Matches invite code.
* `POST /households/:householdId/invite` - Send member invitation (body: `email`).
* `PUT /households/:householdId/members/:userId/role` - Switch member role / transfer ownership.
* `DELETE /households/:householdId/members/:userId` - Kick member.
* `DELETE /households/:householdId` - Delete household (Owner only).

### Expenses & Bills (`/expenses`)
* `POST /expenses/:householdId` - Create expense (Multipart form-data: title, amount, categoryId, splits, date, splitType, and optional receipt file).
* `GET /expenses/list/:householdId` - Paginated filter list of expenses (query: `search, categoryId, status, page, limit`).
* `GET /expenses/details/:expenseId` - Detailed split figures, receipt URLs, and roommate approvals.
* `PUT /expenses/:expenseId` - Edit expense details.
* `DELETE /expenses/:expenseId` - Remove expense.
* `POST /expenses/approve/:expenseId` - Approve split expense.
* `POST /expenses/reject/:expenseId` - Reject split expense.
* `POST /expenses/recurring/:householdId` - Set up automated recurring bill (body: `title, amount, categoryId, interval, startDate`).
* `GET /expenses/recurring/list/:householdId` - List recurring schedules.
* `DELETE /expenses/recurring/:ruleId` - Delete recurring bill schedule.

### Settlements (`/settlements`)
* `GET /settlements/balances/:householdId` - Retrieve net balance sheet of flatmates.
* `GET /settlements/suggestions/:householdId` - Retrieve optimized transactions suggestion list.
* `POST /settlements/record/:householdId` - Log settlement (body: `fromUserId, toUserId, amount, date`).
* `GET /settlements/upi/qrcode` - Fetch payment QR image (query: `upiId, payeeName, amount`).

### Analytics & Exports (`/analytics`)
* `GET /analytics/dashboard/:householdId` - Fetch KPI metrics, spending trends, category weights, and audit activity feeds.
* `GET /analytics/export/:householdId` - Download detailed spreadsheet or PDF reports (query: `format: 'pdf' | 'excel'`).

---

## 🛠️ Installation & Setup

### Requirements
* Node.js v18+
* MySQL Database Server

### 1. Backend Setup
1. Enter the `backend/` directory:
   ```bash
   cd backend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Configure the environment variables in `.env`:
   ```env
   PORT=5000
   DATABASE_URL="mysql://username:password@localhost:3306/flatmate_ledger"
   JWT_SECRET="your_jwt_access_secret_key"
   JWT_REFRESH_SECRET="your_jwt_refresh_secret_key"
   NODE_ENV="development"
   FRONTEND_URL="http://localhost:5173"
   ```
4. Push the Prisma database schema and run the category database seed script:
   ```bash
   npx prisma db push
   npm run seed
   ```
5. Spin up the Express development server:
   ```bash
   npm run dev
   ```

### 2. Frontend Setup
1. Enter the `frontend/` directory:
   ```bash
   cd ../frontend
   ```
2. Install client dependencies:
   ```bash
   npm install
   ```
3. Start the Vite React development server:
   ```bash
   npm run dev
   ```
4. Open the browser link [http://localhost:5173](http://localhost:5173) to run the application.

---

## 🚀 Production Deployment Instructions

1. **Backend Build**:
   Build the Express server bundle by compiling TypeScript to javascript:
   ```bash
   cd backend
   npm run build
   ```
   Start the production server using `node dist/server.js`. Run with process managers like `pm2` for continuous active background hosting.

2. **Frontend Build**:
   Build the production assets:
   ```bash
   cd frontend
   npm run build
   ```
   Deploy the generated static folder `dist/` to hosts like Vercel, Netlify, or serve directly via Nginx.
