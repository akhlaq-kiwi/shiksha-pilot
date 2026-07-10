# Backend Engineering Standards & Skills

## Technology Stack

### Core Stack

* PHP 8.3+
* Slim Framework 4
* PHP-DI
* PSR Standards (PSR-1, PSR-4, PSR-7, PSR-11, PSR-12, PSR-15)
* Composer
* PHPUnit

### Database

* MySQL

### Infrastructure

* Object Storage (S3 Compatible)
* Docker

### Development Principles

* Domain Driven Design (DDD)
* Separation of Concerns (SoC)
* Dependency Injection (DI)
* SOLID Principles
* Composition Over Inheritance
* Interface Driven Development
* Event Driven Architecture
* Test Driven Design (TDD Friendly)
* Graphify First Development

---

# Architecture Principles

## Golden Rules

### 1. Separation of Concerns

Every layer has exactly one responsibility.

### 2. Dependency Injection

Never instantiate dependencies inside business code.

### 3. Composition Over Inheritance

Prefer collaborating services over deep inheritance trees.

### 4. Domain First

Business rules belong to the domain layer.

### 5. Framework Independence

Business logic should remain independent of Slim Framework.

### 6. Graphify First

Implementation follows Graphify definitions.

---

# Project Structure

```text
src/
│
├── Presentation/
│
├── Domain/
│
├── Infrastructure/
│
├── Database/
│
├── Shared/
│
├── Config/
│
├── Bootstrap/
│
└── Routes/
```

---

# Complete Backend Structure

```text
src/
│
├── Bootstrap/
│   ├── Container.php
│   ├── Dependencies.php
│   └── Middleware.php
│
├── Config/
│   ├── app.php
│   ├── database.php
│   ├── cache.php
│   └── queue.php
│
├── Presentation/
│   ├── Controllers/
│   ├── Requests/
│   ├── Responses/
│   ├── Middleware/
│   ├── Resources/
│   └── Policies/
│
├── Domain/
│   ├── User/
│   ├── Project/
│   ├── Billing/
│   ├── Auth/
│   └── Notification/
│
├── Infrastructure/
│   ├── Database/
│   ├── Cache/
│   ├── Queue/
│   ├── Storage/
│   ├── Mail/
│   ├── Logging/
│   └── Integrations/
│
├── Database/
│   ├── Migrations/
│   ├── Seeders/
│   ├── Factories/
│   └── Views/
│
├── Shared/
│   ├── Contracts/
│   ├── DTOs/
│   ├── Exceptions/
│   ├── Traits/
│   ├── Enums/
│   ├── Helpers/
│   └── Support/
│
└── Routes/
    ├── api.php
    ├── web.php
    └── health.php
```

---

# Domain Driven Design

## Domain Structure

Each domain is self-contained.

```text
Domain/
└── User/
    │
    ├── Controllers/
    ├── Services/
    ├── Repositories/
    ├── Interfaces/
    ├── Entities/
    ├── DTOs/
    ├── Validators/
    ├── Events/
    ├── Listeners/
    ├── Policies/
    ├── Exceptions/
    └── Tests/
```

---

# Layer Responsibilities

## Presentation Layer

Responsible for:

* Receiving requests
* Returning responses
* Request validation orchestration
* Authorization

Never:

* Query database
* Execute business rules
* Call PDO directly

---

## Domain Layer

Responsible for:

* Business rules
* Business workflows
* Domain entities
* Domain events

Must not know:

* Slim Framework
* HTTP
* Database drivers

---

## Infrastructure Layer

Responsible for:

* Technical implementations
* Database drivers
* Redis
* Storage
* Email
* External APIs

---

# Dependency Injection

## Mandatory Rule

Never:

```php
new UserService();
new ProjectRepository();
new PDO();
```

inside business code.

---

## Constructor Injection

```php
class UserController
{
    public function __construct(
        private UserService $userService
    ) {}
}
```

---

## Dependency Direction

Allowed:

```text
Controller
    ↓
Service
    ↓
Repository Interface
    ↓
Repository Implementation
```

Forbidden:

```text
Repository → Controller
Service → Controller
Entity → Repository
```

Dependencies always point inward.

---

# Controller Standards

Controllers are orchestration only.

Good:

```php
public function create()
{
    $dto = CreateUserDTO::fromRequest($request);

    return $this->success(
        $this->service->createUser($dto)
    );
}
```

Bad:

