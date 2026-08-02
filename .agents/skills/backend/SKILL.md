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

### 6. Standardized Predefined Class Architecture
* All school classes must be bound to standardized academic levels (`Play Group` through `Class 12`).
* Custom manual class creation by teachers is strictly disallowed.
* Section creation supports `Alphabet Sections` (`A, B, C, D`) and `Color Sections` (`Red, Blue, Green, Yellow`).
* Minimum 2 sections and maximum 4 sections are enforced. Section type mixing is prohibited.
* Section type is locked and cannot be changed once students are assigned (`studentCount > 0`).
* Deletion of any class or section with `studentCount > 0` is strictly prohibited; explicit validation exception must be thrown instructing transfer/removal.


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

---

# Financial Audits and Transaction Ledgers

For financial records, cash books, and collection histories (e.g. Fee Collections, Expenses, Salary Disbursements), follow these guidelines to establish complete transparency and audit integrity:

1. **Audit Immutability**: Every transaction must be permanently recorded. Once a payment is recorded, it must never be updated, edited, or deleted from history. If a payment is reverted or refunded, insert a new transaction representing the reversal (or mark a separate state of reversal while leaving the initial row intact) to preserve the historical audit trail.
2. **Dynamic Cumulative Running Balance**: Every ledger statement or transaction view must display the running balance progression:
   * **Previous Total**: The running sum of all preceding payments up to this transaction.
   * **Current Transaction**: The amount of the current transaction (e.g., `+ ₹800`).
   * **Updated Total**: The sum of the previous total and the current transaction amount.
   * **Chronological Summation**: To compute this correctly, always query all transactions, sort them in chronological order ascending (oldest first), accumulate the running balance, and then apply user search filters or descending sort for the UI display.
3. **Immutable Metadata**: Explicitly record transaction details like `payment_method`, `collected_by` (actor name), and `receipt_no` at the time of creation instead of joining dynamically with tables whose entities might change, get archived, or be deleted in the future.
4. **Globally Unique Reference Numbers**: Reference numbers must be purely numeric (e.g. `783680993041`), exactly 12 digits, and unique across the entire school, system, and all academic years. Generate these numbers using a collision-free method (e.g. timestamp + random padding) and check for uniqueness in the database.
5. **Grouping Multi-Month Transactions**: In the transaction history ledger, a multi-month payment (e.g. paying for July + August in a single action) must render as exactly *one* transaction row with a single unique Ref No, summing the total amount paid, and displaying the fee description in the format `Monthly Fee (Month1 to Month2)`.
6. **All Months Filter & Card Title**: Provide an "All Months" default filter option. Metric summary cards (like this month or transaction count) must dynamically update labels and values matching the filter, and default to total collections if "All Months" is active. Today's live collection must be computed independently from the month filter.

---

# Announcements and Mobile Notice System

For publishing global announcements and managing mobile notice boards with push notifications, follow these guidelines to ensure consistency, correct audience visibility, and zero regression:

1. **Rich Text Formatting Control**:
   * To prevent layout breakage and color mismatch, limit web text editor outputs strictly to three styling tags: bold (`<b>`/`<strong>`), italic (`<i>`/`<em>`), and underline (`<u>`).
   * No font families, font sizes, text alignments, or color styles must be injected into the database to guarantee clean cross-platform compatibility.
2. **Broadcast Notification Routing**:
   * Immediate notifications are broadcast using the `dashboard_notifications` table with role-based routing. Set `user_id` to `NULL` to notify all users matching the specified `user_role` within the school.
   * Restrict notification creation strictly to the initial publish action. Subsequent edits to an announcement must update the database record and reflect in the notice board *without* dispatching duplicate notifications.
3. **Audience-Based Scoping**:
   * Enforce audience target validation: `Teachers Only` targets `'TEACHER'`, `Students Only` targets `'STUDENT'` and `'PARENT'`, and `Both` targets all three roles.
   * Filter notice API responses using in-clause matching against the user's authenticated role to ensure no unauthorized role can fetch or read notices.
4. **Native Mobile HTML Parsing**:
   * Instead of using heavy, version-sensitive external HTML rendering packages, utilize a lightweight regex-based custom parser in Dart to split HTML strings into formatted `TextSpan` elements. This provides 100% native rendering speeds and removes dependency overheads.
5. **Read/Unread State Synchronicity**:
   * Maintain a link table (e.g. `announcement_reads`) to track read status per user. Mark a notice as read automatically as soon as the user opens the notice detail screen, updating state indicators instantly.

---

# Annual Fee & Admission Fee Engineering Standards

For managing dedicated Annual Fees and optional Admission Fees in financial modules, follow these business rules and architecture patterns:

1. **Annual Fee Eligibility Rule**:
   * Annual Fee must **NOT** be charged to students admitted during the current academic session (`admission_date >= academic_year.start_date`).
   * Include only eligible students where `admission_date < academic_year.start_date` (or `admission_date` is `NULL` for legacy pre-enrolled students).
   * Excluded students must receive **NO** entry in `additional_fee_payments` (no 0 amount, no hidden record, no placeholder) and **NO** notification.
   * Send notification (`Title: Annual Fee Added`) only to eligible students who were assigned the fee.

2. **Admission Fee Auto-Generation & Synchronization**:
   * Admission Fee in student enrollment is optional. If provided (`admission_fee > 0`), automatically generate an `additional_fee_payments` record with status `'Pending'`.
   * On student edits, if `admission_fee` is modified:
     * If updated to a new amount: update existing pending payment record amount.
     * If set to blank or 0: delete existing pending payment record.
     * Paid payment history, receipts, and audit logs must remain preserved.

3. **First Academic Year Student Category Classification**:
   * During the school's **first Academic Year** inside the portal, `Student Category` (`Existing Student` vs `New Admission`) is mandatory upon student creation.
   * From the second Academic Year onward, `Student Category` dropdown disappears completely from enrollment form, and students are classified automatically based on historical academic records.
   * Annual Fee applies ONLY to `Existing Student` records (or auto-classified historical enrollments). All `New Admission` students are excluded.
   * If no eligible students exist during Annual Fee creation, return descriptive validation error: `"No eligible students found. Annual Fee is only applicable to Existing Students. All currently enrolled students are marked as New Admission."`


