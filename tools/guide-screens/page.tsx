/**
 * Guide screens (PDL-031): every screen of the user guide rendered by the real screen component with realistic trial
 * data. Never routed in the app: tools/guide-screens/capture.mjs copies this file to src/app/zz-guide/[screen]/page.tsx,
 * runs a development server, takes the screenshots and removes the copy again. Students are invented; questions,
 * official solutions, areas and blueprints are the real catalogue data.
 */
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AccountHome } from "@/features/account/components/account-home";
import { OwnAccountScreen } from "@/features/account/components/own-account-screen";
import { AccountsScreen } from "@/features/accounts/components/accounts-screen";
import { AssignmentDetailScreen } from "@/features/assignments/components/assignment-detail-screen";
import { AssignmentsHomeScreen } from "@/features/assignments/components/assignments-home-screen";
import type { StudentAssignment } from "@/features/assignments/types";
import { DirectorScreen, type DirectorData } from "@/features/director/components/director-screen";
import { ExamOverviewScreen } from "@/features/exams/components/exam-overview-screen";
import { ExamScreen } from "@/features/exams/components/exam-screen";
import type { ExamStatus, ExamUnit, ExamView } from "@/features/exams/types";
import { VitrinaScreen } from "@/features/gifts/components/vitrina-screen";
import type { Gift } from "@/features/gifts/types";
import { blueprintConfig } from "@/features/grading/blueprint-config";
import { GradingExamScreen } from "@/features/grading/components/grading-exam-screen";
import { GradingHomeScreen } from "@/features/grading/components/grading-home-screen";
import { PracticeReviewScreen } from "@/features/grading/components/practice-review-screen";
import { SendTestScreen } from "@/features/grading/components/send-test-screen";
import type { GradingQueueEntry, GradingView, SendOptions, SubjectBlueprint } from "@/features/grading/types";
import type { Subject, SubjectCode } from "@/features/knowledge/types";
import type { AppNotification } from "@/features/notifications/types";
import { GameHub } from "@/features/practice/components/game-hub";
import { PracticeScreen } from "@/features/practice/components/practice-screen";
import { SubjectScreen } from "@/features/practice/components/subject-screen";
import type { AreaProgress, PracticeQuestion } from "@/features/practice/types";
import { ReviewQueueScreen } from "@/features/review/components/review-queue-screen";
import { SettingsScreen } from "@/features/settings/components/settings-screen";
import { DEFAULT_APP_SETTINGS } from "@/features/settings/app-settings";
import { DEFAULT_SPLASH_SHARES } from "@/features/splash/palette";
import { DailySummaryScreen } from "@/features/support/components/daily-summary-screen";
import { GroupAnalysisScreen } from "@/features/support/components/group-analysis-screen";
import { StudentProfileScreen } from "@/features/support/components/student-profile-screen";
import { SupportOverviewScreen } from "@/features/support/components/support-overview-screen";
import type { OverviewStudent, ProfileSubject, Readiness, StudentProfile } from "@/features/support/types";

// Dates of the trial phase: "today" is the day the screenshots show.
const TODAY = "2026-10-04";
const at = (day: string, time = "10:15") => `${day}T${time}:00+02:00`;
const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

const SUBJECT_IDS: Record<SubjectCode, string> = {
  bhs_language_literature: "3016935f-5b18-40d2-b8e1-252869e67dfd",
  mathematics: "7522b1fc-c34b-4543-bae9-ed303dc5eb51",
  german: "81d81e9f-5f58-48a1-aba4-4c007186aee7",
};
const CODES: SubjectCode[] = ["bhs_language_literature", "mathematics", "german"];
const subject = (code: SubjectCode): Subject => ({ id: SUBJECT_IDS[code], code, officialName: code, legalBasis: "", sourceVersionId: "", evidence: [] });

// Invented students (no real person).
const STUDENTS = [
  { personId: "0a000000-0000-4000-8000-000000000001", name: "Lana Begić" },
  { personId: "0a000000-0000-4000-8000-000000000002", name: "Tarik Mehić" },
  { personId: "0a000000-0000-4000-8000-000000000003", name: "Emina Kovač" },
  { personId: "0a000000-0000-4000-8000-000000000004", name: "Dino Šabić" },
  { personId: "0a000000-0000-4000-8000-000000000005", name: "Sara Ibrić" },
  { personId: "0a000000-0000-4000-8000-000000000006", name: "Amar Hadžić" },
];
const TEACHERS: Record<SubjectCode, string> = { mathematics: "Haris Hamzić", bhs_language_literature: "Nizama Memija", german: "Nikolina Todorović" };

// Real catalogue areas.
const AREAS: Record<SubjectCode, string[]> = {
  mathematics: ["Brojevni izrazi", "Geometrijski i stereometrijski elementi sa brojevnim izrazima", "Stepeni sa prirodnim eksponentom", "Polinomi i linearna funkcija oblika 𝒚 = 𝒌𝒙 + 𝒏", "Algebarski razlomci", "Linearne jednačine sa jednom nepoznatom", "Linearne nejednačine sa jednom nepoznatom", "Algebarski „problemi“ sa jednom/dvije nepoznate", "Geometrijski „problemi“ sa jednom/dvije nepoznate", "Geometrijska tijela i stereometrijski „problemi“ sa jednom/dvije"],
  bhs_language_literature: ["KNJIŽEVNOST", "MEDIJSKA KULTURA", "FONETIKA I FONOLOGIJA", "MORFOLOGIJA", "TVORBA RIJEČI", "SINTAKSA", "LEKSIKA", "PRAVOPIS", "HISTORIJA JEZIKA"],
  german: ["HÖRVERSTEHEN", "LESEVERSTEHEN", "WORTSCHATZ", "GRAMMATIK", "KOMMUNIKATION"],
};
const areaId = (code: SubjectCode, index: number) => `ar${CODES.indexOf(code)}00000-0000-4000-8000-${String(index).padStart(12, "0")}`.replace(/^ar/, "a1");

