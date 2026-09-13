# System Architecture

## Overview

Gates ERP is a modular monolith built with Node.js/Express backend and Next.js frontend, designed for multi-tenant SaaS deployment.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Accounting│  │Inventory │  │    HR    │  │ Schools  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└──────────────────────┬────────────────────────────────────┘
                        │ HTTP/REST + GraphQL
┌──────────────────────┴────────────────────────────────────┐
│                    API Gateway (Express)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Auth │ Rate Limit │ Caching │ Compression │ ETags  │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
│   Modules    │ │  Workers   │ │  Monitoring │
│              │ │             │ │             │
│ Accounting   │ │ Payroll     │ │ Prometheus   │
│ Inventory    │ │ Reports     │ │ Grafana     │
│ HR           │ │             │ │ Jaeger       │
│ Schools      │ │             │ │ Loki        │
└───────┬───────┘ └─────┬─────┘ └──────┬──────┘
        │               │               │
        └───────┬───────┴───────┬───────┘
                │               │
        ┌───────▼───────┐ ┌─────▼─────┐
        │  PostgreSQL   │ │   Redis   │
        │  (Primary)     │ │  (Cache)  │
        └───────┬───────┘ └───────────┘
                │
        ┌───────▼───────┐
        │  PostgreSQL   │
        │  (Replica)     │
        └────────────────┘
```

## Component Overview

### Frontend (Next.js)
- **Framework**: Next.js 15
- **Styling**: Tailwind CSS
- **UI Components**: PrimeReact
- **State Management**: React hooks

### Backend (Node.js/Express)
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: Prisma
- **Validation**: Zod

### Database
- **Primary**: PostgreSQL 15
- **Replica**: Read replica for reporting
- **Connection Pooling**: pgBouncer
- **Extensions**: PostGIS (for Real Estate)

### Caching & Queues
- **Cache**: Redis 7
- **Job Queue**: BullMQ (Redis-backed)

### Monitoring
- **Metrics**: Prometheus
- **Visualization**: Grafana
- **Tracing**: Jaeger (OpenTelemetry)
- **Logs**: Loki + Promtail

### Authentication
- **Provider**: Keycloak
- **Method**: JWT tokens
- **Authorization**: RBAC + Fine-grained permissions

## Data Flow

### Request Flow
1. Client → API Gateway (Express)
2. Authentication middleware validates JWT
3. Tenant context middleware sets RLS variables
4. Rate limiting middleware checks quotas
5. Cache middleware checks Redis
6. Route handler processes request
7. Response compressed and cached

### Transaction Flow
1. Service layer validates input
2. Database transaction begins
3. Business logic executes
4. Audit log created
5. Cache invalidated
6. Transaction commits
7. Response returned

## Security Architecture

### Multi-Tenancy
- **Isolation**: Row-Level Security (RLS)
- **Context**: Per-request tenant/company ID
- **Data**: Complete tenant isolation

### Authentication Flow
1. User authenticates with Keycloak
2. JWT token issued
3. Token validated on each request
4. User context extracted
5. Permissions checked

### Authorization
- **RBAC**: Role-based access control
- **FGAC**: Fine-grained access control
- **Branch-level**: Branch-specific permissions
- **Module-level**: Subscription-based access

## Scalability

### Horizontal Scaling
- **Stateless**: Application is stateless
- **Load Balancer**: Kubernetes Service
- **Replicas**: Multiple pod replicas
- **Database**: Read replicas for reads

### Vertical Scaling
- **Resources**: Configurable CPU/memory limits
- **Connection Pool**: pgBouncer for connection management
- **Caching**: Redis for frequently accessed data

## Deployment Architecture

### Development
- Docker Compose for local development
- Single container for backend
- Local PostgreSQL and Redis

### Production
- Kubernetes for orchestration
- Multiple replicas for high availability
- Separate workers for async jobs
- Monitoring stack (Prometheus, Grafana, Jaeger)

## Module Structure

### Accounting Module
- Chart of Accounts
- Journal Entries
- Financial Reports
- Treasury Operations

### Inventory Module
- Items & Warehouses
- Invoices (Sales/Purchase)
- Stock Operations
- Inventory Reports

### HR Module
- Employee Management
- Payroll Processing
- HR Reports
- Contract Management

### Schools Module
- Student Management
- Installments
- School Reports
- Payment Tracking

## Data Consistency

### Transactions
- All critical operations use database transactions
- ACID compliance for data integrity
- Rollback on errors

### Validation
- Input validation with Zod
- Business rule validation
- Consistency checks

### Audit Trail
- Complete audit logging
- Audit chain verification
- Data retention policies

## Performance Optimizations

### Database
- Indexes on foreign keys and frequently queried columns
- Composite indexes for common patterns
- Query performance monitoring
- Read replicas for reports

### Caching
- Redis caching for GET requests
- Smart cache invalidation
- Cache metrics tracking

### API
- Response compression (Gzip)
- HTTP ETags for conditional requests
- GraphQL depth limiting
- Pagination for large datasets

## Monitoring & Observability

### Metrics
- HTTP request metrics
- Database query performance
- Cache hit/miss ratios
- Business metrics

### Logging
- Structured logging with Pino
- Log aggregation with Loki
- Request/response logging

### Tracing
- Distributed tracing with OpenTelemetry
- Request correlation IDs
- Performance profiling

## Disaster Recovery

### Backups
- Automated database backups
- Point-in-time recovery (PITR)
- Backup retention policies

### High Availability
- Multiple replicas
- Health checks
- Automatic failover
- Graceful degradation

---

**Last Updated**: Based on current implementation
**Architecture Pattern**: Modular Monolith (ready for microservices split)

