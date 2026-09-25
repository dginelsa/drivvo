# Drivvo API

PHP 8.2+ JSON API backed by MariaDB. The API document root must point to `backend/public`; source code, migrations, Composer metadata, and `.env` stay one directory above the public root.

## Local setup

1. Copy `.env.example` to `.env` outside the public directory and fill in a dedicated MariaDB database/user.
2. Apply `database/migrations/001_initial_schema.sql` to that database.
3. Serve the `public/` directory with PHP 8.2+ and PDO MySQL enabled.
4. Run `composer test` and `composer lint`.

The `.env` file is intentionally ignored by git and must never be deployed from a local checkout. Production secrets belong in the IONOS environment configuration or a private file at `backend/.env` with restrictive permissions.

## API

All routes are under `/api/v1`. JSON errors use `{ "error": { "code": "...", "message": "..." } }`.

- `GET /health` and `GET /health/ready`
- `GET /auth/csrf`, `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`
- `GET|POST /vehicles`, `PATCH /vehicles/{id}`
- `GET|POST /entries`, `PATCH|DELETE /entries/{id}`
- `GET|POST /reminders`, `PATCH /reminders/{id}`
- `GET /reports/summary`

State-changing requests require the `X-CSRF-Token` returned by `/auth/csrf`. Auth uses secure, HTTP-only, same-site PHP session cookies; the allowed browser origin is configured by `FRONTEND_ORIGIN`.