// Real questions with crops of the catalogue page (P-15).
const CROP = "/catalogue/450a10071ffc";
const MATH_SOURCE = { page: 22, officialTitle: "Ispitni katalog za polaganje Eksterne mature iz Matematike" };
function choiceQuestion(id: string, key: string, area: string, level: string, text: string, options: string[]): PracticeQuestion {
  return {
    questionVersionId: id, recordKey: key, subjectId: SUBJECT_IDS.mathematics, areaId: areaId("mathematics", AREAS.mathematics.indexOf(area) + 1), area, taskType: "multiple_choice_single_answer",
    catalogueLevel: level, text, stem: text, options: options.map((option, index) => ({ label: "abcd"[index], text: option })), hasFigure: false,
    items: [{ item: null, text: null, mode: "choice", choices: options.map((_, index) => "abcd"[index]) }], transcript: null, source: MATH_SOURCE, crop: `${CROP}/${key}.png`, errata: [],
  };
}
function openQuestion(id: string, key: string, area: string, level: string, text: string): PracticeQuestion {
  return {
    questionVersionId: id, recordKey: key, subjectId: SUBJECT_IDS.mathematics, areaId: areaId("mathematics", AREAS.mathematics.indexOf(area) + 1), area, taskType: "open_constructed_response_stepwise",
    catalogueLevel: level, text, stem: text, options: [], hasFigure: false, items: [{ item: null, text: null, mode: "open", choices: [] }], transcript: null, source: MATH_SOURCE, crop: `${CROP}/${key}.png`, errata: [],
  };
}
const Q = {
  q514: choiceQuestion("7fae6ffd-ebaf-431a-99c2-a49538d299c6", "MAT-5.1.4", "Brojevni izrazi", "osnovni nivo", "5.1.4. Koja je vrijednost izraza 4 + 2 ∶ 2 − 4 ∶ 4?", ["−\n3\n4", "−\n1\n4", "1\n4", "4"]),
  q553: choiceQuestion("777d7012-eea4-430c-86c0-8c7fd09afeac", "MAT-5.5.3", "Algebarski razlomci", "osnovni nivo", "5.5.3. Dat je algebarski razlomak 2x/7y, (x, y ≠ 0). Koji od sljedećih algebarskih razlomaka je nastao proširivanjem datog algebarskog razlomka sa 7x?", ["49𝑥2\n14𝑥𝑦", "14𝑥\n49𝑥𝑦", "14𝑥2\n49𝑥𝑦", "14𝑥2\n7𝑦"]),
  q562: choiceQuestion("3c8ade32-6dbf-40ff-a193-97be69d2cf6b", "MAT-5.6.2", "Linearne jednačine sa jednom nepoznatom", "osnovni nivo", "5.6.2. Koji od ponuđenih odgovora predstavlja rješenje jednačine −1 + 3x = 3x + 2?", ["x = 0", "x = 3", "jednačina nema rješenja", "jednačina ima beskonačno mnogo rješenja"]),
  q558: openQuestion("809dbd44-19e5-4cf5-b651-552c327ae90b", "MAT-5.5.8", "Algebarski razlomci", "srednji nivo", "5.5.8. Skrati algebarski razlomak (x²−1)/(x²+2x+1) i odredi pod kojim uslovima je to moguće učiniti?"),
  q5612: openQuestion("5612aaaa-0000-4000-8000-000000005612", "MAT-5.6.12", "Linearne jednačine sa jednom nepoznatom", "srednji nivo", "5.6.12."),
};
function otherChoice(code: SubjectCode, id: string, key: string, area: string, text: string, options: string[]): PracticeQuestion {
  const german = code === "german";
  return {
    questionVersionId: id, recordKey: key, subjectId: SUBJECT_IDS[code], areaId: areaId(code, AREAS[code].indexOf(area) + 1), area, taskType: "multiple_choice_single_answer", catalogueLevel: null,
    text, stem: text, options: options.map((option, index) => ({ label: "abcd"[index], text: option })), hasFigure: false,
    items: [{ item: german ? 1 : null, text: null, mode: "choice", choices: options.map((_, index) => "abcd"[index]) }], transcript: null,
    source: { page: german ? 30 : 12, officialTitle: german ? "Ispitni katalog za polaganje Eksterne mature iz Njemačkog jezika" : "Ispitni katalog za polaganje Eksterne mature iz bosanskog, hrvatskog, srpskog jezika i književnosti" },
    crop: `/catalogue/${german ? "51a8d531227e" : "ba11dfbb0bca"}/${key}.png`, errata: [],
  };
}
const SUBJECT_QUESTIONS: Record<"bhs_language_literature" | "german", PracticeQuestion[]> = {
  bhs_language_literature: [
    otherChoice("bhs_language_literature", "81c8f6df-7dd2-4120-ba2c-d795edca17fa", "BHS-FON.22", "FONETIKA I FONOLOGIJA", "22. Koja od ponuđenih riječi je sastavljena od zatvorenih slogova? Zaokruži slovo ispred tačnog odgovora.", ["leptir", "djevojčica", "kuća", "sladoled"]),
    otherChoice("bhs_language_literature", "812f09f3-5feb-4f6e-ac5f-b6d87c68279c", "BHS-HIS.1", "HISTORIJA JEZIKA", "1. Kako se naziva prvi pisani jezik Slavena? Zaokruži slovo ispred tačnog odgovora.", ["ilirski", "južnoslovenski", "staroslavenski", "slovenački"]),
    otherChoice("bhs_language_literature", "5f6cec3f-7dbf-4056-95cd-f57c13379e36", "BHS-HIS.3", "HISTORIJA JEZIKA", "3. Kojim pismom i kad je napisana Povelja Kulina bana? Zaokruži slovo ispred tačnog odgovora.", ["glagoljicom, 678. godine", "bosančicom, 1189. godine", "arebicom, 1612. godine", "latinicom, 1918. godine"]),
  ],
  german: [
    otherChoice("german", "fa58c0ce-3942-4e01-b087-a89033350c0f", "DEU-4.3.1", "WORTSCHATZ", "4.3.1. Jahreszeiten sind:", ["Montag, Dienstag, Mittwoch, Donnerstag", "September, Oktober, November, Dezember", "der Frühling, der Sommer, der Herbst, der Winter"]),
    otherChoice("german", "85315c26-2767-46f2-9de9-ccff12961146", "DEU-4.3.2", "WORTSCHATZ", "4.3.2. Ergänze: sieben, acht, ..., zehn, elf, ...", ["neun, zwölf", "sechs, zwei", "drei, vier"]),
    otherChoice("german", "b1813c50-405a-4b58-97b1-3fbcd5a6d504", "DEU-4.3.3", "WORTSCHATZ", "4.3.3. Lisa treibt Sport. Sie trainiert ...", ["Musik", "Volleyball", "Englisch"]),
  ],
};
const KEYS: Record<string, string> = { "MAT-5.1.4": "d)", "MAT-5.5.3": "c)", "MAT-5.6.2": "c)", "MAT-5.5.8": "𝑥−1\n𝑥+1, (𝑥 ≠ −1)", "MAT-5.6.12": "Jednačina nema rješenja.", "BHS-FON.22": "a) leptir", "BHS-HIS.1": "c) staroslavenski", "BHS-HIS.3": "b) bosančicom, 1189. godine", "DEU-4.3.1": "c)", "DEU-4.3.2": "a)", "DEU-4.3.3": "b)" };
const keyOf = (questionVersionId: string) => KEYS[[...Object.values(Q), ...SUBJECT_QUESTIONS.bhs_language_literature, ...SUBJECT_QUESTIONS.german].find((question) => question.questionVersionId === questionVersionId)?.recordKey ?? ""] ?? null;

