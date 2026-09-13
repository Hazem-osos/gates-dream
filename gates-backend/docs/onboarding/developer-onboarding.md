# Developer Onboarding Guide

## Welcome to Gates ERP Development

This guide will help you get started with development on the Gates ERP system.

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)
- Git

## Initial Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd gates-web
```

### 2. Backend Setup

```bash
cd gates-backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# DATABASE_URL=postgresql://user:password@localhost:5432/gates_erp
# REDIS_URL=redis://localhost:6379

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database (optional)
npm run seed

# Start development server
npm run dev
```

### 3. Frontend Setup

```bash
cd gates-web

# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Docker Setup (Alternative)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend
```

## Project Structure

### Backend Structure

```
gates-backend/
├── src/
│   ├── modules/          # Domain modules (DDD)
│   │   ├── accounting/
│   │   ├── inventory/
│   │   ├── hr/
│   │   └── schools/
│   ├── shared/           # Shared infrastructure
│   │   ├── auth/
│   │   ├── cache/
│   │   ├── database/
│   │   ├── middleware/
│   │   └── monitoring/
│   └── workers/          # Background workers
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── migrations/       # Database migrations
└── tests/                 # Test files
```

### Frontend Structure

```
gates-web/
├── app/                   # Next.js app directory
│   ├── accounting/
│   ├── inventory/
│   ├── hr/
│   └── schools/
├── components/            # Shared components
└── lib/                   # Utilities
```

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Follow existing code patterns
- Add tests for new features
- Update documentation

### 3. Run Tests

```bash
# Backend tests
cd gates-backend
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

### 4. Commit Changes

```bash
git add .
git commit -m "feat: add new feature"
```

### 5. Create Pull Request

- Include description of changes
- Reference related issues
- Ensure CI passes

## Code Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Avoid `any` types
- Use interfaces for object shapes

### Naming Conventions

- **Files**: kebab-case (e.g., `user-service.ts`)
- **Classes**: PascalCase (e.g., `UserService`)
- **Functions**: camelCase (e.g., `getUserById`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)

### Error Handling

```typescript
try {
  // Operation
} catch (error) {
  logger.error({ error }, 'Operation failed');
  throw new AppError(500, 'Operation failed');
}
```

### Logging

```typescript
import { logger } from '../logger';

logger.info({ userId, action }, 'User action');
logger.error({ error }, 'Operation failed');
logger.warn({ condition }, 'Warning condition');
```

## Testing

### Unit Tests

```typescript
describe('ServiceName', () => {
  it('should do something', async () => {
    // Test implementation
  });
});
```

### Integration Tests

```typescript
describe('API Integration', () => {
  it('should handle request', async () => {
    // Test API endpoint
  });
});
```

## Database

### Migrations

```bash
# Create migration
npm run prisma:migrate dev --name migration_name

# Apply migrations
npm run prisma:migrate deploy

# Reset database (development only)
npm run prisma:migrate reset
```

### Prisma Studio

```bash
# Open Prisma Studio
npm run prisma:studio
```

## API Development

### Adding New Endpoint

1. Create service in `src/modules/{module}/services/`
2. Create schema in `src/modules/{module}/schemas/`
3. Create route in `src/modules/{module}/routes/`
4. Register route in `src/app.ts`
5. Add tests

### Example Route

```typescript
router.post(
  '/',
  authorize({ resource: 'entity', action: 'edit' }),
  validate({ body: createSchema }),
  async (req: AuthRequest, res: Response) => {
    // Handler implementation
  }
);
```

## Common Tasks

### Adding New Module

1. Create module directory structure
2. Define Prisma models
3. Create migrations
4. Implement services
5. Create routes
6. Add tests
7. Update documentation

### Debugging

```bash
# Backend logs
npm run dev  # Watch mode shows logs

# Database queries
# Enable query logging in Prisma client

# Redis debugging
redis-cli monitor
```

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Express Documentation](https://expressjs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

## Getting Help

- Check existing code for examples
- Review documentation in `docs/` directory
- Ask team members
- Review pull requests for patterns

---

**Welcome to the team!**

