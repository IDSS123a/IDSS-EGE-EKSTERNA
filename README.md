# IDSS - External Graduate Examination

Priprema učenika IX razreda Internationale Deutsche Schule Sarajevo za eksternu maturu —
platforma zasnovana isključivo na službenim ispitnim katalozima.

Governance: Commander v1.6.2 — start with `CLAUDE.md` and `CONSTITUTION.md`.

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
Za pretragu po značenju u `.env.local` trebaju ključevi iz Google AI Studio: `GEMINI_API_KEY_1=...` do
`GEMINI_API_KEY_10=...` (rotiraju se kada jedan potroši kvotu; prihvataju se i `GEMINI_API_KEY` i `GOOGLE_API_KEY`).
Bez ključa pretraga radi po riječima.

Ako mapa već postoji: prvo zaustaviti server (Ctrl+C), pa `cd C:\DAVOR_PRIVATE\AI\EKSTERNA-MATURA-2026-2027`, pa `git pull`, pa `rmdir /s /q .next` (briše samo privremene prevedene datoteke), pa **uvijek `npm install`**, pa `npm run dev` (nova verzija može donijeti nove biblioteke; bez toga se pojavi greška "Module not found").

### Push obavijesti (VAPID ključevi, PDL-037)
Besplatne push obavijesti na mobitel i računar. Ključeve se pravi jednom, na Vašem računaru:

```powershell
cd C:\DAVOR_PRIVATE\AI\EKSTERNA-MATURA-2026-2027
npx web-push generate-vapid-keys
```

Ispis ima dva reda: `Public Key` i `Private Key`. U datoteku
`C:\DAVOR_PRIVATE\AI\EKSTERNA-MATURA-2026-2027\.env.local` (otvoriti npr. `notepad .env.local`) upisati:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<Public Key>
VAPID_PRIVATE_KEY=<Private Key>
VAPID_SUBJECT=mailto:ai@idss.ba
```

Zatim zaustaviti server (Ctrl+C) i ponovo `npm run dev`. Privatni ključ se nikome ne šalje i ne ide u repozitorij;
ako procuri, napravi se novi par, a korisnici ponovo uključe obavijesti. Isti par se kasnije upisuje i u postavke
hostinga (Vercel) pri objavi. Provjera: Direktorski pregled, kartica Sistem, "Push obavijesti su podešene".

### Migracija koju pokreće Direktor (030)
Datoteka: `C:\DAVOR_PRIVATE\AI\EKSTERNA-MATURA-2026-2027\migrations\030_assignment_notifications.sql`.
Otvoriti je u Notepadu, kopirati cijeli sadržaj, u Supabase (projekt `dezevstfmfliyasdeflj`) otvoriti SQL Editor,
New query, zalijepiti, Run, i potvrditi upozorenje o brisanju (briše se samo stara provjera vrste obavijesti, ne podaci).
Provjera: Direktorski pregled, kartica Sistem, "Obavijesti o zadacima i poklonima su uključene".

## Prvi nalog (Superadministrator)

Jednom, na vlastitom računaru, nakon što su ključevi upisani u `.env.local`:

```powershell
npm run accounts:bootstrap
```

Skripta pravi nalog `direktor@idss.ba`; lozinku (najmanje 12 znakova) upisujete samo Vi,
ne prikazuje se i nigdje se ne sprema. Zatim: `npm run dev` → http://localhost:3000/prijava.

### Kanonski katalozi (Sprint 02)

Tri važeća ispitna kataloga (Matematika, B/H/S, Njemački) upisuju se u registar jednom komandom,
na Vašem računaru (nakon `git pull` i `npm install`):

```powershell
npm run canon:seed
```

Skripta provjerava da su PDF fajlovi netaknuti (SHA-256), učitava ih u privatnu pohranu i
aktivira kao važeće verzije. Može se pokrenuti više puta; ništa se ne duplira i ništa se ne briše.
Registar je zatim na http://localhost:3000/app/kanon.

### Izdvajanje pitanja iz kataloga (Sprint 03)

Na http://localhost:3000/app/kanon, kod svake važeće verzije kataloga, dugme **Izdvoji pitanja**
izdvaja sva pitanja, ponuđene odgovore i ključeve. Ništa od izdvojenog nije provjereno: pitanja
idu učenicima tek nakon pregleda nastavnika (Sprint 04).

Preporučene postavke u Supabase → Authentication:
- **Sign In / Providers → Allow new users to sign up: OFF** (naloge pravi samo Superadministrator).
- **Email → Confirm email:** može ostati uključeno; skripta i admin potvrđuju e-mail pri kreiranju.

## Checks
`npm run typecheck` · `npm run lint` · `npm run build` · `npm run test:e2e` · `npm run test:db` (needs PostgreSQL 15+ server binaries)
