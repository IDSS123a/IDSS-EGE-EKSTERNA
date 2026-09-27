# Roles and Permissions

Status: proposed (Sprint 00) · Source: mandate §7, §7A.1–7A.6 · Enforced in `lib/permissions.ts`
(application) **and** RLS policies (database). UI hiding is never authorization.

## 1. Accounts at launch (mandate §7A.1)

| Role | Person | Account | Capability bundle |
|---|---|---|---|
| SUPERADMINISTRATOR | Davor Mulalić | direktor@idss.ba | `superadmin` (all capabilities, audited) |
| ADMINISTRATOR | Haris Hamzić | haris.hamzic@idss.ba | `subject_teacher[Matematika]` + `admin_operations` |
| ADMINISTRATOR | Nikolina Todorović | nikolina.todorovic@idss.ba | `subject_teacher[Njemački jezik]` + `admin_operations` |
| ADMINISTRATOR | Nizama Memija | nizama.memija@idss.ba | `subject_teacher[B/H/S]` + `admin_operations` |
| ADMINISTRATOR | Adnana Agić | pedagog@idss.ba | `pedagogue` + `admin_operations` |
| ADMINISTRATOR | Medina Karaga | psiholog@idss.ba | `psychologist` + `admin_operations` |
| STUDENT | current Grade 9 students | school-issued username (AMB-06) | `student` |

Accounts are created by the Superadmin in the app (no public self-registration).
`admin_operations` content is not specified by the mandate beyond "authorized
administrative operations" → Sprint 01 grants only account viewing for own students;
anything more is added by explicit Director decision.

## 2. Capability matrix

✅ allowed · 🔸 scoped (own subject / own students) · 🔹 aggregate only · — denied

| Capability | Superadmin | Subject teacher | Pedagogue | Psychologist | Student |
|---|---|---|---|---|---|
| Manage accounts, roles, lifecycle | ✅ | — | — | — | — |
| Manage school years / cohorts | ✅ | — | — | — | — |
| Upload / publish / supersede canon | ✅ | — | — | — | — |
| Review ingested questions (semantic gate) | ✅ | 🔸 | — | — | — |
| Propose answer-key revision | ✅ | 🔸 | — | — | — |
| View student academic progress | ✅ | 🔸 | ✅ | ✅ | own |
| Assign practice / missions | ✅ | 🔸 | — | — | — |
| Read/write teacher (academic) notes | ✅ | 🔸 | ✅ | ✅ | — |
| Read/write support notes | — (by default; see §3) | — | ✅ | ✅ | — |
| Institution analytics | ✅ | 🔹 | 🔹 | 🔹 | — |
| Audit log & security events | ✅ | — | — | — | — |
| Practice, mock exams, missions, achievements | — | — | — | — | ✅ |
| Export permitted reports | ✅ | 🔸 | ✅ (no support notes in exports) | ✅ (idem) | own |

## 3. Privacy boundaries (mandate §7A.6, §11, M-15)

- Support notes are readable only by the pedagogue and psychologist. Whether the
  Superadmin may read them is an institutional-policy question → default **denied**
  and recorded in `AMBIGUITIES.md` process when Sprint 07 starts.
- No role sees inferred psychological, medical, intelligence or personality labels —
  the system does not compute them.
- One student never sees another student's data; leaderboards (if any) use
  opt-in pseudonyms and are a Director decision.
- Every read of individual student data by staff writes an access audit row.

## 4. Enforcement pattern

```
Server Action → requireSession() → loadProfile(user_id) → can(profile, capability, scope)
             → Zod parse → domain → repository (RLS still applies with the user's JWT)
```
`can()` lives only in `lib/permissions.ts`; RLS policies call the SQL twin
`has_capability(auth.uid(), code, subject_id)`. Both are tested with forged-token,
wrong-role and direct-call cases before production data (DONE checklist).