const readiness = (state: Readiness["state"], exams: number, errors: number): Readiness => ({ state, exams, errors });

// ---------- student ----------
function areaProgress(code: SubjectCode): AreaProgress[] {
  const totals: Record<SubjectCode, number> = { mathematics: 20, bhs_language_literature: 20, german: 50 };
  return AREAS[code].map((area, index) => {
    const total = totals[code];
    const answered = Math.max(0, Math.round(total * [0.9, 0.7, 0.85, 0.5, 0.6, 0.75, 0.4, 0.3, 0.2, 0.1][index % 10]));
    return { subjectId: SUBJECT_IDS[code], subjectCode: code, areaId: areaId(code, index + 1), area, ordinal: index + 1, total, answered, correct: Math.round(answered * [0.8, 0.55, 0.9, 0.62, 0.41, 0.7, 0.5, 0.66, 0.58, 0.5][index % 10]), awaiting: index === 4 ? 1 : 0 };
  });
}
const studentAssignments: StudentAssignment[] = [
  { id: "a5000000-0000-4000-8000-000000000001", subject: "mathematics", title: "Algebarski razlomci: ponavljanje", instruction: "Riješi pažljivo i provjeri postupak.", dueAt: at("2026-10-09", "20:00"), teacher: TEACHERS.mathematics, total: 8, answered: 3, correct: 2, completedAt: null, state: "open" },
  { id: "a5000000-0000-4000-8000-000000000002", subject: "german", title: "Wortschatz: Jahreszeiten", instruction: null, dueAt: at("2026-10-03", "20:00"), teacher: TEACHERS.german, total: 5, answered: 5, correct: 4, completedAt: at("2026-10-02", "18:40"), state: "complete" },
];
const studentGifts: Gift[] = [
  { id: "g1000000-0000-4000-8000-000000000001", code: "crystal", message: "Za upornost u vježbi Matematike. Samo tako nastavi!", giver: TEACHERS.mathematics, createdAt: at("2026-10-02", "12:00"), openedAt: at("2026-10-02", "16:20") },
  { id: "g1000000-0000-4000-8000-000000000002", code: "quill_book", message: "Lijepo napisan sastav. Bravo!", giver: TEACHERS.bhs_language_literature, createdAt: at("2026-10-04", "09:00"), openedAt: null },
];
const studentNotifications: AppNotification[] = [
  { id: "n1", kind: "mock_exam_assigned", examId: "e1000000-0000-4000-8000-000000000002", subjectCode: "mathematics", createdAt: at(TODAY, "08:05"), read: false },
  { id: "n2", kind: "gift_given", examId: null, subjectCode: null, createdAt: at(TODAY, "09:00"), read: false },
  { id: "n3", kind: "assignment_given", examId: null, subjectCode: "mathematics", createdAt: at("2026-10-03", "14:30"), read: true },
  { id: "n4", kind: "mock_exam_graded", examId: "e1000000-0000-4000-8000-000000000001", subjectCode: "german", createdAt: at("2026-10-02", "17:10"), read: true },
];

function unit(id: string, position: number, sequence: number, question: PracticeQuestion, mode: ExamUnit["mode"], response: string, finalPoints: number | null, solution: string | null, note: string | null = null): ExamUnit {
  return {
    id, position, sequence, questionVersionId: question.questionVersionId, item: null, format: mode === "choice" ? "choice" : "working", scoring: "single", mode, maxPoints: 1,
    allowedPoints: [0, 1], response, finalPoints, correctPairs: null, note, solution,
  };
}
function examView(status: ExamStatus, overrides: Partial<ExamView>, units: ExamUnit[], questions: PracticeQuestion[]): ExamView {
  return {
    id: "e1000000-0000-4000-8000-000000000002", subjectCode: "mathematics", status, createdAt: at(TODAY, "08:00"), startedAt: null, deadlineAt: null, submittedAt: null,
    autoSubmitted: false, gradedAt: null, maxPoints: units.length, minutes: 60, totalPoints: null, serverNow: new Date().toISOString(), kind: "full", positions: null, sentBy: null, note: null,
    units, questions: Object.fromEntries(questions.map((question) => [question.questionVersionId, { ...question, errataDetails: [] }])), ...overrides,
  };
}
const partUnits = (withAnswers: boolean, graded: boolean) => [
  unit("u1", 5, 1, Q.q558, "open", withAnswers ? "(x−1)(x+1) / (x+1)² = (x−1)/(x+1), x ≠ −1" : "", graded ? 1 : null, graded ? KEYS["MAT-5.5.8"] : null, graded ? "Tačno, uslov je dobro naveden." : null),
  unit("u2", 6, 2, Q.q5612, "open", withAnswers ? "3x − 3x = 2 + 1, 0 = 3, nema rješenja" : "", graded ? 1 : null, graded ? KEYS["MAT-5.6.12"] : null),
  unit("u3", 7, 3, Q.q553, "choice", withAnswers ? "b" : "", graded ? 0 : null, graded ? KEYS["MAT-5.5.3"] : null, graded ? "Pogledaj još jednom kako se proširuje razlomak." : null),
];
const partOverrides = { kind: "part" as const, positions: [5, 6, 7], minutes: 20, sentBy: TEACHERS.mathematics, note: "Ponovite algebarske razlomke prije vježbe." };

/** A part of a test in any subject: Mathematics as above, B/H/S positions 1 to 3, German position 3 (three items). */
function subjectPart(code: SubjectCode, withAnswers: boolean, graded: boolean): { units: ExamUnit[]; questions: PracticeQuestion[]; overrides: Partial<ExamView> } {
  if (code === "mathematics") return { units: partUnits(withAnswers, graded), questions: [Q.q558, Q.q5612, Q.q553], overrides: partOverrides };
  const questions = SUBJECT_QUESTIONS[code];
  const german = code === "german";
  const answers = german ? ["c", "a", "a"] : ["a", "c", "a"];
  const units = questions.map((question, index) => ({
    ...unit(`u${index + 1}`, german ? 3 : index + 1, index + 1, question, "choice", withAnswers ? answers[index] : "", graded ? (index === 2 ? 0 : 0.5) : null, graded ? keyOf(question.questionVersionId) : null),
    item: german ? 1 : null, maxPoints: 0.5, allowedPoints: [0, 0.5], scoring: german ? ("per_item" as const) : ("single" as const), format: german ? "items" : "choice",
  }));
  return { units, questions, overrides: { kind: "part", positions: german ? [3] : [1, 2, 3], minutes: 10, sentBy: TEACHERS[code], note: german ? "Wiederholt den Wortschatz." : "Ponovite historiju jezika.", subjectCode: code, maxPoints: 1.5 } };
}

