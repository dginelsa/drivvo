# Drivvo

A mobile-first vehicle logbook PWA inspired by the supplied product screenshots. The app is split into `frontend/` (Ionic Angular) and `backend/` (PHP + MariaDB).

## Current Features

- Local demo garage for frontend development.
- Account registration and sign-in against the PHP API in production builds.
- Vehicle selection/addition, activity history, and add/edit refueling, expense, income, and service records.
- Monthly totals, category reports, reminders, and an installable PWA shell.

## Local Development

Requirements: Node 24.15+ for the generated Angular 22 toolchain; PHP 8.2+ with PDO MySQL and MariaDB for backend work.

```sh
cd frontend
npm ci
npm start
```

The development app opens at `http://localhost:4200` (Angular CLI may select another free port). With no API URL configured, the app uses a local browser demo stored in local storage. Demo records are not synchronized to the backend.

For API development, configure `backend/.env` from `backend/.env.example`, apply `backend/database/migrations/001_initial_schema.sql`, then serve `backend/public` with PHP. Set `apiUrl` in `frontend/src/environments/environment.ts` to the local API `/api/v1` URL. Do not enable credentialed CORS for arbitrary origins.

## Tests and Builds

```sh
cd frontend
npm run lint
npm test -- --watch=false
npm run build
```

```sh
cd backend
php tests/run.php
find src public tests -name '*.php' -print0 | xargs -0 -n1 php -l
```

## IONOS Setup

- Frontend domain: `drivvo.dginelsa.net`, document root `/dginelsa/drivvo/frontend`.
- API domain: `drivvo-api.dginelsa.net`, document root **`/dginelsa/drivvo/backend/public`**. The API requires this nested public directory; do not point the API domain at `/backend`.
- Create the MariaDB schema by applying `backend/database/migrations/001_initial_schema.sql`.
- The backend deployment workflow creates a private `backend/.env` on the server from GitHub Actions secrets. It is excluded from the build artifact and repository. The database password is base64-encoded in that private file and decoded by the PHP config loader at runtime.
- Frontend and backend have independent workflows. They upload only their own production artifacts to their respective directories when files in their respective folders change on `main` (or on manual dispatch).

Add these GitHub Actions secrets before enabling deploy workflows:

- `IONOS_SFTP_HOST`: IONOS SFTP hostname.
- `IONOS_SFTP_PORT`: SFTP port, normally `22`.
- `IONOS_SFTP_USERNAME`: hosting SFTP user.
- `IONOS_SFTP_PASSWORD`: **rotated** hosting SFTP password.
- `IONOS_SFTP_KNOWN_HOSTS`: optional verified SSH host-key line for the host/port. If omitted, each workflow obtains a candidate key with `ssh-keyscan` at deploy time. This is convenient but does not pin a key verified out-of-band, so it provides weaker protection against a machine-in-the-middle attack.
- `IONOS_DB_HOST`: IONOS MariaDB host.
- `IONOS_DB_PORT`: MariaDB port, normally `3306`.
- `IONOS_DB_NAME`: database name.
- `IONOS_DB_USER`: database username.
- `IONOS_DB_PASSWORD`: **rotated** database password.

The database secrets are used only by the backend deploy job to create the private server-side runtime file. They are not included in build artifacts or frontend deployments. The credentials pasted into chat should be considered exposed and rotated before use.

The first GitHub Actions run validates each app and uploads to the configured folders; it does not configure IONOS DNS, TLS, document roots, database schema, or private runtime variables. Confirm those hosting settings before dispatching a deployment.