```php
public function create()
{
    $pdo->query(...);

    sendEmail();

    updateUser();

    return response();
}
```

Controllers should remain thin.

---

# Service Layer Standards

Services contain:

* Business logic
* Domain workflows
* Transactions
* Event dispatching

Examples:

```php
createUser()
activateUser()
publishProject()
approveInvoice()
```

Avoid generic names:

```php
save()
process()
update()
```

Services should express business intent.

---

# Repository Pattern

Repositories are responsible for:

* Reading data
* Writing data
* Querying data

Repositories are NOT responsible for:

* Validation
* Email
* Workflows
* Business logic

---

## Interface First Design

```php
interface UserRepositoryInterface
{
    public function findById(string $id);
}
```

Implementation:

```php
class PdoUserRepository
    implements UserRepositoryInterface
{
}
```

Always inject interfaces.

---

# DTO Pattern

Never pass arrays through layers.

Bad:

```php
$service->createUser($_POST);
```

Good:

```php
$service->createUser(
    CreateUserDTO $dto
);
```

Benefits:

* Strong typing
* Validation
* Refactoring safety

---

# Validation Strategy

Validation belongs in validators.

```text
Validators/
```

Never:

```php
if (empty($email))
```

inside controllers.

---

# Event Driven Architecture

## Domain Events

Examples:

```text
UserRegisteredEvent
ProjectPublishedEvent
InvoicePaidEvent
```

---

## Listeners

Examples:

```text
SendWelcomeEmailListener
CreateAuditLogListener
SyncCrmListener
```

Benefits:

* Loose coupling
* Extensibility
* Scalability

---

# Base Classes Strategy

## Purpose

Base classes should only provide shared technical functionality.

Never place business rules in base classes.

---

## BaseController

Provides:

* Success responses
* Error responses
* Pagination responses

Example:

```php
abstract class BaseController
{
    protected function success();
    protected function error();
}
```

---

## BaseService

Provides:

* Logging
* Transaction helpers
* Event dispatching

Example:

```php
abstract class BaseService
{
    protected LoggerInterface $logger;
}
```

---

## BaseRepository

Provides:

* Query helpers
* Pagination
* Common CRUD methods

Example:

```php
abstract class BaseRepository
{
    protected PDO $db;
}
```

---

## BaseMiddleware

Provides:

* Request context
* Shared middleware helpers

---

# Inheritance Rules

Allowed:

```text
BaseRepository
     ↓
UserRepository
```

Avoid:

```text
CoreRepository
     ↓
BaseRepository
     ↓
UserRepository
     ↓
AdvancedUserRepository
```

Maximum depth:

```text
BaseClass
    ↓
ConcreteClass
```

Prefer composition.

---

# Database Architecture

## Structure

```text
Database/
│
├── Migrations/
├── Seeders/
├── Factories/
└── Views/
```

---

# Migration Standards

Database schema is source code.

Every schema change requires migration.

Never:

* Modify production manually
* Alter tables without migration
* Deploy schema changes outside Git

---

## Migration Naming

Good:

```text
create_users_table
create_projects_table
add_status_to_projects
add_project_owner_index
```

Bad:

```text
update_db
fix_issue
changes
```

---

## Schema Standards

Every table must contain:

```sql
id
created_at
updated_at
```

Recommended:

```sql
created_by
updated_by
deleted_at
```

---

## UUID Strategy

Preferred:

```sql
uuid
```

over auto-increment IDs for distributed systems.

---

## Foreign Keys

Always define relationships explicitly.

```sql
FOREIGN KEY
```

must be enforced when appropriate.

---

## Indexing Standards

Index:

* UUID
* Email
* Status
* Foreign Keys
* Search Columns

Avoid unnecessary indexes.

---

## Soft Deletes

Use:

```sql
deleted_at
```

for business entities.

Exceptions:

* Cache tables
* Temporary tables
* Event logs

---

# Seeder Standards

Seeders are for:

* Development
* QA
* Testing

Not for production business data.

---

# Factory Standards

Factories generate:

* Test data
* Integration data
* Development data

Examples:

```php
UserFactory::create();
ProjectFactory::create();
```

---

# Transaction Management

Transaction boundaries belong to Services.

Example:

```text
ProjectService
 ├── Create Project
 ├── Create Audit
 └── Publish Event
```

Repository never controls transaction lifecycle.

---

# Error Handling

Centralized exception management.

Examples:

