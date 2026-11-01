# CarServiceApp

A full-stack workshop management application designed for small automotive service businesses.

CarServiceApp provides a centralized interface for managing customers, vehicles, appointments, worksheets, inventory, users, company settings, and business audit history.

The project was built as a real-world workshop management system with a strong focus on data integrity, security, maintainability, and practical day-to-day usability.

---

## Features

### Customer Management

- Create and edit customers
- Search by name, phone number, or email
- View associated vehicles
- Paginated customer lists
- Protected deletion when business history exists

### Vehicle Management

- Register customer vehicles
- Store registration number, make, model, VIN, year, and inspection information
- Search and filter vehicles
- View complete service history
- View upcoming appointments

### Appointment Calendar

- Day, week, month, and agenda views
- Create and edit workshop appointments
- Vehicle and customer integration
- Bounded date-range loading
- Historical calendar navigation
- Direct date URLs

### Service Worksheets

- Create worksheets for vehicles and appointments
- Add labor and parts
- Calculate worksheet totals
- Complete worksheets
- Print completed worksheets
- Preserve historical snapshots of parts and prices
- Optimistic concurrency protection
- Completed worksheet history protection

Mechanics can complete active worksheets, while reopening, modifying, or deleting completed historical worksheets requires administrator privileges.

### Inventory

- Create and update parts
- Track stock
- Store net and gross prices
- Search by name or part number
- Stock-state filtering
- Historical worksheet data remains intact if inventory items are later changed or removed

### Dashboard

The dashboard provides bounded aggregate workshop information including:

- today's appointments
- active worksheets
- recent worksheets
- vehicle inspection reminders
- low-stock inventory

The dashboard uses server-side aggregation instead of loading complete database tables.

### User Management

Two application roles are currently supported:

- `admin`
- `mechanic`

Administrators can manage users, settings, destructive operations, completed worksheet history, and audit records.

Mechanics can perform normal workshop operations but cannot access administrative or destructive functionality.

### Audit Trail

Security-sensitive and business-critical mutations are recorded in a persistent audit trail.

Examples include:

- login
- logout
- password changes
- user administration
- customer changes
- vehicle changes
- appointment changes
- worksheet creation, editing, completion and reopening
- inventory changes
- settings changes

Audit records are accessible only to administrators and contain deliberately minimized metadata.

Passwords, password hashes, JWTs, signing keys, request bodies, and uploaded file contents are never intentionally stored in audit events.

---

## Technology Stack

### Backend

- ASP.NET Core
- .NET 10
- Entity Framework Core
- SQLite
- JWT authentication
- BCrypt password hashing
- Swagger / OpenAPI in Development

### Frontend

- React
- TypeScript
- Vite
- React Router
- Axios
- React Big Calendar
- react-to-print

### Testing

- xUnit
- ASP.NET Core integration tests
- Playwright
- Chromium end-to-end tests

### Deployment

The application is designed for containerized deployment using:

- Docker
- Docker Compose
- Nginx
- persistent SQLite storage
- persistent upload storage

Production deployment documentation is maintained separately from application source configuration.

---

## Architecture

```text
Browser
   │
   ▼
React / TypeScript SPA
   │
   ▼
Nginx reverse proxy
   │
   ▼
ASP.NET Core API
   │
   ├── Authentication / Authorization
   ├── Validation
   ├── Resource limits
   ├── Audit trail
   │
   ▼
Entity Framework Core
   │
   ▼
SQLite
```

Uploaded profile images are stored separately from the database and are normalized before being served.

---

## Security

The project has undergone multiple dedicated security-hardening stages and a final security re-audit.

Implemented protections include:

- external JWT signing secrets
- explicit JWT issuer and audience
- HS256 algorithm enforcement
- token expiration validation
- session revocation
- database-backed role validation
- login throttling
- bounded BCrypt concurrency
- password policy enforcement
- explicit request DTOs
- server-side validation
- optimistic concurrency
- normalized user-login uniqueness
- last-administrator protection
- destructive-operation authorization
- completed worksheet history protection
- safe image decoding and re-encoding
- file size and image dimension limits
- upload storage quotas
- bounded API request bodies
- server-side pagination
- bounded search queries
- date-range limits
- application rate limits
- Content Security Policy
- CORS restrictions
- security response headers
- sanitized server errors
- non-root container configuration
- read-only container filesystems
- dropped Linux capabilities
- audit logging

