# Gates ERP Backend

Enterprise Resource Planning (ERP) backend system built with Node.js, Express, TypeScript, and MySQL.

## Features

- **Modular Architecture**: Domain-Driven Design (DDD) with modular monolith structure
- **Multi-Tenancy**: Complete tenant isolation with application-level filtering
- **Authentication & Authorization**: JWT-based auth with Keycloak, RBAC, and fine-grained permissions
- **Performance**: Redis caching, connection pooling, query optimization
- **Reliability**: Circuit breakers, retry logic, health checks, graceful degradation
- **Monitoring**: Prometheus metrics, distributed tracing (OpenTelemetry), structured logging
- **Testing**: Jest test framework with unit, integration, and E2E tests
- **Deployment**: Docker support, Kubernetes manifests, CI/CD pipelines

## Tech Stack

- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MySQL 8.0+
- **ORM**: Prisma
- **Cache**: Redis 7
- **Job Queue**: BullMQ
- **Authentication**: Keycloak (JWT)
- **Monitoring**: Prometheus, Grafana, Jaeger, Loki

## Quick Start

### Prerequisites

- Node.js 20+
- MySQL 8.0+
- Redis 7+
- Docker & Docker Compose (optional)

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# DATABASE_URL=mysql://user:password@localhost:3306/gates_erp
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

### Docker Setup

```bash
# Start all services (MySQL, Redis, MQTT, Backend)
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

## Project Structure

```
gates-backend/
├── src/
│   ├── modules/              # Domain modules (DDD)
│   │   ├── accounting/        # Accounting module
│   │   ├── inventory/         # Inventory module
│   │   ├── hr/               # HR module
│   │   └── schools/          # Schools module
│   ├── shared/               # Shared infrastructure
│   │   ├── auth/             # Authentication
│   │   ├── cache/            # Caching
│   │   ├── database/         # Database utilities
│   │   ├── middleware/       # Express middleware
│   │   ├── monitoring/       # Monitoring & metrics
│   │   └── resilience/       # Resilience patterns
│   └── workers/              # Background workers
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Database migrations
├── src/__tests__/            # Test files
└── docs/                     # Documentation
```

## API Documentation

### Health Check

```bash
GET /health
```

Returns health status of the application and dependencies (Database, Redis, MQTT, Keycloak).

### Metrics

```bash
GET /metrics
```

Prometheus metrics endpoint for monitoring.

### API Endpoints

All API endpoints are prefixed with `/api/v1/`.

**Modules:**
- `/api/v1/accounting/*` - Accounting operations
- `/api/v1/inventory/*` - Inventory management
- `/api/v1/hr/*` - HR operations
- `/api/v1/schools/*` - Schools management

## Environment Variables

See `.env.example` for all required environment variables.

**Required:**
- `DATABASE_URL` - MySQL connection string (format: `mysql://user:password@host:3306/database`)
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)

**Optional:**
- `REDIS_URL` - Redis connection string
- `REDIS_ENABLED` - Enable Redis (default: true)
- `MQTT_URL` - MQTT broker URL
- `MQTT_ENABLED` - Enable MQTT (default: false)
- `KEYCLOAK_ENABLED` - Enable Keycloak (default: false)
- `KEYCLOAK_SERVER_URL` - Keycloak server URL
- `KEYCLOAK_REALM` - Keycloak realm
- `FRONTEND_URL` - Frontend URL for CORS

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- path/to/test.ts
```

### Database Migrations

```bash
# Create migration
npm run prisma:migrate dev --name migration_name

# Apply migrations
npm run prisma:migrate deploy

# Reset database (development only)
npm run prisma:migrate reset
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## Monitoring

### Health Checks

- **Liveness**: `/health` - Basic health check
- **Readiness**: `/health` - Dependency health checks

### Metrics

- **Prometheus**: `/metrics` - Prometheus metrics endpoint
- **Grafana**: Configured dashboards in `grafana/dashboards/`

### Logging

Structured logging with Pino. Logs include:
- Request/response logging
- Error logging
- Slow query logging
- Performance metrics

## Deployment

### Docker

```bash
# Build image
docker build -t gates-backend:latest .

# Run container
docker run -p 3001:3001 --env-file .env gates-backend:latest
```

### Kubernetes

See `k8s/` directory for Kubernetes manifests.

```bash
# Apply manifests
kubectl apply -f k8s/

# Check deployment
kubectl get pods -l app=gates-backend
```

### CI/CD

GitHub Actions workflows:
- `.github/workflows/test.yml` - Run tests on PR
- `.github/workflows/deploy.yml` - Deploy on merge to main

## Performance Optimization

### Database

- Composite indexes for common query patterns
- Query performance monitoring
- Read replicas for reports
- Connection pooling with pgBouncer

### Caching

- Redis caching for GET requests
- Smart cache invalidation
- Cache metrics tracking

### API

- Response compression (Gzip)
- HTTP ETags for conditional requests
- GraphQL depth limiting
- Pagination for large datasets

## Security

### Authentication

- JWT-based authentication
- Keycloak integration
- Token validation middleware

### Authorization

- Role-Based Access Control (RBAC)
- Fine-grained permissions
- Tenant isolation with RLS

### Security Features

- Input validation with Zod
- SQL injection protection (Prisma)
- XSS protection
- Rate limiting (global and per-user)
- Security headers (Helmet)

## Documentation

- **Architecture**: `docs/architecture/system-architecture.md`
- **Deployment**: `docs/runbooks/deployment.md`
- **Onboarding**: `docs/onboarding/developer-onboarding.md`
- **Troubleshooting**: `docs/troubleshooting/common-issues.md`
- **Performance**: `docs/performance/query-optimization.md`

## Contributing

1. Create feature branch
2. Make changes
3. Add tests
4. Run tests and linting
5. Create pull request

## License

[Your License Here]

---

**For more information, see the documentation in the `docs/` directory.**