// ---------- teacher ----------
function blueprintFor(code: SubjectCode, confirmed: boolean): SubjectBlueprint {
  const config = blueprintConfig(code);
  return {
    subjectId: SUBJECT_IDS[code], subjectCode: code, config,
    loaded: config ? { id: `b${CODES.indexOf(code)}000000-0000-4000-8000-000000000001`, version: config.version, sha256: config.sha256, loadedAt: at("2026-10-02", "11:00"), content: config.content, reviews: confirmed ? [{ decision: "confirmed", note: null, reviewerName: TEACHERS[code], decidedAt: at("2026-10-03", "12:30") }] : [] } : null,
  };
}
const queue = (code: SubjectCode): GradingQueueEntry[] => [
  { id: "e2000000-0000-4000-8000-000000000001", subjectId: SUBJECT_IDS[code], subjectCode: code, student: "Lana Begić", status: "awaiting_approval", kind: "part", positions: PART[code].positions, sent: true, createdAt: at(TODAY, "08:00"), submittedAt: null, autoSubmitted: false, gradedAt: null, maxPoints: PART[code].max, totalPoints: null, units: 3, ungraded: 3 },
  { id: "e2000000-0000-4000-8000-000000000002", subjectId: SUBJECT_IDS[code], subjectCode: code, student: "Emina Kovač", status: "awaiting_approval", kind: "full", positions: null, sent: false, createdAt: at(TODAY, "07:40"), submittedAt: null, autoSubmitted: false, gradedAt: null, maxPoints: 10, totalPoints: null, units: 10, ungraded: 10 },
  { id: "e2000000-0000-4000-8000-000000000003", subjectId: SUBJECT_IDS[code], subjectCode: code, student: "Tarik Mehić", status: "submitted", kind: "full", positions: null, sent: false, createdAt: at("2026-10-03", "16:00"), submittedAt: at("2026-10-03", "17:02"), autoSubmitted: false, gradedAt: null, maxPoints: 10, totalPoints: null, units: 10, ungraded: 4 },
  { id: "e2000000-0000-4000-8000-000000000004", subjectId: SUBJECT_IDS[code], subjectCode: code, student: "Sara Ibrić", status: "graded", kind: "full", positions: null, sent: false, createdAt: at("2026-10-01", "15:00"), submittedAt: at("2026-10-01", "16:00"), autoSubmitted: true, gradedAt: at("2026-10-02", "09:30"), maxPoints: 10, totalPoints: 8, units: 10, ungraded: 0 },
];
const teacherNotifications = (code: SubjectCode): AppNotification[] => [
  { id: "t1", kind: "mock_exam_requested", examId: "e2000000-0000-4000-8000-000000000002", subjectCode: code, createdAt: at(TODAY, "07:40"), read: false },
  { id: "t2", kind: "mock_exam_submitted", examId: "e2000000-0000-4000-8000-000000000003", subjectCode: code, createdAt: at("2026-10-03", "17:02"), read: false },
];
function sendOptions(code: SubjectCode): SendOptions {
  const config = blueprintConfig(code);
  // Areas per position as mock_exam_send_options returns them live (2026-10-04); German as its pools give them once
  // the plan is confirmed (each position one catalogue part).
  const live: Record<SubjectCode, string[][]> = {
    mathematics: Array.from({ length: 10 }, () => AREAS.mathematics),
    bhs_language_literature: ["KNJIŽEVNOST", "KNJIŽEVNOST", "KNJIŽEVNOST", "KNJIŽEVNOST", "MORFOLOGIJA", "MORFOLOGIJA", "MORFOLOGIJA", "SINTAKSA", "MEDIJSKA KULTURA", "PRAVOPIS", "PRAVOPIS", "HISTORIJA JEZIKA", "KNJIŽEVNOST", "KNJIŽEVNOST", "SINTAKSA", "FONETIKA I FONOLOGIJA", "TVORBA RIJEČI", "LEKSIKA"].map((area) => [area]),
    german: AREAS.german.map((area) => [area]),
  };
  const positions = (config?.content.positions ?? []).map((position) => ({ position: position.position, format: position.format, points: position.points, areas: (live[code][position.position - 1] ?? []).map((name) => ({ id: areaId(code, AREAS[code].indexOf(name) + 1), name })) }));
  return { subjectId: SUBJECT_IDS[code], subjectCode: code, available: true, minutes: 60, totalPoints: positions.reduce((sum, position) => sum + position.points, 0), positions };
}
const gradingView = (code: SubjectCode, status: "awaiting_approval" | "submitted"): GradingView => {
  const part = subjectPart(code, status === "submitted", false);
  const units = part.units.map((entry) => ({ ...entry, solution: keyOf(entry.questionVersionId) }));
  return {
    ...examView(status, { ...part.overrides, id: "e2000000-0000-4000-8000-000000000001", startedAt: status === "submitted" ? at(TODAY, "09:00") : null, submittedAt: status === "submitted" ? at(TODAY, "09:18") : null }, units, part.questions),
    subjectId: SUBJECT_IDS[code], student: "Lana Begić", approvedAt: status === "submitted" ? at(TODAY, "08:10") : null,
    proposedPoints: status === "submitted" ? Object.fromEntries(units.filter((entry) => entry.mode === "choice").map((entry) => [entry.id, entry.response === (keyOf(entry.questionVersionId) ?? "").slice(0, 1) ? entry.maxPoints : 0])) : {}, followUps: {}, pairsRule: null,
  };
};

// Subject-specific assignment titles, catalogue keys and the part of a test in the queue.
const ASSIGNMENT_TITLES: Record<SubjectCode, [string, string]> = { mathematics: ["Algebarski razlomci: ponavljanje", "Linearne jednačine"], bhs_language_literature: ["Historija jezika: ponavljanje", "Fonetika i fonologija"], german: ["Wortschatz: Wiederholung", "Grammatik"] };
const ASSIGNMENT_KEYS: Record<SubjectCode, string[]> = {
  mathematics: ["MAT-5.5.1", "MAT-5.5.2", "MAT-5.5.3", "MAT-5.5.4", "MAT-5.5.6", "MAT-5.5.8", "MAT-5.5.11", "MAT-5.5.14"],
  bhs_language_literature: ["BHS-HIS.1", "BHS-HIS.2", "BHS-HIS.3", "BHS-HIS.4", "BHS-HIS.5", "BHS-HIS.6", "BHS-HIS.7", "BHS-HIS.8"],
  german: ["DEU-4.3.1", "DEU-4.3.2", "DEU-4.3.3", "DEU-4.3.4", "DEU-4.3.5", "DEU-4.3.6", "DEU-4.3.7", "DEU-4.3.8"],
};
const PART: Record<SubjectCode, { positions: number[]; max: number }> = { mathematics: { positions: [5, 6, 7], max: 3 }, bhs_language_literature: { positions: [1, 2, 3], max: 1.5 }, german: { positions: [3], max: 1.5 } };