The final application security review reported no unresolved Critical or High application vulnerabilities.

Infrastructure-level controls such as TLS, firewall configuration, production secret storage, backups, image scanning, and server monitoring must still be configured and validated for each deployment.

---

## Pagination and Resource Limits

Large application collections use server-side pagination.

Default page size:

```text
50
```

Maximum page size:

```text
100
```

Additional limits exist for:

- API request bodies
- worksheet line items
- appointment date ranges
- searches
- uploads
- upload storage
- concurrent expensive operations
- rate-limited collection queries

These protections reduce accidental and intentional resource exhaustion.

---

## Running Locally

### Requirements

Install:

- .NET 10 SDK
- Node.js 24
- npm
- Git

Clone the repository:

```bash
git clone https://github.com/MTZBRN/CarServiceApp.git
cd CarServiceApp
```

---

## Backend

Navigate to:

```bash
cd Backend/CarServiceShop/CarServiceShop
```

The application requires a JWT signing key.

For local Development, provide a cryptographically random base64 value containing at least 32 random bytes.

Example PowerShell generation:

```powershell
$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$env:Jwt__Key = [Convert]::ToBase64String($bytes)
```

Start the backend:

```bash
dotnet run
```

The default Development backend is available at:

```text
http://localhost:5232
```

Never commit JWT signing keys or other production secrets.

---

## Frontend

Navigate to:

```bash
cd Frontend
```

Install dependencies:

```bash
npm ci
```

Start the development server:

```bash
npm run dev
```

The default Vite development server is available at:

```text
http://localhost:5173
```

---

## Initial Administrator

The application intentionally does not create a predictable default administrator.

Administrator provisioning is an explicit operation.

Production administrator provisioning should only be performed using the documented provisioning procedure and external configuration.

Never place administrator passwords in source control.

---

## Tests

### Backend

From the backend solution directory:

```bash
dotnet test
```

### Frontend Type Check

```bash
npm run typecheck
```

### Production Build

```bash
npm run build
```

### Playwright

```bash
npx playwright test
```

The project contains extensive integration and browser regression coverage for authentication, permissions, concurrency, validation, pagination, uploads, worksheets, audit history, and other business workflows.

---

## Database

CarServiceApp currently uses SQLite.

SQLite is intentional for the expected deployment model:

- one workshop
- one application instance
- small number of simultaneous users
- modest write concurrency

Database migrations are managed using Entity Framework Core.

Production upgrades should always be preceded by a verified backup.

Never reset or recreate a production database merely to apply an application update.

---

## Persistent Data

Production deployments must preserve at least:

```text
Database
/app/data

Uploads
/app/uploads
```

Database files and uploaded files must not be committed to Git.

---

## Backup

A production backup strategy should include both:

1. the SQLite database
2. uploaded files

Provider-level virtual-machine backups should not be the only backup mechanism.

A separate off-server backup and tested restore procedure are recommended.

---

## Repository Structure

```text
CarServiceApp/
│
├── Backend/
│   └── CarServiceShop/
│
├── Frontend/
│
├── docker-compose.yml
├── Dockerfile
│
├── SECURITY_STAGE_*.md
├── FINAL_SECURITY_REAUDIT_REPORT.md
│
└── README.md
```

---

## Production Status

Application-level development and security hardening are substantially complete.

Before a public production deployment, operational validation is still required for:

- Docker image execution
- container permissions
- Nginx configuration
- image vulnerability scanning
- production secret injection
- DNS
- TLS / HTTPS
- firewall configuration
- persistent storage permissions
- backup and restore testing
- monitoring
- initial administrator provisioning
- production smoke testing

Do not expose the Development configuration directly to the public Internet.

---

## License

This project is licensed under the MIT License.

See the `LICENSE` file for details.

---

## Author

Developed by **Barnabás Metzger**.

---

## Disclaimer

This software is provided under the terms of the MIT License.

Before using it with real customer or business data, the operator is responsible for configuring and validating the deployment environment, access controls, backups, TLS, server security, monitoring, and applicable data-protection requirements.
