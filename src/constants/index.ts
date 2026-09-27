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
