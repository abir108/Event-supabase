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
const INVALID_PHONE_MESSAGE = "Please enter a valid Bangladesh mobile number, e.g. 1712345678.";

const phoneInput = document.getElementById("phone");

// The +880 prefix is fixed in the UI; the field itself only holds the local
// 10 digits: 1 followed by an operator prefix (3-9) and 8 more digits
// (Grameenphone/Robi/Banglalink/Teletalk).
const BD_LOCAL_RE = /^1[3-9]\d{8}$/;

// Keep the field numeric-only as the user types.
phoneInput.addEventListener("input", () => {
  phoneInput.value = phoneInput.value.replace(/\D/g, "").slice(0, 10);
});

function normalizeBDPhone(localDigits) {
  const cleaned = localDigits.replace(/\D/g, "");
  if (!BD_LOCAL_RE.test(cleaned)) return null;
  // Store in canonical international form: +8801XXXXXXXXX.
  return `+880${cleaned}`;
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
    const { error } = await supabaseClient
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

  try {
    const lead = await insertLeadWithUniqueToken(name, phone, email);
    tokenValueEl.textContent = lead.token;
    tokenNameEl.textContent = `Nice to meet you, ${lead.name}!`;
    formView.classList.add("hidden");
    tokenView.classList.remove("hidden");
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
