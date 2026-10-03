# Screenshots for the user guide

Every screen of the guide with role and state. "Fixture" = captured with sample data in the build sandbox (layout
check, not for the final guide); "Live" = to capture from the real app with a real sign-in for the final guide.

| Screen | Path | Role | States to capture | Status |
|---|---|---|---|---|
| Splash and public home | `/` | everyone | splash, home | Fixture 2026-10-03 |
| Sign-in | `/prijava` | everyone | empty, wrong password | Fixture 2026-10-03 |
| Own account | `/app/nalog` | everyone | password change, leaked password refused | Live pending |
| Game Hub | `/app` | student | notifications, streak, mission, IDSS points and badges, subjects | Fixture 2026-10-03 |
| Subject areas | `/app/predmet/[code]` | student | three subjects | Live pending |
| Practice | `/app/vjezba` | student | choice, true/false, open, erratum notice, after answer | Fixture 2026-10-03 |
| Mock exams overview | `/app/ispit` | student | available, waiting, unavailable, history | Fixture 2026-10-03 |
| Mock exam | `/app/ispit/[id]` | student | waiting, before start, writing (desktop and phone), submitted, result | Fixture 2026-10-03 |
| Staff home | `/app` | each staff role | links per role | Live pending |
| Grading area | `/app/ocjenjivanje` | teacher, superadmin | queues, blueprints (load, confirm), notifications | Fixture 2026-10-03 |
| Set approval | `/app/ocjenjivanje/[id]` | teacher | printed keys, errata, follow-ups, approve, discard | Live pending |
| Grading | `/app/ocjenjivanje/[id]` | teacher | proposals, points, pairs, confirm | Fixture 2026-10-03 |
| Practice answers | `/app/ocjenjivanje/vjezba` | teacher | answer beside key, verdict | Live pending |
| Review queue | `/app/pregled` | teacher, superadmin | filters, open notices, key search | Live pending |
| Review record | `/app/pregled/[id]` | teacher, superadmin | source region, errata form, follow-ups | Live pending |
| Accounts | `/app/nalozi` | superadmin, view for others | create, status, rights, reset | Live pending |
| Canon registry | `/app/kanon` | superadmin, reviewers | upload, versions, history | Live pending |
| Settings | `/app/postavke` | superadmin | splash colours | Live pending |
| Student monitoring | `/app/pracenje` | pedagogue, psychologist, superadmin, teacher (own subject) | follow-ups, filters, table, phone | Fixture 2026-10-03 |
| Student profile | `/app/pracenje/[student]` | pedagogue, psychologist | dimensions, areas, persistent errors, exams, notes | Fixture 2026-10-03 |
| Group analysis | `/app/pracenje/analiza` | pedagogue, psychologist, superadmin | weeks, areas, points, missed questions | Fixture 2026-10-03 |
| Daily summary | `/app/pracenje/dan` | teacher (own subject), pedagogue, psychologist, superadmin | day picker, practised, not practised, areas, open work, phone | Fixture 2026-10-03 |
| Assignments (teacher) | `/app/zadaci` | teacher, superadmin | new assignment (keys, area, all, chosen), list with states | Fixture 2026-10-03 |
| Assignment detail | `/app/zadaci/[id]` | teacher, superadmin | questions, students with facts, withdraw, print, CSV | Live pending |
| Teacher assignments card | `/app` | student | open, done, progress, push switch, phone | Fixture 2026-10-03 |
| IDSS Vitrina | `/app/vitrina` | student | new gift, unboxing frames, six gifts, phone | Fixture 2026-10-03 |
| Special gift form | `/app/pracenje/[student]` | teacher | six gifts, message, list | Live pending |
| Director overview | `/app/direktor` | superadmin | six tabs, periods, "premalo učenika", audit filters, print, CSV, phone | Fixture 2026-10-04 |
| Director settings | `/app/postavke` | superadmin | mission goal, minimum group, IDSS points and badges, history | Live pending |
