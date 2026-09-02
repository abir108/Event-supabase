const loginView = document.getElementById("login-view");
const mainView = document.getElementById("main-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");

const tabBtnRedeem = document.getElementById("tab-btn-redeem");
const tabBtnDashboard = document.getElementById("tab-btn-dashboard");
const tabRedeem = document.getElementById("tab-redeem");
const tabDashboard = document.getElementById("tab-dashboard");

const lookupForm = document.getElementById("lookup-form");
const lookupError = document.getElementById("lookup-error");
const leadResult = document.getElementById("lead-result");
const leadNameEl = document.getElementById("lead-name");
const leadPhoneEl = document.getElementById("lead-phone");
const leadEmailEl = document.getElementById("lead-email");
const leadStatusEl = document.getElementById("lead-status");
const redeemBtn = document.getElementById("redeem-btn");

const statRegistered = document.getElementById("stat-registered");
const statRedeemed = document.getElementById("stat-redeemed");
const statPending = document.getElementById("stat-pending");
const searchInput = document.getElementById("search-input");
const refreshBtn = document.getElementById("refresh-btn");
const exportBtn = document.getElementById("export-btn");
const leadsTbody = document.getElementById("leads-tbody");

let currentLead = null;
let allLeads = [];

function showLoggedIn() {
  loginView.classList.add("hidden");
  mainView.classList.remove("hidden");
}

function showLoggedOut() {
  mainView.classList.add("hidden");
  loginView.classList.remove("hidden");
}

async function refreshSession() {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    showLoggedIn();
  } else {
    showLoggedOut();
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    loginError.textContent = "Sign-in failed. Check your email/password.";
    return;
  }
  showLoggedIn();
});

logoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  showLoggedOut();
});

/* ---------- Tabs ---------- */

function setActiveTab(tab) {
  const isRedeem = tab === "redeem";
  tabBtnRedeem.classList.toggle("active", isRedeem);
  tabBtnDashboard.classList.toggle("active", !isRedeem);
  tabRedeem.classList.toggle("hidden", !isRedeem);
  tabDashboard.classList.toggle("hidden", isRedeem);
  if (!isRedeem) loadDashboard();
}

tabBtnRedeem.addEventListener("click", () => setActiveTab("redeem"));
tabBtnDashboard.addEventListener("click", () => setActiveTab("dashboard"));

/* ---------- Redeem ---------- */

lookupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  lookupError.textContent = "";
  leadResult.classList.add("hidden");
  currentLead = null;

  const token = document.getElementById("token").value.trim();

  const { data, error } = await supabaseClient
    .from("leads")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) {
    lookupError.textContent = "No participant found with that code.";
    return;
  }

  currentLead = data;
  leadNameEl.textContent = data.name;
  leadPhoneEl.textContent = data.phone;
  leadEmailEl.textContent = data.email;

  if (data.redeemed) {
    leadStatusEl.textContent = "Already redeemed";
    leadStatusEl.className = "badge redeemed";
    redeemBtn.disabled = true;
    redeemBtn.textContent = "Already Redeemed";
  } else {
    leadStatusEl.textContent = "Pending";
    leadStatusEl.className = "badge pending";
    redeemBtn.disabled = false;
    redeemBtn.textContent = "Confirm & Give Gift";
  }

  leadResult.classList.remove("hidden");
});

redeemBtn.addEventListener("click", async () => {
  if (!currentLead || currentLead.redeemed) return;
  redeemBtn.disabled = true;
  redeemBtn.textContent = "Confirming...";

  const { data, error } = await supabaseClient
    .from("leads")
    .update({ redeemed: true, redeemed_at: new Date().toISOString() })
    .eq("id", currentLead.id)
    .eq("redeemed", false)
    .select()
    .maybeSingle();

  if (error || !data) {
    lookupError.textContent = "Could not confirm — it may have just been redeemed elsewhere.";
    redeemBtn.textContent = "Confirm & Give Gift";
    redeemBtn.disabled = false;
    return;
  }

  currentLead = data;
  leadStatusEl.textContent = "Redeemed";
  leadStatusEl.className = "badge redeemed";
  redeemBtn.textContent = "Already Redeemed";
});

/* ---------- Dashboard ---------- */

function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function renderStats(leads) {
  const redeemed = leads.filter((l) => l.redeemed).length;
  statRegistered.textContent = leads.length;
  statRedeemed.textContent = redeemed;
  statPending.textContent = leads.length - redeemed;
}

function renderTable(leads) {
  if (leads.length === 0) {
    leadsTbody.innerHTML = '<tr><td colspan="6" style="color: var(--ink-muted);">No leads yet.</td></tr>';
    return;
  }

  leadsTbody.innerHTML = leads
    .map((l) => `
      <tr>
        <td>${escapeHtml(l.name)}</td>
        <td>${escapeHtml(l.phone)}</td>
        <td>${escapeHtml(l.email)}</td>
        <td>${escapeHtml(l.token)}</td>
        <td><span class="pill ${l.redeemed ? "redeemed" : "pending"}">${l.redeemed ? "Redeemed" : "Pending"}</span></td>
        <td>${formatDateTime(l.created_at)}</td>
      </tr>
    `)
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

async function loadDashboard() {
  leadsTbody.innerHTML = '<tr><td colspan="6" style="color: var(--ink-muted);">Loading...</td></tr>';

  const { data, error } = await supabaseClient
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    leadsTbody.innerHTML = '<tr><td colspan="6" style="color: var(--error);">Failed to load leads.</td></tr>';
    return;
  }

  allLeads = data;
  renderStats(allLeads);
  applySearch();
}

function applySearch() {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = q
    ? allLeads.filter((l) =>
        [l.name, l.phone, l.email, l.token].some((field) =>
          String(field ?? "").toLowerCase().includes(q)
        )
      )
    : allLeads;
  renderTable(filtered);
}

searchInput.addEventListener("input", applySearch);
refreshBtn.addEventListener("click", loadDashboard);

exportBtn.addEventListener("click", () => {
  const rows = [["Name", "Phone", "Email", "Code", "Status", "Registered At"]];
  allLeads.forEach((l) => {
    rows.push([
      l.name,
      l.phone,
      l.email,
      l.token,
      l.redeemed ? "Redeemed" : "Pending",
      new Date(l.created_at).toISOString(),
    ]);
  });

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

refreshSession();
