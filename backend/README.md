# Real Estate System - Backend API

A robust backend RESTful API service for a Real Estate Management platform, built with **Node.js**, **Express.js**, **TypeScript**, **Prisma ORM**, and **PostgreSQL**.

---

## 🚀 Features

- **User Authentication**: Secure registration, login, and JWT-based authentication with encrypted passwords (`bcryptjs`).
- **User Management**: Profile creation, updates, and user role management.
- **KYC Verification System**: Identity verification workflow with document upload support (National ID, Passport, Citizenship, Driver's License) and status management (Pending, Approved, Rejected).
- **Property & Seller Management**: Modules for managing property listings, seller statistics, and purchase requests.
- **Media Storage**: Static file uploads handling via `Multer`.

---

## 🛠️ Tech Stack

- **Runtime Environment**: [Node.js](https://nodejs.org/) (v18+ recommended)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Web Framework**: [Express.js](https://expressjs.com/) (v5)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Prisma](https://www.prisma.io/) (v6)
- **Authentication**: JSON Web Tokens (`jsonwebtoken`) & `bcryptjs`
- **File Uploads**: `multer`

---

## 📋 Prerequisites

Before setting up the project, ensure you have the following installed on your local machine:

- **Node.js** (v18.x or higher)
- **npm** (v9.x or higher) or **yarn** / **pnpm**
- **PostgreSQL** database server running locally or accessible remotely (or via Docker)

---

## ⚙️ Installation & Setup Guide

Follow these steps to get the project up and running on your local machine:

### 1. Clone the Repository

```bash
git clone <repository-url>
cd real-estate-system
```

### 2. Install Dependencies

Install the project dependencies using npm:

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory by copying the `.env.example` template:

```bash
cp .env.example .env
```

Open `.env` and configure your environment variables:

```env
# Server Port
PORT=4000

# PostgreSQL Connection String
DATABASE_URL="postgresql://<USERNAME>:<PASSWORD>@localhost:5432/<DATABASE_NAME>?schema=public"

# JWT Secret Key
JWT_SECRET="your_jwt_secret_key_here"
```

> **Note**: Replace `<USERNAME>`, `<PASSWORD>`, and `<DATABASE_NAME>` with your actual PostgreSQL credentials.

### 4. Database Setup & Prisma Migrations

Ensure your PostgreSQL database service is running, then execute the following Prisma commands to generate the client and apply database migrations:

```bash
# Generate Prisma Client
npx prisma generate

# Run Database Migrations (Applies schema to database)
npx prisma migrate dev --name init
```

*Alternatively, if working with an existing database schema:*

```bash
npx prisma db push
```

---

## 🏃 Running the Application

### Development Mode

To start the development server with hot reload (using `tsx watch`):

```bash
npm run dev
```

The server will start at `http://localhost:4000` (or the port specified in your `.env` file).

### Production Mode

To build and run the application in production:

```bash
# 1. Compile TypeScript to JavaScript (dist folder)
npm run build

# 2. Start the compiled JavaScript server
npm start
```

---

## 📂 Project Structure

```text
real-estate-system/
├── prisma/
│   ├── migrations/      # Database migration history
│   └── schema.prisma    # Prisma database schema definition
├── src/
│   ├── app.ts           # Express app setup & middleware
│   ├── server.ts        # Server entry point
│   ├── config/          # Environment & app configurations
│   ├── middleware/      # Custom middleware (auth, upload, etc.)
│   ├── modules/         # Feature modules
│   │   ├── admin/       # Admin functionality
│   │   ├── auth/        # Authentication routes & controllers
│   │   ├── kyc/         # KYC upload & verification logic
│   │   ├── properties/  # Property management
│   │   ├── purchase-requests/
│   │   ├── seller-stats/# Seller metrics & statistics
│   │   └── users/       # User profile routes
│   ├── types/           # Custom TypeScript type declarations
│   └── utils/           # Utility functions & helpers
├── uploads/             # Static directory for uploaded files/documents
├── .env                 # Local environment configuration (git-ignored)
├── .env.example         # Environment variable template
├── package.json         # Dependencies and npm scripts
├── tsconfig.json        # TypeScript compiler options
└── README.md            # Setup guide and documentation
```

---

## 🔌 API Endpoints Summary

| Base Route | Description |
| :--- | :--- |
| `POST /api/auth/register` | User Registration |
| `POST /api/auth/login` | User Authentication / Login |
| `GET /api/users/profile` | Get logged-in user profile |
| `POST /api/kyc/apply` | Submit KYC identity verification application |
| `GET /api/kyc/status` | Check KYC status |
| `GET /uploads/*` | Static file access for uploaded documents/images |

---

## 🛠️ Useful Prisma Commands

- **Prisma Studio** (Visual GUI to view and manage database records):
  ```bash
  npx prisma studio
  ```
- **Reset Database**:
  ```bash
  npx prisma migrate reset
  ```
- **Format Schema**:
  ```bash
  npx prisma format
  ```

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).
