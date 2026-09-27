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