```php
ValidationException
UnauthorizedException
ForbiddenException
NotFoundException
BusinessRuleException
```

Global exception middleware converts exceptions into API responses.

---

# Security Standards

Mandatory:

* Input Validation
* Output Encoding
* JWT Authentication
* Authorization Policies
* Rate Limiting
* Audit Logging
* Secrets Management
* Secure Headers

Never trust client input.

---

# Caching Standards

Use Redis for:

* Session Cache
* Query Cache
* Rate Limiting
* Distributed Locks

Cache invalidation must be explicit.

---

# Queue Standards

Queue:

* Emails
* Notifications
* Reports
* File Processing
* Integrations

Never execute heavy jobs inside request lifecycle.

---

# Logging Standards

Log:

* Authentication events
* Critical business actions
* Exceptions
* External integrations

Never log:

* Passwords
* Secrets
* Tokens
* Sensitive personal data

---

# Testing Strategy

Priority Order:

1. Domain Services
2. Business Rules
3. Repositories
4. Controllers
5. Middleware

---

## Test Types

```text
Unit Tests
Integration Tests
Feature Tests
Contract Tests
End-to-End Tests
```

Mock interfaces, not implementations.

---

# Performance Standards

Use:

* Redis Cache
* Queue Workers
* Pagination
* Database Indexing
* Lazy Loading
* Efficient Queries

Avoid:

* N+1 Queries
* Fat Controllers
* Fat Repositories
* Shared Mutable State
* Excessive Inheritance

---

# Graphify Backend Context

Graphify is the knowledge layer.

```text
graphify/
│
├── domains/
├── workflows/
├── api-contracts/
├── schemas/
├── integrations/
├── architecture/
└── decisions/
```

---

## Graphify Responsibilities

Store:

* Domain definitions
* Business workflows
* Database schemas
* API contracts
* Event definitions
* Integration specifications
* Architecture decisions

---

## Development Workflow

Before implementation:

1. Read Graphify context
2. Validate domain model
3. Validate workflow
4. Validate schema
5. Validate API contract
6. Implement
7. Update Graphify

Graphify remains the single source of truth.

---

# CI/CD Standards

Pipeline must execute:

1. Coding Standards
2. Static Analysis
3. Unit Tests
4. Integration Tests
5. Build Validation
6. Migration Validation
7. Security Checks
8. Deployment

---

# Code Review Checklist

## Architecture

* Separation of concerns maintained
* Proper dependency injection
* Domain boundaries respected
* Graphify updated

## Database

* Migration created
* Constraints verified
* Indexes verified

## Security

* Validation implemented
* Authorization checked
* Sensitive data protected

## Quality

* Tests added
* Error handling included
* Logging included

---

# Golden Rule

Controllers orchestrate.

Services execute business rules.

Repositories access data.

Infrastructure provides implementations.

Database persists truth.

Graphify defines context.

Every backend module must be:

* Modular
* Testable
* Reusable
* Observable
* Secure
* Documented
* Scalable
* Replaceable

A feature is complete only when:

* Business logic is implemented
* Tests pass
* Migration exists
* Documentation is updated
* Graphify is updated
* Deployment path is verified

---

# Historical Snapshot Pattern

For academic achievements, annual records, and certifications (e.g., Attendance Leaderboards, Merit Lists, Academic Awards, Annual Achievements, Student Honors), follow the **Historical Snapshot Pattern** to guarantee long-term data integrity:

1. **Information Isolation**: Store snapshot details (e.g., student name, roll number, class name, dob, profile photo path, scores/marks, rankings) directly inside a dedicated snapshot table (e.g., `academic_achievement_snapshots`).
2. **De-coupling from Profiles**: Do not rely on dynamic joins to user/student profiles for historical records. If student profile parameters (such as name, profile photo, or current class) are modified in subsequent academic sessions, the historical achievements must remain frozen as they were captured.
3. **One-Time Generation**: Compute the scores and ranks once (upon academic year rollover or upon first lookup of the archived academic year) and write them directly to the snapshots table.
4. **Read-Only Access**: Once written, snapshots are immutable. The API must only expose read/export workflows for archived sessions. No edit, deletion, or manual recalculation is permitted.
5. **Metadata Extensibility**: Utilize a JSON columns schema (e.g. `metadata`) to support custom variables per achievement type (e.g., `present_days` and `total_working_days` for attendance leaderboard, total marks for merit lists).
