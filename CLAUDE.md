# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server on port 3000 (hot reload)
npm run build      # TypeScript type-check + Vite production build to dist/
npm run start      # Build then run Express server (production mode)
npm run server     # Run Express server only (requires existing dist/)
npm run preview    # Preview the production build locally
npm run lint       # TypeScript type checking (tsc --noEmit)
npm run clean      # Remove dist/ directory
```

There is no test suite configured. `npm run lint` is the only automated quality check.

## Environment Setup

Copy `.env.example` to `.env.local` and fill in all six Firebase VITE_ variables. The app will fail to initialize Firebase if any variable is missing. Port defaults to 3000 via `VITE_APP_PORT`.

## Architecture

**Two-mode runtime**: In development, Vite serves `src/` directly with HMR. In production, `npm run build` compiles to `dist/` and `server.ts` (Express) serves it as a static SPA with a catch-all to `index.html`.

**Firebase as the entire backend**: There is no custom API server — all data reads/writes go directly from the React app to Firebase Firestore and Firebase Auth. `server.ts` only serves static files and has one health check endpoint (`GET /api/health`). All business logic lives in the frontend.

**Authentication flow**: `src/components/AuthContext.tsx` wraps the app and provides `UserProfile` (uid, name, email, role, injuryType, recoveryProgress) via context. It uses Firestore `onSnapshot` for real-time profile sync. Route protection in `src/App.tsx` uses `ProtectedRoute` (requires auth) and `PublicRoute` (redirects if authenticated); role-specific routes additionally check `userProfile.role`.

**Role-based access**: Two roles — `patient` and `doctor`. Patients see `/dashboard`, `/exercises`, `/progress`. Doctors see `/dashboard` and `/doctor`. This split is enforced both in `App.tsx` routing and in `firestore.rules` (doctors can read all patient documents; patients can only read their own).

**Data model**: Patients store exercise sessions as a Firestore subcollection under their user document. `src/types.ts` is the single source of truth for all interfaces — `Exercise`, `Patient`, `PatientSession`, `ProgressData`, and the `InjuryType` union.

**Mock data in constants**: `src/constants.ts` holds static exercise libraries and sample data used as fallbacks or initial state. Real patient data comes from Firestore; this file is not a database substitute but seeded content.

**Path alias**: `@/` resolves to the repository root (not `src/`), configured in both `tsconfig.json` and `vite.config.ts`.

**Styling**: Tailwind CSS v4 via `@tailwindcss/vite` plugin — no `tailwind.config.js` needed. The `cn()` utility in `src/lib/utils.ts` (clsx + tailwind-merge) is used throughout for conditional class merging.
