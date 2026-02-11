# Codex Working Agreements – cap-a-piep

## Repo facts
- Next.js App Router is used (folder: /app). Do NOT create /pages routes.
- Auth cookie name: auth_token (httpOnly).
- JWT includes: userId, role. Verified via lib/auth.ts.

## General rules
- Make minimal diffs. No refactors unless asked.
- Do NOT add dependencies unless explicitly asked.
- Keep styling simple and consistent with existing app.
- Do not change database schema or migrations unless asked.

## Auth slice scope (only)
- Add logout API route at app/api/auth/logout/route.ts that clears auth_token
- Add role-based guards:
  - middleware.ts for route-level protection
  - optional helper utilities as needed
- Add logout button in dashboard/nav
- Keep existing /login and /api/auth/login logic intact
