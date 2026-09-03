// This page must always act as a pure anonymous visitor, even if this
// browser previously logged into the staff console (staff.html shares the
// same origin, so a staff session in localStorage would otherwise "leak"
// into this page and make Supabase send the staff's auth token instead of
// the anon key — the `authenticated` role has no INSERT policy on `leads`,
// so registrations would silently fail with an RLS error).
const publicClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const form = document.getElementById("lead-form");
const errorEl = document.getElementById("form-error");
const submitBtn = document.getElementById("submit-btn");
const formView = document.getElementById("form-view");
const tokenView = document.getElementById("token-view");
const tokenValueEl = document.getElementById("token-value");
const tokenNameEl = document.getElementById("token-name");

const UNIQUE_VIOLATION = "23505";
const MAX_ATTEMPTS = 6;
const DUPLICATE_MESSAGE = "This phone number or email is already registered for this event.";
const INVALID_PHONE_MESSAGE = "Please enter a valid Bangladesh mobile number, e.g. 01712345678.";
const INVALID_EMAIL_MESSAGE = "Please enter a valid email address.";
const DISPOSABLE_EMAIL_MESSAGE = "Temporary/disposable email addresses aren't allowed — please use a real one.";
const STORAGE_KEY = "ctb_event_registration";

// Disify's free, keyless endpoint (30 req/min, plenty for this form) — flags
// malformed addresses, disposable/temp-mail domains, and domains with no
// mail server configured at all (dns: false). It can't confirm the specific
// mailbox exists (that needs paid SMTP-level verification), only that the
// domain is real and syntax is valid. If the check itself is unreachable,
// we fail open rather than block a real registration over a third-party
// outage.
async function checkEmailDeliverable(email) {
  try {
    const res = await fetch(`https://disify.com/api/email/${encodeURIComponent(email)}`);
    if (!res.ok) return { ok: true };
    const data = await res.json();
    if (data.format === false) return { ok: false, reason: "invalid" };
    if (data.disposable === true) return { ok: false, reason: "disposable" };
    if (data.dns === false) return { ok: false, reason: "invalid" };
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

// Soft, same-device/browser check. Not a security boundary (the phone/email
// uniqueness enforced by the database is) — this just avoids someone
// accidentally re-submitting from the same phone, and lets them recover
// their code if they reload the page.
function getSavedRegistration() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveRegistration(name, token) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, token }));
  } catch {
    // localStorage unavailable (private mode, etc.) — nothing to do,
    // the database-level uniqueness still protects against duplicates.
  }
}

const phoneInput = document.getElementById("phone");

// The +88 prefix is fixed in the UI; the field holds the number exactly as
// Bangladeshis normally write it locally: 01XXXXXXXXX (11 digits, leading 0,
// operator prefix 3-9) — e.g. Grameenphone/Robi/Banglalink/Teletalk.
const BD_LOCAL_RE = /^01[3-9]\d{8}$/;

// Keep the field numeric-only as the user types, without resetting the
// cursor to the end on every keystroke (which broke editing/backspacing
// in the middle of the number).
phoneInput.addEventListener("input", () => {
  const cursorPos = phoneInput.selectionStart;
  const digitsBeforeCursor = phoneInput.value.slice(0, cursorPos).replace(/\D/g, "").length;

  phoneInput.value = phoneInput.value.replace(/\D/g, "").slice(0, 11);

  const newPos = Math.min(digitsBeforeCursor, phoneInput.value.length);
  phoneInput.setSelectionRange(newPos, newPos);
});

function normalizeBDPhone(localDigits) {
  const cleaned = localDigits.replace(/\D/g, "");
  if (!BD_LOCAL_RE.test(cleaned)) return null;
  // Store in canonical international form: +8801XXXXXXXXX
  // (the leading 0 of the local number is kept as part of the digits here,
  // and +88 + 01XXXXXXXXX = +8801XXXXXXXXX).
  return `+88${cleaned}`;
}

function randomToken() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function isDuplicateContactError(error) {
  const text = `${error.message || ""} ${error.details || ""}`.toLowerCase();
  return text.includes("email") || text.includes("phone");
}

async function insertLeadWithUniqueToken(name, phone, email) {
  let lastError = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const token = randomToken();
    // No .select() here: public visitors only have INSERT on `leads`, not
    // SELECT, so asking Postgres to hand the row back would itself be
    // denied by row-level security. We already have name/token locally.
    const { error } = await publicClient
      .from("leads")
      .insert({ name, phone, email, token });

    if (!error) return { name, token };

    lastError = error;
    if (error.code !== UNIQUE_VIOLATION) break;
    if (isDuplicateContactError(error)) break;
    // otherwise it was the token that collided — loop and try a new one
  }
  throw lastError || new Error("Could not generate a unique code, please try again.");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.textContent = "";
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  const name = form.name.value.trim();
  const email = form.email.value.trim();

  const phone = normalizeBDPhone(form.phone.value.trim());
  if (!phone) {
    errorEl.textContent = INVALID_PHONE_MESSAGE;
    submitBtn.disabled = false;
    submitBtn.textContent = "Get My Code";
    return;
  }

  submitBtn.textContent = "Checking email...";
  const emailCheck = await checkEmailDeliverable(email);
  if (!emailCheck.ok) {
    errorEl.textContent = emailCheck.reason === "disposable" ? DISPOSABLE_EMAIL_MESSAGE : INVALID_EMAIL_MESSAGE;
    submitBtn.disabled = false;
    submitBtn.textContent = "Get My Code";
    return;
  }
  submitBtn.textContent = "Submitting...";

  try {
    const lead = await insertLeadWithUniqueToken(name, phone, email);
    saveRegistration(lead.name, lead.token);
    showTokenView(lead.name, lead.token, false);
  } catch (err) {
    console.error(err);
    if (err.code === UNIQUE_VIOLATION && isDuplicateContactError(err)) {
      errorEl.textContent = DUPLICATE_MESSAGE;
    } else {
      errorEl.textContent = "Something went wrong. Please try again.";
    }
    submitBtn.disabled = false;
    submitBtn.textContent = "Get My Code";
  }
});

function showTokenView(name, token, returning) {
  tokenValueEl.textContent = token;
  tokenNameEl.textContent = returning
    ? `Welcome back, ${name}! Here's your code again.`
    : `Nice to meet you, ${name}!`;
  formView.classList.add("hidden");
  tokenView.classList.remove("hidden");
}

// If this browser already registered, skip straight to the code instead of
// showing the form again (also prevents an accidental duplicate attempt).
const saved = getSavedRegistration();
if (saved) {
  showTokenView(saved.name, saved.token, true);
}
