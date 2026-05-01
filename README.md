# Rawaj Platform

Centralized Digital Invitation & QR Verification Platform

## Project Structure

```
rawaj/
├── apps/
│   ├── admin/          # React Admin Dashboard
│   └── api/            # Node.js REST API
├── packages/           # Shared packages (future)
└── README.md
```

## Prerequisites

- Node.js 18+
- MySQL 8+
- npm 9+

## Quick Start

### 1. Install Dependencies

```bash
# Root
npm install

# Admin
cd apps/admin && npm install

# API
cd apps/api && npm install
```

### 2. Configure Environment

```bash
# Copy environment templates
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env

# Edit .env files with your MySQL credentials
```

### 3. Setup Database

```bash
cd apps/api
npm run migrate
npm run seed
```

### 4. Run Applications

```bash
# Terminal 1: API (port 3001)
cd apps/api && npm run dev

# Terminal 2: Admin (port 5173)
cd apps/admin && npm run dev
```

## Default Super Admin

- Email: `admin@rawaj.com`
- Password: `Admin@123`

## Tech Stack

| Layer | Technology |
|-------|------------|
| Admin Frontend | React 18, React Router 6, react-i18next |
| API Backend | Node.js, Express, MySQL2 |
| Database | MySQL 8 |
| Auth | JWT (access + refresh tokens) |
| Languages | Arabic (RTL), English (LTR) |
