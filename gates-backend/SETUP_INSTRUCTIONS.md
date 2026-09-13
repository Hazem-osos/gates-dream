# Setup Instructions for Gates Backend

## Prerequisites

Before starting, ensure you have:
1. **Node.js 20+** installed (download from https://nodejs.org/)
2. **MySQL 8.0+** installed (or Docker for containerized setup)
3. **npm** (comes with Node.js)

Verify installation:
```bash
node --version   # Should show v20.x.x or higher
npm --version    # Should show 10.x.x or higher
```

## Initial Setup

### 1. Install Dependencies

```bash
cd gates-backend
npm install
```

This will install all dependencies from `package.json`:
- Express, TypeScript, Prisma
- Zod, Pino, Helmet
- Development tools (nodemon, ts-node, etc.)

### 2. Set Up MySQL Database

**Option A: Using Docker (Recommended for Development)**

```bash
docker run --name mysql-gates \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=gates_erp \
  -e MYSQL_USER=gates_user \
  -e MYSQL_PASSWORD=password \
  -p 3306:3306 \
  -d mysql:8.0
```

**Option B: Local MySQL Installation**

1. Install MySQL 8.0+ locally
2. Create database:
   ```sql
   CREATE DATABASE gates_erp;
   CREATE USER 'gates_user'@'localhost' IDENTIFIED BY 'password';
   GRANT ALL PRIVILEGES ON gates_erp.* TO 'gates_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL="mysql://gates_user:password@localhost:3306/gates_erp"

# Server
PORT=3001
NODE_ENV=development

# Logging
LOG_LEVEL=info

# Security (for future use)
JWT_SECRET=your-secret-key-here
```

**Important:** Update the `DATABASE_URL` with your actual MySQL credentials.

### 4. Set Up Database Schema

Run Prisma migrations to create the database tables:

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations (creates tables)
npm run prisma:migrate
```

This will:
- Create the database schema based on `prisma/schema.prisma`
- Generate the Prisma Client for type-safe database access

### 5. Verify Database Connection

You can open Prisma Studio to view your database:

```bash
npm run prisma:studio
```

This opens a web interface at `http://localhost:5555` where you can browse your database.

## Running the Development Server

### Start Development Server

```bash
npm run dev
```

The server will:
- Start on `http://localhost:3001` (or port specified in `.env`)
- Watch for file changes and auto-restart (nodemon)
- Use TypeScript directly (ts-node)

### Verify Server is Running

Open your browser or use curl:

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-XX...",
  "uptime": 1.23
}
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run start` | Start production server (after build) |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:studio` | Open Prisma Studio (database GUI) |
| `npm run lint` | Lint code with ESLint |
| `npm run type-check` | Type check without building |

## Project Structure

```
gates-backend/
├── src/
│   ├── index.ts              # Entry point
│   ├── app.ts                # Express app configuration
│   ├── modules/              # Domain modules (DDD)
│   │   ├── accounting/
│   │   ├── inventory/        # Example module
│   │   ├── hr/
│   │   └── common/           # Shared utilities
│   ├── shared/               # Shared infrastructure
│   │   ├── database/         # Prisma client
│   │   ├── middleware/       # Express middleware
│   │   └── logger/           # Logging
│   └── workers/              # Background jobs (future)
├── prisma/
│   └── schema.prisma         # Database schema
└── package.json
```

## Testing the Setup

### 1. Health Check Endpoint

```bash
curl http://localhost:3001/health
```

### 2. Inventory Items Endpoint (Example)

```bash
# List items (will return placeholder for now)
curl http://localhost:3001/api/v1/inventory/items

# Create item (will return placeholder for now)
curl -X POST http://localhost:3001/api/v1/inventory/items \
  -H "Content-Type: application/json" \
  -d '{
    "serialNumber": "INV-001",
    "arabicName": "صنف تجريبي",
    "englishName": "Test Item"
  }'
```

## Troubleshooting

### Database Connection Issues

1. **Check MySQL is running:**
   ```bash
   # Docker
   docker ps | grep mysql
   
   # Local
   mysqladmin ping -h localhost -u root -p
   ```

2. **Verify DATABASE_URL in `.env`:**
   - Format: `mysql://user:password@host:port/database`
   - Test connection: `mysql -u gates_user -p -h localhost gates_erp`

### Port Already in Use

If port 3001 is already in use:
1. Change `PORT` in `.env` file
2. Or kill the process using port 3001:
   ```bash
   lsof -ti:3001 | xargs kill -9
   ```

### TypeScript Errors

1. Run type checking:
   ```bash
   npm run type-check
   ```

2. Ensure all dependencies are installed:
   ```bash
   npm install
   ```

## Next Steps

Once the server is running successfully:

1. ✅ **Phase 1 Complete:** Architecture foundation is in place
2. **Proceed to Phase 2:** Enterprise Security (AuthN, AuthZ, Data Isolation)
   - Set up Keycloak for authentication
   - Implement fine-grained permissions
   - Configure application-level tenant isolation (MySQL-compatible)

## Support

If you encounter issues:
1. Check the logs in the console output
2. Verify all prerequisites are installed
3. Ensure `.env` file is configured correctly
4. Check that MySQL is running and accessible

---

**Phase 1 is complete!** The backend foundation is ready for development. 🎉
