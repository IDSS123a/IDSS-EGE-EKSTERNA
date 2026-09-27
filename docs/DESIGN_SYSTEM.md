# Design System — IDSS EGE

Status: foundation (Sprint 01) · Source of tokens: `src/app/globals.css` (app) and
`public/splash/splash.css` (splash, self-contained because it paints before app CSS).

## Brand
- Official IDSS logo: `public/brand/idss-logo.png` (colour, for light surfaces, 1460×443) —
  supplied by the Director 2026-09-27. `public/brand/idss-logo-white.png` for dark surfaces.
  Never recolour, trace, distort or place on a background where it becomes unreadable
  (mandate §17) — on the colourful splash field it sits on a white plate.
- Palette (mandate §17.2): `--idss-blue #035EA1`, `--idss-sky #08ABE6`, `--idss-yellow #FFCB29`,
  `--idss-red #E8262C`, `--idss-black #000000`. Components use **semantic** tokens only.

## Semantic tokens (light)
| Token | Use |
|---|---|
| `--color-surface` / `--color-surface-raised` | page / cards |
| `--color-ink` / `--color-ink-muted` | text |
| `--color-border` | hairlines |
| `--color-brand` / `--color-brand-strong` | primary actions, active states |
| `--color-accent`, `--color-highlight`, `--color-danger` | sky, yellow, red roles |
| `--color-focus` | focus ring (3px) |
| `--gradient-brand` | four-colour brand rule (status bars, progress) |
| `--radius-md/lg/pill`, `--shadow-raised`, `--space-page-x`, `--content-max-width` | shape & layout |

Dark theme tokens are added with the student Game Hub (Sprint 06).

## Typography
Display: Sora (`--font-display`); body: Inter (`--font-body`); both self-hosted by `next/font`
with `latin-ext` for č ć đ š ž.

## Motion
Motion communicates state (loading, progress, reward), never decoration. Every animation has a
`prefers-reduced-motion` variant. The LCP element is never faded in (Commander E-15).

## Splash (mandate §7A.8, PDL-007)
`public/splash/` — `splash.css`, `splash.js`, `messages.json`, `index.html` (standalone preview,
`/splash/?hold=1&lang=de`). WebGL flow field in the four IDSS colours derived from the Director's
"Untitled blend" reference (FLOW recipe), film grain, frosted white plate with the logo, a rotating
non-repeating message, indeterminate brand progress bar. Reduced motion → static frame.
No WebGL → CSS gradient. No JavaScript → splash hidden, app visible.

## Accessibility baseline
Touch targets ≥ 44px, visible focus ring, radio-group language switcher with screen-reader labels,
colour never the only carrier of meaning.
