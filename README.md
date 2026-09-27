# IDSS EGE

Priprema učenika IX razreda Internationale Deutsche Schule Sarajevo za eksternu maturu —
platforma zasnovana isključivo na službenim ispitnim katalozima.

Governance: Commander v1.6.1 — start with `CLAUDE.md` and `CONSTITUTION.md`.

## Lokalno postavljanje (Windows)

Lokalna mapa projekta: `C:\DAVOR_PRIVATE\AI\EKSTERNA-MATURA-2026-2027`

```powershell
cd C:\DAVOR_PRIVATE\AI
git clone https://github.com/IDSS123a/IDSS-EGE-EKSTERNA.git EKSTERNA-MATURA-2026-2027
cd EKSTERNA-MATURA-2026-2027
npm install
copy .env.example .env.local
npm run dev
```

U `.env.local` upisati ključeve iz Supabase → Project Settings → API (projekt
`dezevstfmfliyasdeflj`). `.env.local` se nikad ne commituje.

Ako mapa već postoji: `cd C:\DAVOR_PRIVATE\AI\EKSTERNA-MATURA-2026-2027` pa `git pull`.

## Checks
`npm run typecheck` · `npm run lint` · `npm run build` · `npm run test:e2e` · `npm run test:db` (needs PostgreSQL 15+ server binaries)
