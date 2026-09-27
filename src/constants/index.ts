/**
 * Global named constants (Commander E-11: no magic numbers).
 * Canon-dependent values (exam duration, points, subjects …) must NEVER be added here —
 * they are data derived from the active canonical document version (CONSTITUTION P-3).
 */

/** Supported interface languages (AMB-11, AMB-14). Bosnian is the default (mandate §16). */
export const SUPPORTED_LOCALES = ["bs", "de", "en"] as const;
export const DEFAULT_LOCALE = "bs";

/** Preference cookie holding the chosen interface language (not an auth cookie). */
export const LOCALE_COOKIE_NAME = "ege_locale";
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Splash timing (mandate §7A.8). Minimum raised by 4 s at the Director's request (2026-09-27); the splash can always be skipped. */
export const SPLASH_MIN_VISIBLE_MS = 5800;
/** Fail-safe: the splash leaves even if the app never signals readiness. */
export const SPLASH_MAX_VISIBLE_MS = 12000;
/** Interval between motivational messages while the splash is visible. */
export const SPLASH_MESSAGE_ROTATE_MS = 3200;

/** Public paths of the static splash module and brand assets (see public/splash, public/brand). */
export const SPLASH_SCRIPT_PATH = "/splash/splash.js";
export const SPLASH_STYLESHEET_PATH = "/splash/splash.css";
export const BRAND_LOGO_PATH = "/brand/idss-logo.png";
export const BRAND_LOGO_WIDTH_PX = 1460;
export const BRAND_LOGO_HEIGHT_PX = 443;

/** Authentication (mandate §7A.5, PDL-003). */
/** Supabase Auth needs an e-mail; students have none (AMB-06), so their username maps to this reserved domain. */
export const STUDENT_AUTH_EMAIL_DOMAIN = "students.idss-ege.invalid";
/** Failed attempts for one username inside the window before further attempts are refused. */
export const LOGIN_MAX_FAILURES_PER_USERNAME = 5;
/** Failed attempts from one IP address inside the window before further attempts are refused. */
export const LOGIN_MAX_FAILURES_PER_IP = 20;
export const LOGIN_FAILURE_WINDOW_MINUTES = 15;
/** Session cookie lifetime; Supabase refresh tokens are rotated inside it. */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;
/** Route of the login page and of the signed-in area. */
export const LOGIN_PATH = "/prijava";
export const APP_HOME_PATH = "/app";
/** Minimum password length for staff accounts set by the bootstrap and admin flows. */
export const STAFF_PASSWORD_MIN_LENGTH = 12;
/** Minimum password length for student accounts — Director decision 2026-09-27 (AMB-15). */
export const STUDENT_PASSWORD_MIN_LENGTH = 10;
/** Upper bound of rows on the account screen (A-3: every list query is bounded). */
export const ACCOUNT_LIST_LIMIT = 500;
/** Route of the account administration screen. */
export const ACCOUNTS_PATH = "/app/nalozi";

/** Canon registry (Sprint 02, migration 006). */
export const CANON_PATH = "/app/kanon";
/** Review of ingested records and canonical rules by subject teachers (Sprint 04). */
export const REVIEW_PATH = "/app/pregled";
/** Records per page of the review queue (A-3: every list is bounded). */
export const REVIEW_PAGE_SIZE = 25;
/** Longest reason, note or evidence text a reviewer may enter (matches the migration 008 checks). */
export const REVIEW_TEXT_MAX_LENGTH = 2000;
/** Browser cache lifetime of a source PDF served for review (the file never changes per version). */
export const REVIEW_SOURCE_MAX_AGE_SECONDS = 3600;
/** Context around a record's region in the source view, in PDF points. */
export const REVIEW_REGION_MARGIN_POINTS = 12;
/** Render scale of source pages (device pixels per PDF point before devicePixelRatio). */
export const REVIEW_RENDER_SCALE = 1.5;
/** Outline of the record's region on a whole-page source view (drawn on canvas, where CSS tokens do not apply). */
export const REVIEW_REGION_STROKE = "rgba(200, 30, 30, 0.9)";
/** Longest question text or stem a reviewed text revision may carry (matches the migration 013 checks). */
export const QUESTION_TEXT_MAX_LENGTH = 20000;

/** Staff search over trusted canon (Sprint 05, retrieval foundation). */
export const SEARCH_PATH = "/app/pretraga";
/** Results per search (the database bounds k to 10). */
export const RETRIEVAL_RESULT_COUNT = 8;
/** Query length bounds (the database enforces the same). */
export const RETRIEVAL_QUERY_MIN_LENGTH = 2;
export const RETRIEVAL_QUERY_MAX_LENGTH = 500;
/**
 * Relevance floor: a chunk counts as evidence when it contains at least this many of the query's content words
 * (rank = matched words + full-text rank, migration 011). Below it the answer is the fixed refusal.
 */