// ---------- monitoring ----------
function overviewStudents(codes: SubjectCode[]): OverviewStudent[] {
  const rows: [number, string | null, number, number, number[]][] = [
    [0, at(TODAY, "08:40"), 5, 19, [68, 81, 74]],
    [1, at("2026-10-03", "19:10"), 3, 14, [55, 62, 70]],
    [2, at(TODAY, "07:55"), 6, 22, [77, 85, 88]],
    [3, at("2026-09-25", "18:00"), 0, 6, [52, 47, 58]],
    [4, at("2026-10-02", "20:30"), 2, 11, [64, 72, 69]],
    [5, at("2026-09-22", "17:45"), 0, 3, [61, 55, 49]],
  ];
  return rows.map(([index, last, d7, d30, acc]) => ({
    personId: STUDENTS[index].personId, name: STUDENTS[index].name, lastActivity: last, days7: d7, days30: d30,
    subjects: codes.map((code) => {
      const i = CODES.indexOf(code);
      const exams = index === 3 ? [{ points: 6, max: 10, gradedAt: at("2026-10-01") }, { points: 8, max: 10, gradedAt: at("2026-09-24") }] : index === 5 ? [] : [{ points: 8 - (index % 3), max: 10, gradedAt: at("2026-10-02") }, { points: 7 - (index % 2), max: 10, gradedAt: at("2026-09-26") }];
      const state: Readiness["state"] = index === 2 ? "100" : index === 0 ? "90" : index === 3 ? "below_80" : index === 5 ? "not_available" : "80";
      return { code, total: code === "german" ? 200 : 200, answered: 60 + index * 17 + i * 9, mastered: 35 + index * 9 + i * 4, checked30: 40 + index * 5, correct30: Math.round((40 + index * 5) * acc[i] / 100), exams, open: index === 0 && code === "mathematics" ? 1 : 0, readiness: readiness(state, state === "not_available" ? 1 : 3, index === 3 ? 4 : 1) };
    }),
  }));
}
function profileSubject(code: SubjectCode): ProfileSubject {
  const areas = AREAS[code].map((area, index) => ({ area, ordinal: index + 1, total: 20, answered: [14, 9, 17, 8, 12, 15, 6, 4, 3, 2][index % 10], correct: [11, 5, 15, 5, 5, 11, 3, 3, 2, 1][index % 10] }));
  return {
    code, total: 200, answered: 142, checked: 138, correct: 96, checked30: 64, correct30: 44, mastered: 97, areas,
    persistentErrors: code === "mathematics" ? [{ questionVersionId: Q.q553.questionVersionId, recordKey: "MAT-5.5.3", wrong: 3, lastAt: at("2026-10-03", "18:20") }, { questionVersionId: "pe2", recordKey: "MAT-5.7.3", wrong: 2, lastAt: at("2026-10-01", "19:00") }] : [],
    exams: [
      { id: "pe1", status: "graded", kind: "full", positions: null, sent: false, submittedAt: at("2026-09-26", "17:00"), gradedAt: at("2026-09-27"), points: 7, max: 10, auto: false, minutesUsed: 52, minutes: 60, emptyUnits: 1, units: 10 },
      { id: "pe2", status: "graded", kind: "full", positions: null, sent: true, submittedAt: at("2026-10-02", "17:00"), gradedAt: at("2026-10-03"), points: 8, max: 10, auto: false, minutesUsed: 47, minutes: 60, emptyUnits: 0, units: 10 },
      { id: "pe3", status: "graded", kind: "part", positions: [5, 6, 7], sent: true, submittedAt: at(TODAY, "09:18"), gradedAt: at(TODAY, "11:00"), points: 2, max: 3, auto: false, minutesUsed: 18, minutes: 20, emptyUnits: 0, units: 3 },
    ],
    readiness: readiness("90", 3, 2),
  };
}
function profile(codes: SubjectCode[], support: boolean, visibility: "author" | "support" = "author"): StudentProfile {
  const days = Array.from({ length: 60 }, (_, index) => {
    const date = new Date(`${TODAY}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - index);
    return { day: date.toISOString().slice(0, 10), answers: [7, 0, 4, 12, 0, 3, 9, 0, 0, 6][index % 10] };
  }).filter((day) => day.answers > 0);
  return {
    personId: STUDENTS[0].personId, name: STUDENTS[0].name, lastActivity: at(TODAY, "08:40"), days, missions30: support ? 14 : null, today: TODAY,
    subjects: codes.map(profileSubject),
    notes: support ? [
      { id: "sn1", kind: "student_talk", body: "Razgovor o planu vježbe: dogovor 15 minuta Matematike svaki dan nakon nastave.", followUpOn: "2026-10-11", visibility: "support", createdAt: at("2026-10-01", "12:30"), author: "Adnana Agić", own: false },
      { id: "sn2", kind: "observation", body: "Aktivnost porasla nakon dogovora; nastaviti praćenje.", followUpOn: null, visibility: "author", createdAt: at("2026-10-03", "13:10"), author: "Medina Karaga", own: true },
    ] : [],
    canWriteNotes: support, defaultVisibility: visibility,
  };
}

// ---------- director ----------
function director(tab: string): DirectorData {
  switch (tab) {
    case "predmeti":
      return { tab, minGroup: 3, subjects: CODES.map((code, index) => ({ code, trusted: [200, 200, 188][index], students: 24, covered: [61, 58, 49][index], checked: [1840, 2210, 1525][index], correct: [1270, 1460, 1130][index], readiness: { "100": 3, "90": 7, "80": 6, below_80: 5, not_available: 3 }, examPoints: [{ points: 6, exams: 4 }, { points: 7, exams: 6 }, { points: 8, exams: 7 }, { points: 9, exams: 3 }], gradedExams: 20 })) };
    case "nastavnici":
      return { tab, teachers: CODES.map((code, index) => ({ name: TEACHERS[code], subjects: [code], recordsReviewed: [200, 200, 188][index], rulesReviewed: 7, answersReviewed: [24, 31, 12][index], setsApproved: [18, 15, 9][index], examsGraded: [16, 14, 8][index], assignmentsGiven: [5, 4, 3][index], giftsGiven: [3, 2, 2][index], notesWritten: [6, 4, 3][index], waitingAnswers: [1, 0, 2][index], waitingExams: [1, 0, 1][index] })) };
    case "sadrzaj":
      return { tab, minGroup: 3, content: CODES.map((code, index) => ({ code, records: [200, 220, 200][index], accepted: [200, 200, 188][index], returned: [0, 0, 6][index], textRevisions: [0, 5, 0][index], errataOpen: [0, 0, 1][index], followUpsOpen: [0, 1, 1][index], blueprint: { version: "2026-10-02", loadedAt: at("2026-10-02", "11:00"), review: index === 2 ? null : { decision: "confirmed", by: TEACHERS[code], at: at("2026-10-03", "12:30") } }, chunks: [180, 210, 190][index], embeddings: [180, 210, 190][index], missed: [{ key: code === "mathematics" ? "MAT-5.5.3" : code === "german" ? "DEU-4.3.12" : "BHS-PRA.4", wrong: 14, students: 8 }] })) };
    case "sistem":
      return { tab, push: { state: "on" }, system: { jobs: [{ state: "succeeded", profile: "mathematics", finishedAt: at("2026-09-27", "16:00"), pages: 40 }, { state: "succeeded", profile: "bhs", finishedAt: at("2026-09-27", "16:05"), pages: 38 }, { state: "succeeded", profile: "german", finishedAt: at("2026-09-27", "16:09"), pages: 44 }], security: { login_failed: 3 }, chunks: 580, embeddings: 580, indexBuiltAt: at("2026-10-01", "10:00"), notificationKinds: "mock_exam_requested,mock_exam_submitted,mock_exam_graded,assignment_given,gift_given,mock_exam_assigned", migrations: [{ version: "20261004163000", name: "036_mock_exam_assigned_notifications" }, { version: "20261004142444", name: "035_teacher_sent_tests_part3" }, { version: "20261004111850", name: "030_assignment_notifications" }] } };
    case "dnevnik":
      return { tab, pageSize: 50, filter: { action: null, person: null, from: null, to: null, page: 1 }, audit: { total: 3, actions: ["exam.set_approve", "assignment.create", "support.profile_view"], people: [{ id: "p1", name: TEACHERS.mathematics }, { id: "p2", name: "Adnana Agić" }], rows: [
        { id: 3, at: at(TODAY, "08:10"), action: "exam.set_approve", actor: TEACHERS.mathematics, entityType: "mock_exam", entityId: "e2000000-0000-4000-8000-000000000001", details: {}, ip: null },
        { id: 2, at: at(TODAY, "07:58"), action: "support.profile_view", actor: "Adnana Agić", entityType: "person", entityId: STUDENTS[3].personId, details: {}, ip: null },
        { id: 1, at: at("2026-10-03", "14:30"), action: "assignment.create", actor: TEACHERS.mathematics, entityType: "assignment", entityId: "a5000000-0000-4000-8000-000000000001", details: {}, ip: null },
      ] } };
    default:
      return { tab: "pregled", overview: { minGroup: 3, studentsActive: 24, studentsPractised: 21, answers: 5575, weeks: [{ week: "2026-09-14", students: 15, answers: 820 }, { week: "2026-09-21", students: 19, answers: 1240 }, { week: "2026-09-28", students: 21, answers: 1890 }], exams: { requested: 41, submitted: 37, graded: 34 }, assignments: { given: 12, recipients: 180, states: { open: 46, complete: 112, late: 9, missed: 13 } }, gifts: 7 } };
  }
}

// ---------- screens ----------
type Params = { params: Promise<{ screen: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function GuideScreen({ params, searchParams }: Params): Promise<ReactNode> {
  const { screen } = await params;
  const query = await searchParams;
  const code = (CODES.find((entry) => entry === query.predmet) ?? "mathematics") as SubjectCode;
  switch (screen) {
    case "pocetna-nastavnik":
      return <AccountHome account={{ displayName: TEACHERS[code], role: "administrator" }} canViewAccounts={false} canViewCanon canOpenReview canManageSettings={false} canGrade canMonitor canAssign canDirect={false} />;
    case "pocetna-podrska":
      return <AccountHome account={{ displayName: query.ime ?? "Adnana Agić", role: "administrator" }} canViewAccounts={false} canViewCanon={false} canOpenReview={false} canManageSettings={false} canGrade={false} canMonitor canAssign={false} canDirect={false} />;
    case "pocetna-direktor":
      return <AccountHome account={{ displayName: "Davor Mulalić", role: "superadmin" }} canViewAccounts canViewCanon canOpenReview canManageSettings canGrade canMonitor canAssign canDirect />;
    case "nalog":
      return <OwnAccountScreen displayName={query.ime ?? TEACHERS[code]} username={query.korisnik ?? "haris.hamzic@idss.ba"} minLength={Number(query.min ?? 12)} />;

    case "hub":
      return <GameHub displayName="Lana Begić" overview={{ areas: CODES.flatMap(areaProgress), days: [TODAY, "2026-10-03", "2026-10-02", "2026-10-01"], today: 3, todayDate: TODAY }} dailyGoal={DEFAULT_APP_SETTINGS.missionGoal} notifications={studentNotifications} gamification={{ xp: { answers: 1840, missions: 280, practiceDays: 95, examsSubmitted: 90, examsGraded: 230 }, badges: { firstAnswer: true, streak: true, answersInSubject: ["mathematics"], firstMockExam: ["mathematics", "german"], allSubjects: false } }} badgeRules={{ streakDays: DEFAULT_APP_SETTINGS.gamification.badges.streak_days, answersInSubject: DEFAULT_APP_SETTINGS.gamification.badges.answers_in_subject }} assignments={studentAssignments} gifts={studentGifts} />;
    case "predmet":
      return <SubjectScreen code="mathematics" areas={areaProgress("mathematics")} />;
    case "vjezba":
      return <PracticeScreen code="mathematics" areaId={Q.q553.areaId} question={Q.q553} />;
    case "vjezba-rezultat":
      return <PracticeScreen code="mathematics" areaId={Q.q553.areaId} question={Q.q553} initialResult={{ success: true, data: { outcome: "correct", itemsChecked: 1, itemsCorrect: 1, results: [{ item: null, mode: "choice", response: "c", correct: true, solution: KEYS["MAT-5.5.3"] }], errata: [] } }} />;
    case "vjezba-zadatak":
      return <PracticeScreen code="mathematics" areaId={null} question={Q.q562} assignment={{ id: studentAssignments[0].id, title: studentAssignments[0].title, answered: 3, total: 8 }} />;
    case "ispiti":
      return <ExamOverviewScreen overview={{ subjects: [
        { subjectId: SUBJECT_IDS.bhs_language_literature, subjectCode: "bhs_language_literature", available: true, minutes: 60, totalPoints: 10, openExamId: null, openStatus: null, openKind: null, openSent: false },
        { subjectId: SUBJECT_IDS.mathematics, subjectCode: "mathematics", available: true, minutes: 60, totalPoints: 10, openExamId: "e1000000-0000-4000-8000-000000000002", openStatus: "approved", openKind: "part", openSent: true },
        { subjectId: SUBJECT_IDS.german, subjectCode: "german", available: false, minutes: 60, totalPoints: 10, openExamId: null, openStatus: null, openKind: null, openSent: false },
      ], exams: [
        { id: "e1000000-0000-4000-8000-000000000002", subjectCode: "mathematics", status: "approved", kind: "part", positions: [5, 6, 7], sent: true, createdAt: at(TODAY, "08:00"), submittedAt: null, gradedAt: null, maxPoints: 3, totalPoints: null },
        { id: "e1000000-0000-4000-8000-000000000001", subjectCode: "mathematics", status: "graded", kind: "full", positions: null, sent: false, createdAt: at("2026-10-01", "15:00"), submittedAt: at("2026-10-01", "15:58"), gradedAt: at("2026-10-02", "09:30"), maxPoints: 10, totalPoints: 8 },
      ] }} />;
    case "ispit-ceka":
      return <ExamScreen exam={examView("awaiting_approval", {}, partUnits(false, false), [Q.q558, Q.q5612, Q.q553])} />;
    case "ispit-pocetak":
      return <ExamScreen exam={examView("approved", partOverrides, partUnits(false, false), [Q.q558, Q.q5612, Q.q553])} />;
    case "ispit-pisanje":
      return <ExamScreen exam={examView("in_progress", { ...partOverrides, startedAt: minutesFromNow(-6), deadlineAt: minutesFromNow(14) }, partUnits(true, false).map((entry, index) => (index === 2 ? { ...entry, response: "" } : entry)), [Q.q558, Q.q5612, Q.q553])} />;
    case "ispit-rezultat":
      return <ExamScreen exam={examView("graded", { ...partOverrides, startedAt: at(TODAY, "09:00"), submittedAt: at(TODAY, "09:18"), gradedAt: at(TODAY, "11:00"), totalPoints: 2 }, partUnits(true, true), [Q.q558, Q.q5612, Q.q553])} />;
    case "vitrina":
      return <VitrinaScreen gifts={studentGifts} />;

    case "ocjenjivanje":
      return <GradingHomeScreen blueprints={[blueprintFor(code, query.potvrdjen === "1")]} queue={queue(code)} reviewable={[SUBJECT_IDS[code]]} canLoad={false} notifications={teacherNotifications(code)} practiceWaiting={2} />;
    case "posalji":
      return <SendTestScreen options={[sendOptions(code)]} students={STUDENTS} sent={[{ id: "s1", subjectCode: code, kind: "part", positions: code === "mathematics" ? [5, 6, 7] : code === "german" ? [3] : [1, 2, 3], minutes: code === "mathematics" ? 20 : 10, note: code === "mathematics" ? "Ponovite algebarske razlomke prije vježbe." : code === "german" ? "Wiederholt den Wortschatz." : "Ponovite historiju jezika.", audience: "chosen", createdAt: at(TODAY, "08:00"), sentBy: TEACHERS[code], states: { awaiting_approval: 1, approved: 1 }, sets: [{ id: "x1", student: "Dino Šabić", status: "awaiting_approval", points: null, max: 3 }, { id: "x2", student: "Lana Begić", status: "approved", points: null, max: 3 }] }]} preset={{ subject: query.predmet ?? null, student: query.ucenik ?? null, area: query.oblast ?? null }} />;
    case "set-odobrenje":
      return <GradingExamScreen exam={gradingView(code, "awaiting_approval")} />;
    case "ocjenjivanje-ispita":
      return <GradingExamScreen exam={gradingView(code, "submitted")} />;
    case "odgovori-vjezba":
      return <PracticeReviewScreen entries={[{ id: "pr1", submittedAt: at(TODAY, "08:35"), student: "Tarik Mehić", subjectCode: "mathematics" as SubjectCode, question: Q.q558, responses: [{ item: null, response: "(x−1)(x+1) / (x+1)(x+1) = (x−1)/(x+1)" }], keys: [{ item: null, key: KEYS["MAT-5.5.8"] }], errata: [] }].map((entry) => (code === "mathematics" ? entry : { ...entry, subjectCode: code, question: SUBJECT_QUESTIONS[code][0], responses: [{ item: code === "german" ? 1 : null, response: code === "german" ? "c" : "a" }], keys: [{ item: code === "german" ? 1 : null, key: keyOf(SUBJECT_QUESTIONS[code][0].questionVersionId) ?? "" }] }))} />;
    case "pracenje-nastavnik":
      return <SupportOverviewScreen students={overviewStudents([code])} codes={[code]} today={TODAY} followUps={null} canExport />;
    case "profil-nastavnik":
      return <StudentProfileScreen profile={profile([code], false)} teacherNotes={[{ id: "tn1", subject: code, body: "Ponoviti proširivanje i skraćivanje razlomaka; na sljedećem času provjera.", createdAt: at("2026-10-03", "12:00"), author: TEACHERS[code], own: true }]} assignments={[{ id: studentAssignments[0].id, subject: code, title: ASSIGNMENT_TITLES[code][0], dueAt: studentAssignments[0].dueAt, author: TEACHERS[code], total: 8, answered: 3, correct: 2, completedAt: null, state: "open" }]} gifts={[{ ...studentGifts[0], own: true }]} canGiveGifts shortcuts={{ assign: [code], send: [code] }} />;
    case "dan":
      return <DailySummaryScreen canGrade={query.uloga !== "podrska"} canExport summary={{ day: "2026-10-03", today: TODAY, subjects: (query.uloga === "podrska" ? CODES : [code]).map((entry) => ({ code: entry, practised: STUDENTS.slice(0, 4).map((student, index) => ({ personId: student.personId, name: student.name, answers: [12, 7, 15, 4][index], checked: [12, 6, 15, 4][index], correct: [9, 4, 13, 2][index] })), notPractised: [{ personId: STUDENTS[4].personId, name: STUDENTS[4].name, lastPractice: at("2026-10-02", "18:30") }, { personId: STUDENTS[5].personId, name: STUDENTS[5].name, lastPractice: at("2026-09-22", "17:45") }], areas: AREAS[entry].slice(0, 3).map((area, index) => ({ area, ordinal: index + 1, checked: [9, 14, 6][index], correct: [4, 10, 5][index] })), examsSubmitted: 1, waitingAnswers: 2, waitingExams: 1 })) }} />;
    case "zadaci":
      return <AssignmentsHomeScreen preset={{ subject: query.predmet ?? null, student: query.ucenik ?? null, area: query.oblast ?? null }} options={{ subjects: [{ code, areas: AREAS[code].map((label, index) => ({ id: areaId(code, index + 1), label, ordinal: index + 1 })) }], students: STUDENTS }} assignments={[
        { id: studentAssignments[0].id, subject: code, title: ASSIGNMENT_TITLES[code][0], dueAt: at("2026-10-09", "20:00"), createdAt: at("2026-10-03", "14:30"), audience: "all", author: TEACHERS[code], questions: 8, withdrawn: false, states: { open: 14, complete: 8, late: 1 } },
        { id: "a5000000-0000-4000-8000-000000000003", subject: code, title: ASSIGNMENT_TITLES[code][1], dueAt: at("2026-10-02", "20:00"), createdAt: at("2026-09-29", "10:00"), audience: "chosen", author: TEACHERS[code], questions: 5, withdrawn: false, states: { complete: 4, missed: 1 } },
      ]} />;
    case "zadatak":
      return <AssignmentDetailScreen canExport canOpenProfiles assignment={{ id: studentAssignments[0].id, subject: code, title: ASSIGNMENT_TITLES[code][0], instruction: code === "german" ? "Lies genau und prüfe deine Antwort." : "Riješi pažljivo i provjeri odgovor.", dueAt: at("2026-10-09", "20:00"), createdAt: at("2026-10-03", "14:30"), audience: "all", author: TEACHERS[code], withdrawal: null, questions: ASSIGNMENT_KEYS[code].map((key, index) => ({ id: `q${index}`, key })), recipients: STUDENTS.map((student, index) => ({ ...student, total: 8, answered: [3, 8, 8, 0, 5, 1][index], correct: [2, 7, 6, 0, 3, 1][index], completedAt: [null, at("2026-10-04", "07:30"), at("2026-10-03", "19:00"), null, null, null][index], state: (["open", "complete", "complete", "open", "open", "open"] as const)[index] })) }} />;
    case "pregled":
      return <ReviewQueueScreen subjects={[{ id: SUBJECT_IDS[code], code }]} selected={code} filter="all" hasQueue counts={{ pending: code === "german" ? 6 : 0, returned: 0, accepted: code === "german" ? 188 : 200 }} items={(code === "german" ? ["DEU-4.3.30", "DEU-4.3.31", "DEU-4.3.32", "DEU-4.3.33", "DEU-4.3.34", "DEU-4.3.35"] : code === "bhs_language_literature" ? ["BHS-HIS.1", "BHS-HIS.2", "BHS-HIS.3", "BHS-HIS.4", "BHS-HIS.5", "BHS-HIS.6"] : ["MAT-5.5.1", "MAT-5.5.2", "MAT-5.5.3", "MAT-5.5.4", "MAT-5.5.5", "MAT-5.5.6"]).map((key, index) => ({ recordId: 100 + index, recordKey: key, ordinal: index + 1, recordKind: "task", structuralStatus: "passed", taskType: "multiple_choice_single_answer", area: code === "german" ? "WORTSCHATZ" : code === "bhs_language_literature" ? "HISTORIJA JEZIKA" : "Algebarski razlomci", state: code === "german" ? "pending" : "accepted" }))} page={1} pages={1} noSubjects={false} keyQuery="" notices={code === "german" ? [{ recordId: 104, recordKey: "DEU-4.3.34", kind: "erratum", assignee: null, at: at("2026-10-02", "10:00") }] : []} />;

    case "pracenje":
      return <SupportOverviewScreen students={overviewStudents(CODES)} codes={CODES} today={TODAY} followUps={[{ personId: STUDENTS[0].personId, student: STUDENTS[0].name, followUpOn: "2026-10-11", kind: "student_talk" }, { personId: STUDENTS[3].personId, student: STUDENTS[3].name, followUpOn: "2026-10-06", kind: "parent_talk" }]} canExport />;
    case "profil":
      return <StudentProfileScreen profile={profile(CODES, true, query.uloga === "pedagog" ? "support" : "author")} teacherNotes={[{ id: "tn1", subject: "mathematics", body: "Ponoviti proširivanje i skraćivanje razlomaka; na sljedećem času provjera.", createdAt: at("2026-10-03", "12:00"), author: TEACHERS.mathematics, own: false }]} assignments={[{ id: studentAssignments[0].id, subject: "mathematics", title: studentAssignments[0].title, dueAt: studentAssignments[0].dueAt, author: TEACHERS.mathematics, total: 8, answered: 3, correct: 2, completedAt: null, state: "open" }]} gifts={studentGifts} canGiveGifts={false} shortcuts={{ assign: [], send: [] }} />;
    case "analiza":
      return <GroupAnalysisScreen codes={CODES} canExport patterns={{ students: 24, weeks: [{ week: "2026-09-14", students: 15, answers: 820 }, { week: "2026-09-21", students: 19, answers: 1240 }, { week: "2026-09-28", students: 21, answers: 1890 }], areas: CODES.flatMap((entry) => AREAS[entry].slice(0, 4).map((area, index) => ({ subject: entry, area, ordinal: index + 1, checked: [120, 96, 140, 80][index], correct: [70, 61, 118, 41][index] }))), examPoints: [{ subject: "mathematics", points: 6, exams: 4 }, { subject: "mathematics", points: 7, exams: 6 }, { subject: "mathematics", points: 8, exams: 7 }, { subject: "mathematics", points: 9, exams: 3 }], missedQuestions: [{ subject: "mathematics", recordKey: "MAT-5.5.3", wrong: 14, students: 8 }, { subject: "german", recordKey: "DEU-4.3.12", wrong: 9, students: 6 }] }} />;

    case "direktor":
      return <DirectorScreen data={director(query.tab ?? "pregled")} period="30" hasSchoolYear canAudit />;
    case "nalozi":
      return <AccountsScreen actorUserId="d0000000-0000-4000-8000-000000000001" canManage canResetPassword editableUserIds={["t1000000-0000-4000-8000-000000000001", "s1000000-0000-4000-8000-000000000001"].map((id) => id.replace(/^[ts]1/, "a1"))} subjects={CODES.map(subject)} accounts={[
        { userId: "d0000000-0000-4000-8000-000000000001", username: "direktor@idss.ba", displayName: "Davor Mulalić", role: "superadmin", status: "active", bundles: [], teachesSubjectIds: [], createdAt: at("2026-09-27") },
        { userId: "a1000000-0000-4000-8000-000000000001", username: "haris.hamzic@idss.ba", displayName: TEACHERS.mathematics, role: "administrator", status: "active", bundles: [], teachesSubjectIds: [SUBJECT_IDS.mathematics], createdAt: at("2026-09-28") },
        { userId: "a1000000-0000-4000-8000-000000000002", username: "pedagog@idss.ba", displayName: "Adnana Agić", role: "administrator", status: "active", bundles: ["pedagogue"], teachesSubjectIds: [], createdAt: at("2026-09-28") },
        { userId: "a1000000-0000-4000-8000-000000000003", username: "lana.begic", displayName: "Lana Begić", role: "student", status: "active", bundles: [], teachesSubjectIds: [], createdAt: at("2026-10-01") },
      ]} />;
    case "postavke":
      return <SettingsScreen palette={DEFAULT_SPLASH_SHARES} app={{ missionGoal: DEFAULT_APP_SETTINGS.missionGoal, minGroup: DEFAULT_APP_SETTINGS.minGroup, gamification: DEFAULT_APP_SETTINGS.gamification, history: { "mission.daily_goal": [], "privacy.min_group": [], "gamification.values": [] } }} />;
    default:
      notFound();
  }
}
