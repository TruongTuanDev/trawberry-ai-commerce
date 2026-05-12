# Strawberry Backend

## Project Overview
`backend/` contains the Spring Boot API for the Strawberry e-commerce platform. It is the system of record for authentication, seller and shop management, catalog data, cart and checkout, manual payment confirmation, shipping, reviews, favorites, Wildberries sync, and admin operations.

In the full architecture, this service sits behind the Angular frontend and exposes REST APIs under `/api/v1/**`. It also owns the PostgreSQL schema and Flyway migrations used across the platform.

## Tech Stack
- Java 25
- Spring Boot 4
- Spring Web MVC
- Spring Security
- Spring Data JPA / Hibernate
- PostgreSQL
- Flyway
- RabbitMQ
- Maven Wrapper
- Springdoc OpenAPI / Swagger UI
- Cloudinary
- Docker

## Key Features / Modules
- Authentication and JWT-based access control
- Customer, seller, and admin flows
- Multi-shop seller workspace and shop-scoped seller APIs
- Product catalog, categories, variants, pricing, and inventory
- Cart, checkout, and order management
- Manual payment proof upload and seller payment review
- Shipping methods, rates, shipments, delivery issues, and tracking
- Product reviews and favorites
- Wildberries integration and sync jobs
- Audit and operational support modules

## Project Structure
```text
backend/
├─ src/main/java/com/strawberry/ecommerce/
│  ├─ auth/        Authentication and registration
│  ├─ cart/        Customer cart logic
│  ├─ catalog/     Products, categories, reviews, favorites
│  ├─ common/      Shared exceptions, security, utilities, services
│  ├─ config/      Spring configuration
│  ├─ order/       Checkout, orders, payments
│  ├─ seller/      Seller workspace and seller-specific flows
│  ├─ shipping/    Shipping methods, shipments, delivery issues
│  ├─ shop/        Shop management and ownership
│  ├─ sync/        Sync jobs and metrics
│  ├─ user/        User entities and account support
│  └─ wb/          Wildberries integration
├─ src/main/resources/
│  ├─ application.yml
│  ├─ application-dev.yml
│  ├─ application-prod.yml
│  └─ db/migration/    Flyway SQL migrations
├─ .mvn/               Maven Wrapper support files
├─ Dockerfile
├─ mvnw
├─ mvnw.cmd
└─ pom.xml
```

## Prerequisites
- JDK 25
- PostgreSQL
- RabbitMQ
- Git
- Docker Desktop or Docker Engine, if you want to run the containerized stack

You do not need a system Maven install because the repository includes Maven Wrapper.

## Environment Configuration
The backend reads its runtime configuration from Spring properties and environment variables.

Common variables:

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/strawberry_db
SPRING_DATASOURCE_USERNAME=strawberry_user
SPRING_DATASOURCE_PASSWORD=strawberry_password

SPRING_RABBITMQ_HOST=localhost
SPRING_RABBITMQ_PORT=5672
SPRING_RABBITMQ_USERNAME=strawberry_mq
SPRING_RABBITMQ_PASSWORD=strawberry_mq_password

SERVER_PORT=8080
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRATION=86400000
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
SPRING_PROFILES_ACTIVE=dev
```

Notes:
- `JWT_SECRET` is required.
- `CLOUDINARY_URL` is required for receipt upload and other Cloudinary-backed uploads.
- Defaults for local database and RabbitMQ are defined in [`application.yml`](./src/main/resources/application.yml), but production-style deployments should still provide explicit environment values.

## Database and Flyway
The backend uses PostgreSQL as its primary database and Flyway for schema versioning.

- Migration scripts live in [`src/main/resources/db/migration`](./src/main/resources/db/migration)
- Flyway runs automatically on application startup
- The Flyway Maven plugin is also configured in [`pom.xml`](./pom.xml)

Typical migration workflow:
1. Add a new `V__` SQL migration file under `src/main/resources/db/migration`
2. Start the application or run a Flyway Maven goal
3. Flyway applies any new migrations in order

## Running the Backend Locally

### Option 1: Run with local PostgreSQL and RabbitMQ
1. Start PostgreSQL and RabbitMQ locally.
2. Create the database if it does not already exist:

```sql
CREATE DATABASE strawberry_db;
```

3. Export the required environment variables.
4. Start the application from `backend/`:

Unix-like shells:
```bash
./mvnw spring-boot:run
```

Windows PowerShell:
```powershell
.\mvnw.cmd spring-boot:run
```

The API will start on `http://localhost:8080` by default.

### Option 2: Run with Docker Compose
From the repository root:

```bash
cp .env.example .env
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build
```

This starts PostgreSQL, RabbitMQ, the backend, and the frontend together.

## Build and Test
From `backend/`:

Build and run tests:

Unix-like shells:
```bash
./mvnw clean test
```

Windows PowerShell:
```powershell
.\mvnw.cmd clean test
```

Package the application:

Unix-like shells:
```bash
./mvnw clean package
```

Windows PowerShell:
```powershell
.\mvnw.cmd clean package
```

Run without tests:

Unix-like shells:
```bash
./mvnw -DskipTests package
```

Windows PowerShell:
```powershell
.\mvnw.cmd -DskipTests package
```

## API Overview
- Base path: `/api/v1`
- Authentication: Bearer token (`Authorization: Bearer <jwt>`)
- Public API groups include catalog and shipping endpoints
- Protected API groups include customer, seller, and admin routes

API docs are available when the service is running:
- Swagger UI: `http://localhost:8080/swagger-ui.html`
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`

Operational endpoints:
- Health: `http://localhost:8080/actuator/health`

## Docker Support
The backend includes a multi-stage Docker build in [`Dockerfile`](./Dockerfile).

Build the image from the repository root:

```bash
docker build -t strawberry-backend ./backend
```

Run the container:

```bash
docker run --rm -p 8080:8080 \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/strawberry_db \
  -e SPRING_DATASOURCE_USERNAME=strawberry_user \
  -e SPRING_DATASOURCE_PASSWORD=strawberry_password \
  -e SPRING_RABBITMQ_HOST=host.docker.internal \
  -e SPRING_RABBITMQ_PORT=5672 \
  -e SPRING_RABBITMQ_USERNAME=strawberry_mq \
  -e SPRING_RABBITMQ_PASSWORD=strawberry_mq_password \
  -e JWT_SECRET=replace-with-a-long-random-secret \
  strawberry-backend
```

For a full local stack, prefer Docker Compose from the repository root.

## Troubleshooting
- **`JWT_SECRET` missing**
  The application will fail to start or auth flows will not work correctly. Set `JWT_SECRET` explicitly.

- **Database connection errors**
  Confirm PostgreSQL is running and that `SPRING_DATASOURCE_*` values point to the correct host, port, database, username, and password.

- **Flyway migration failures**
  Check the migration order under `src/main/resources/db/migration` and confirm the target database is the expected one.

- **Bootstrap or seed logic runs before the schema exists**
  Startup bootstrap code must not assume tables are available before Flyway completes. In this project, `DataBootstrap` is guarded to skip safely until database initialization has finished.

- **Cloudinary upload errors**
  Set `CLOUDINARY_URL`. Upload features intentionally fail fast when Cloudinary is not configured.

- **Port conflicts on `8080`**
  Change `SERVER_PORT` or stop the process already using that port.

- **RabbitMQ connection issues**
  Verify `SPRING_RABBITMQ_*` variables and make sure the broker is reachable from the backend process or container.