export const RETRIEVAL_MIN_RANK = 1;
/**
 * Semantic search (PDL-023): Gemini embedding model, verified 27.09.2026 (gemini-embedding-2, generally available;
 * task instructions go into the text, taskType is ignored by this model). Changing the model re-embeds the index.
 */
export const EMBEDDING_MODEL = "gemini-embedding-2";
/** Vector size (matches migration 015; 768 is one of the sizes the model recommends). */
export const EMBEDDING_DIMENSIONS = 768;
/** Texts per batchEmbedContents request and per stored batch. */
export const EMBEDDING_BATCH_SIZE = 50;
/** Pending passages read per round of an index build (failed ones are set aside within the round). */
export const EMBEDDING_PENDING_WINDOW = 200;
/** Longest wait for one Gemini request. */
export const EMBEDDING_TIMEOUT_MS = 30000;
/** Time budget of one "build semantic index" click; the rest continues with the next click. */
export const EMBEDDING_BUILD_BUDGET_MS = 45000;
/**
 * A semantic result counts as evidence when no content word matched only if its similarity lies at least this many
 * standard deviations above the similarity of all passages in scope for the same query (migration 016). Gemini vectors
 * are all close (unrelated passages 0.74 median), so an absolute floor cannot work. Measured 27.09.2026 on the live
 * index: the nearest related passage stands out by 3.39 (median; 5th percentile 2.61, 95th 4.79), while the best of
 * about 500 unrelated passages lies near 3 by chance. 4.0 accepts only clearly outstanding passages and relies on
 * word matches otherwise; retuned from the top values recorded per search (PDL-023).
 */
export const RETRIEVAL_MIN_SIMILARITY_Z = 4;

/**
 * Grounded answers (PDL-025): Gemini text model that turns the question into search terms in Bosnian, German and
 * English and answers only from the retrieved sources. Verified 27.09.2026: gemini-3.8-flash is generally available.
 * GEMINI_ANSWER_MODEL in .env.local overrides it without a code change.
 */
export const ANSWER_MODEL = "gemini-3.8-flash";
/** Longest wait for one answer-model request. */
export const ANSWER_TIMEOUT_MS = 30000;
/** Most search terms taken from the query translation. */
export const QUERY_TERMS_MAX = 12;
/** Passages given to the answer model (the database bounds k to 10). */
export const ANSWER_CANDIDATE_COUNT = 10;

/** Footer: product owner contact and the legal documents (Director, 2026-09-27; texts pending, AMB-20). */
export const CONTACT_EMAIL = "ai@idss.ba";
export const LEGAL_DOCUMENTS = [
  { key: "terms", path: "/uslovi-koristenja" },
  { key: "privacy", path: "/politika-privatnosti" },
  { key: "subscription", path: "/pretplata" },
  { key: "cookies", path: "/kolacici" },
] as const;

/** Own account page: every signed-in user changes their own password here (Sprint 06). */
export const OWN_ACCOUNT_PATH = "/app/nalog";

/** Application settings for the Superadmin (PDL-020). */
export const SETTINGS_PATH = "/app/postavke";
/** Public, unauthenticated route the splash reads its palette from (outside the auth proxy, like /splash/*). */
export const SPLASH_PALETTE_PATH = "/splash/palette";
/** Browser and CDN cache of the splash palette; a change shows within this time. */
export const SPLASH_PALETTE_MAX_AGE_SECONDS = 60;
/** Private storage bucket for canonical source files (created by migration 006). */
export const CANON_BUCKET = "canon-documents";
/** Same limit as the bucket (and the Supabase project upload limit): 50 MB. */
export const CANON_MAX_BYTES = 52_428_800;
/** Only PDF sources are accepted (checked by magic bytes, never by name or browser type). */
export const CANON_MIME_TYPE = "application/pdf";
/** Uploads land here first and are moved to CANON_SOURCES_PREFIX after server-side verification. */
export const CANON_STAGING_PREFIX = "staging/";
export const CANON_SOURCES_PREFIX = "sources/";
/** Lifetime of a signed download link for a canonical source file. */
export const CANON_DOWNLOAD_URL_TTL_SECONDS = 60;
/** Upper bound of documents on the registry screen (A-3). */
export const CANON_DOCUMENT_LIST_LIMIT = 200;
/** Maximum length of a lifecycle reason (matches the database check). */
export const CANON_REASON_MAX_LENGTH = 500;
/** Staging uploads older than this were abandoned (never registered) and are removed. */
export const CANON_STAGING_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Upper bound of staging objects inspected per clean-up (A-3). */
export const CANON_STAGING_LIST_LIMIT = 1000;

/** Student practice (Sprint 06, migration 017). */
export const PRACTICE_PATH = "/app/vjezba";
/** Subject page of the Game Hub: areas with progress. */
export const SUBJECT_PATH = "/app/predmet";
/** Longest answer a student may type into an open task (matches migration 017). */
export const PRACTICE_RESPONSE_MAX_LENGTH = 4000;
/** Daily mission v1 (PDL-024): answers per day. A learning goal, never a grade (P-7). */
export const DAILY_MISSION_GOAL = 5;
