# ADR-002: Data Access Layer Standardization — pgx/v5 vs SQLC

## Status
Accepted

## Date
2026-09-19

## Context
In ADR-001, SQLC was listed as the intended data access layer. However, across the actual codebase (`backend/internal/repository/`), all data access is implemented using handwritten `jackc/pgx/v5` with connection pooling (`pgxpool.Pool`), explicit row-level locking (`FOR UPDATE`), FIFO transactional credit deductions, and complex dynamic filters.

Furthermore:
1. `backend/sqlc.yaml` referenced `internal/repository/query.sql` and `schema.sql` which did not reflect the live 100+ database migrations.
2. Generating static SQLC models for rapidly evolving analytical queries and blockchain event ingestors created maintenance friction.
3. High-concurrency financial operations (like `DeductCreditsFIFO`) require granular transaction and lock management that `pgx/v5` handles natively.

## Decision
1. **Standardize on `jackc/pgx/v5`**: All repository implementations will continue using direct, parameterized, type-safe `pgx/v5` queries.
2. **Module-Local Repositories**: Repositories must be scoped to their bounded context (`billing`, `username`, `numbers`, `gifts`, `identity`) rather than living in a monolithic global repository.
3. **Deprecate SQLC configuration**: Remove or archive `backend/sqlc.yaml` to avoid developer confusion and false CI claims.
4. **Single Source of Truth for Schema**: Database migrations (`backend/migrations/*.sql`) are the sole authoritative source of truth for the database schema.

## Consequences
- **Positive**: Full control over transaction isolation levels, row locks, batch queries, and pgx binary protocol performance.
- **Positive**: Eliminates drift between `sqlc.yaml` and actual database migrations.
- **Negative**: Requires diligent unit and integration testing of SQL queries to catch syntax regressions.
