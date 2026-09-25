# Drivvo Vehicle Logbook Requirements

## Product Goal

A mobile-first, installable PWA for keeping vehicle records, maintenance reminders, and ownership costs together. The visual direction follows the supplied references: teal vehicle chrome, charcoal navigation, calm light surfaces, and distinct fuel, expense, income, and service accents. Use original branding and implementation.

## First Release

- Account registration, sign-in, sign-out, and private per-account records.
- Garage with multiple vehicles, make/model/year, display name, and current odometer.
- Vehicle history containing refueling, expenses, income, and service entries; add and edit entries with date, amount, odometer, and optional note.
- Date- or mileage-based reminders; mark reminders complete.
- Dashboard totals and a monthly category chart for the selected vehicle.
- Responsive desktop navigation and mobile bottom navigation; keyboard-accessible controls and labelled form fields.
- Installable PWA with app-shell caching. Writes require connectivity; no background or push notifications in this release.

## Deferred

Inspection/checklist forms, attachments, route/freight reporting, export, advanced report filters, offline writes/synchronization, and native app packaging.

## Data and API

- PHP 8.2+ JSON API under `/api/v1`; MariaDB with InnoDB and `utf8mb4`.
- Every vehicle, entry, reminder, and aggregate must be scoped to the authenticated account.
- Use prepared statements, server-side sessions, password hashing, strict production-origin CORS, CSRF protection on mutations, and generic server errors.
- Store no passwords, database credentials, or session secrets in tracked files or frontend code.
- Date values use `YYYY-MM-DD`; distance uses integer miles; amounts are decimal USD values.

## Acceptance Checks

- A new account can sign in, create a vehicle, add/edit a record, create/complete a reminder, and see the dashboard/report totals update.
- Signing out protects the app routes; a different account cannot list or mutate another user's data by guessing record IDs.
- Invalid forms are rejected with useful messages; empty states and load/save errors are presented without losing existing data.
- The PWA production build includes the web manifest, icons, service worker, and static-host SPA rewrite.
- Frontend and backend workflows deploy separately to their own paths, only from `main` after their own build/test gates pass.
