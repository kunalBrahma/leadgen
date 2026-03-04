# Backend Boilerplate

![Node](https://img.shields.io/badge/node-%3E=18-green)
![TypeScript](https://img.shields.io/badge/typescript-5.x-blue)
![Prisma](https://img.shields.io/badge/prisma-postgresql-brightgreen)

A production-ready Node.js backend boilerplate built with Express, TypeScript, Prisma, and JWT authentication.

## Features

- ✅ **Express.js** - Fast, unopinionated web framework
- ✅ **TypeScript** - Type-safe JavaScript
- ✅ **Prisma ORM** - Modern database toolkit with PostgreSQL
- ✅ **JWT Authentication** - Secure token-based authentication
- ✅ **Password Hashing** - Bcrypt for secure password storage
- ✅ **CORS Support** - Configurable cross-origin resource sharing
- ✅ **Environment Variables** - Secure configuration management
- ✅ **Hot Reload** - Development server with auto-reload

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **PostgreSQL** (v12 or higher) - [Download](https://www.postgresql.org/download/)
- **Git** - [Download](https://git-scm.com/downloads)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/kunalBrahma/backend-boilerplate.git
cd backend-boilerplate
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
PORT=3000
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
CORS_ORIGIN=*
```

### 4. Set up the database

Create a PostgreSQL database:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE database_name;

# Exit
\q
```

### 5. Run database migrations

```bash
npm run migrate
```

This will:
- Create the database schema
- Run all pending migrations
- Generate Prisma Client

### 6. Start the development server

```bash
npm run dev
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

## Project Structure

```
backend-boilerplate/
├── src/
│   ├── config/
│   │   └── prisma.ts          # Prisma Client configuration
│   ├── controllers/
│   │   ├── auth.controller.ts # Authentication controllers
│   │   └── user.controller.ts # User controllers
│   ├── middleware/
│   │   └── auth.middleware.ts # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.routes.ts     # Authentication routes
│   │   └── user.routes.ts     # User routes
│   ├── utils/
│   │   ├── jwt.ts             # JWT token utilities
│   │   └── password.ts        # Password hashing utilities
│   └── server.ts              # Application entry point
├── prisma/
│   ├── migrations/            # Database migrations
│   └── schema.prisma          # Prisma schema definition
├── dist/                      # Compiled JavaScript (generated)
├── .env                       # Environment variables (not in git)
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
├── package.json               # Project dependencies
├── prisma.config.ts           # Prisma configuration
└── tsconfig.json              # TypeScript configuration
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the project (compile TypeScript to JavaScript)
- `npm start` - Start production server (requires build first)
- `npm run migrate` - Run database migrations
- `npm run generate` - Generate Prisma Client
- `npm run prisma` - Run Prisma CLI

## API Documentation

### Base URL

```
http://localhost:3000/api
```

### Authentication Endpoints

#### Register User

Create a new user account.

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2025-01-05T..."
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Login

Authenticate and get access token.

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2025-01-05T..."
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Get Current User

Get authenticated user's information.

**Endpoint:** `GET /api/auth/me`

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2025-01-05T...",
    "updatedAt": "2025-01-05T..."
  }
}
```

### User Endpoints

#### Get All Users

Get list of all users (requires authentication).

**Endpoint:** `GET /api/users`

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2025-01-05T...",
    "updatedAt": "2025-01-05T..."
  }
]
```

## Authentication

This API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header for protected routes:

```
Authorization: Bearer <your-token-here>
```

Tokens expire after 7 days by default (configurable via `JWT_EXPIRES_IN` in `.env`).

## CORS Configuration

CORS is configured to allow cross-origin requests. Configure allowed origins in your `.env` file:

- **Development:** Set `CORS_ORIGIN=*` to allow all origins
- **Production:** Set `CORS_ORIGIN=https://yourdomain.com` to restrict to specific domains

For multiple origins:
```
CORS_ORIGIN=https://app.example.com,https://admin.example.com
```

## Dependencies

### Production Dependencies

- `@prisma/adapter-pg` - Prisma PostgreSQL adapter
- `@prisma/client` - Prisma Client for database access
- `bcryptjs` - Password hashing
- `cors` - CORS middleware
- `dotenv` - Environment variable management
- `express` - Web framework
- `jsonwebtoken` - JWT token generation and verification
- `pg` - PostgreSQL client

### Development Dependencies

- `@types/bcryptjs` - TypeScript types for bcryptjs
- `@types/cors` - TypeScript types for cors
- `@types/express` - TypeScript types for express
- `@types/jsonwebtoken` - TypeScript types for jsonwebtoken
- `@types/node` - TypeScript types for Node.js
- `@types/pg` - TypeScript types for pg
- `prisma` - Prisma CLI
- `ts-node-dev` - TypeScript development server with hot reload
- `typescript` - TypeScript compiler

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3000` | No |
| `DATABASE_URL` | PostgreSQL connection string | - | Yes |
| `JWT_SECRET` | Secret key for JWT tokens | - | Yes |
| `JWT_EXPIRES_IN` | JWT token expiration time | `7d` | No |
| `CORS_ORIGIN` | Allowed CORS origins | `*` | No |

## Database Schema

### User Model

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Production Deployment

### 1. Build the project

```bash
npm run build
```

### 2. Set production environment variables

Ensure your `.env` file has production values:
- Strong `JWT_SECRET`
- Production `DATABASE_URL`
- Restricted `CORS_ORIGIN`

### 3. Run migrations

```bash
npm run migrate
```

### 4. Start the server

```bash
npm start
```

## Troubleshooting

### Port Already in Use

If you get an error that port 3000 is already in use:

1. Change the `PORT` in your `.env` file
2. Or kill the process using the port:
   ```bash
   # Find process
   lsof -ti:3000
   
   # Kill process
   kill -9 <PID>
   ```

### Database Connection Error

- Verify PostgreSQL is running
- Check `DATABASE_URL` in `.env` is correct
- Ensure the database exists
- Verify user credentials

### Prisma Client Not Generated

If you see errors about Prisma Client:

```bash
npm run generate
```

### Migration Issues

If migrations fail:

```bash
# Check migration status
npx prisma migrate status

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### JWT Token Errors

- Ensure `JWT_SECRET` is set in `.env`
- Verify token is included in `Authorization` header
- Check token hasn't expired
- Ensure header format: `Bearer <token>`

## Testing with Postman

### 1. Register a User

```
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123",
  "name": "Test User"
}
```

### 2. Login

```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

### 3. Use Protected Routes

```
GET http://localhost:3000/api/users
Authorization: Bearer <your-token-here>
```

## License

MIT

## Author

Kunal Brahma

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

