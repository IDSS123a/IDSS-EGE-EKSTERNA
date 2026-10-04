# User guide source (PDL-031)

This folder is the source of the comprehensive user guide of IDSS - External Graduate Examination. It is written
alongside the code: every change to a screen updates the chapter that describes it in the same commit. Once the
screens are stable, the guide becomes part of the web app (one page per role, a print stylesheet so every user can
print their guide) with screenshots of the live screens.

Language: the guide is user-facing product text, so it is written in Bosnian, the school's primary language; the
in-app version adds German and English like every other app text. It follows the app text rule P-13 (no dashes as
punctuation, straight quotes, no arrows or emoji) because it will be shown in the app. Labels are quoted exactly as the
screens show them.

| File | Reader |
|---|---|
| `00-zajednicko.md` | everyone: sign-in, language, own account and password, notifications, privacy |
| `01-ucenik.md` | every student |
| `02-nastavnik-predmeta.md` | subject teachers (B/H/S, Mathematics, German) |
| `03-superadministrator.md` | the Director (superadministrator) |
| `04-pedagog-psiholog.md` | pedagogue and psychologist |
| `osobe/*.md` | personal start page per named staff member: what to do first, with links to the chapters |
| `SCREENSHOTS.md` | every screen to capture, with role, state and status |
| `SKRIPTA.md` | short live presentation script for teachers, pedagogue and psychologist (board meeting) |
| `SKRIPTA.html` | the same script as a standalone visual page with app screen mockups (open in a browser, print to PDF) |

Status markers used in the chapters: **Dostupno** (in the app now), **Uskoro** (planned, sprint named), so a reader never
looks for a screen that does not exist yet.
