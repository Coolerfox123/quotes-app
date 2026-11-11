// Reading Quotes — all data is saved in this browser's localStorage.
const STORAGE_KEY = "reading-quotes-v1";

let state = load();
let lastQuoteId = null;

const $ = (id) => document.getElementById(id);

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && Array.isArray(data.readings)) return data;
  } catch (_) { /* fall through to empty state */ }
  return { readings: [] };
}

function saveLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {
    alert("Couldn't save — your browser may be blocking storage.");
  }
}

function save() {
  saveLocal();
  if (sync) schedulePush();
}

// ---------- GitHub sync ----------
// When connected, quotes.json in the data repo is the source of truth:
// it is loaded on start, and every change is saved back to it.

const SYNC_KEY = "reading-quotes-sync-v1";
let sync = loadSync(); // { repo: "owner/name", token } or null
let remoteSha = null;
let pushTimer = null;
let pushChain = Promise.resolve();

function loadSync() {
  try {
    const s = JSON.parse(localStorage.getItem(SYNC_KEY));
    if (s && s.repo && s.token) return s;
  } catch (_) { /* not connected */ }
  return null;
}

function setStatus(text) {
  $("sync-status").textContent = text;
}

function api(method, body) {
  return fetch(`https://api.github.com/repos/${sync.repo}/contents/quotes.json`, {
    method,
    cache: "no-store",
    headers: { Authorization: `Bearer ${sync.token}`, Accept: "application/vnd.github+json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function describe(status) {
  if (status === 401) return "GitHub didn't accept the token.";
  if (status === 403 || status === 404) return "Can't reach that repository — check its name and the token's access.";
  return `GitHub returned an error (${status}).`;
}

const toBase64 = (text) => {
  let bin = "";
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
};
const fromBase64 = (b64) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

// Returns the remote data, or null if quotes.json doesn't exist yet.
async function pull() {
  const res = await api("GET");
  if (res.status === 404) { remoteSha = null; return null; }
  if (!res.ok) throw new Error(describe(res.status));
  const file = await res.json();
  remoteSha = file.sha;
  try {
    const data = JSON.parse(fromBase64(file.content));
    return data && Array.isArray(data.readings) ? data : null;
  } catch (_) {
    return null;
  }
}

async function push() {
  const send = () => api("PUT", {
    message: "Update quotes",
    content: toBase64(JSON.stringify(state, null, 2) + "\n"),
    sha: remoteSha || undefined,
  });
  let res = await send();
  if (res.status === 409 || res.status === 422) {
    // The file changed on GitHub since we loaded it: refresh and save again.
    const head = await api("GET");
    remoteSha = head.ok ? (await head.json()).sha : null;
    res = await send();
  }
  if (!res.ok) throw new Error(describe(res.status));
  remoteSha = (await res.json()).content.sha;
}

function schedulePush() {
  clearTimeout(pushTimer);
  setStatus("Saving…");
  pushTimer = setTimeout(() => {
    pushChain = pushChain
      .then(push)
      .then(() => setStatus(`Saved to ${sync.repo}.`))
      .catch((err) => setStatus(`Not saved: ${err.message || "no connection"} Your changes are kept on this device.`));
  }, 1200);
}

async function loadFromGitHub() {
  setStatus("Loading from GitHub…");
  try {
    const remote = await pull();
    if (remote && (remote.readings.length || !state.readings.length)) {
      state = remote;
      saveLocal();
      update({ persist: false });
      setStatus(`Connected to ${sync.repo}.`);
    } else if (state.readings.length) {
      schedulePush(); // first connection: upload what's on this device
    } else {
      setStatus(`Connected to ${sync.repo}.`);
    }
    return true;
  } catch (err) {
    setStatus(`Couldn't load: ${err.message || "no connection"}`);
    return false;
  }
}

function renderSync() {
  $("sync-repo").value = sync ? sync.repo : $("sync-repo").value || "Coolerfox123/quotes-data";
  $("sync-token").value = "";
  $("sync-token").placeholder = sync ? "Token saved on this device" : "GitHub access token";
  $("sync-disconnect").hidden = !sync;
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function label(reading) {
  return reading.author ? `${reading.title} — ${reading.author}` : reading.title;
}

// ---------- Quote display ----------

function showRandomQuote() {
  const filter = $("filter-reading").value;
  const pool = [];
  for (const r of state.readings) {
    if (filter && r.id !== filter) continue;
    for (const q of r.quotes) pool.push({ q, r });
  }

  if (pool.length === 0) {
    $("quote-text").textContent = state.readings.length
      ? "No quotes here yet — add one below."
      : "Add a reading and a quote to get started.";
    $("quote-source").textContent = "";
    lastQuoteId = null;
    return;
  }

  // Avoid showing the same quote twice in a row when there's a choice.
  let pick;
  do {
    pick = pool[Math.floor(Math.random() * pool.length)];
  } while (pool.length > 1 && pick.q.id === lastQuoteId);
  lastQuoteId = pick.q.id;

  $("quote-text").textContent = `“${pick.q.text}”`;
  const page = pick.q.page ? `, ${pick.q.page}` : "";
  $("quote-source").textContent = `— ${label(pick.r)}${page}`;
}

// ---------- Rendering ----------

function renderSelects() {
  const filter = $("filter-reading");
  const quoteReading = $("quote-reading");
  const prevFilter = filter.value;
  const prevQuoteReading = quoteReading.value;

  filter.replaceChildren(new Option("All readings", ""));
  quoteReading.replaceChildren(new Option("Choose a reading…", ""));
  for (const r of state.readings) {
    filter.add(new Option(label(r), r.id));
    quoteReading.add(new Option(label(r), r.id));
  }
  if (state.readings.some((r) => r.id === prevFilter)) filter.value = prevFilter;
  if (state.readings.some((r) => r.id === prevQuoteReading)) quoteReading.value = prevQuoteReading;
}

function renderLibrary() {
  const lib = $("library");
  lib.replaceChildren();

  if (state.readings.length === 0) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No readings yet.";
    lib.append(p);
    return;
  }

  for (const r of state.readings) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const name = document.createElement("span");
    name.textContent = `${label(r)} (${r.quotes.length})`;
    const del = document.createElement("button");
    del.type = "button";
    del.className = "link";
    del.textContent = "Delete reading";
    del.onclick = (e) => {
      e.preventDefault();
      if (confirm(`Delete "${r.title}" and its ${r.quotes.length} quote(s)?`)) {
        state.readings = state.readings.filter((x) => x.id !== r.id);
        update();
      }
    };
    summary.append(name, del);
    details.append(summary);

    const ul = document.createElement("ul");
    for (const q of r.quotes) {
      const li = document.createElement("li");
      li.textContent = `“${q.text}”${q.page ? ` (${q.page})` : ""} `;
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "link";
      rm.textContent = "remove";
      rm.onclick = () => {
        r.quotes = r.quotes.filter((x) => x.id !== q.id);
        update();
      };
      li.append(rm);
      ul.append(li);
    }
    if (r.quotes.length === 0) {
      const li = document.createElement("li");
      li.className = "muted";
      li.textContent = "No quotes yet.";
      ul.append(li);
    }
    details.append(ul);
    lib.append(details);
  }
}

function update({ newQuote = true, persist = true } = {}) {
  if (persist) save();
  renderSelects();
  renderLibrary();
  if (newQuote) showRandomQuote();
}

// ---------- Events ----------

$("reading-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = $("reading-title").value.trim();
  if (!title) return;
  const reading = { id: newId(), title, author: $("reading-author").value.trim(), quotes: [] };
  state.readings.push(reading);
  e.target.reset();
  update({ newQuote: false });
  $("quote-reading").value = reading.id; // ready to add a quote to it
});

$("quote-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const reading = state.readings.find((r) => r.id === $("quote-reading").value);
  const text = $("quote-body").value.trim();
  if (!reading || !text) return;
  reading.quotes.push({ id: newId(), text, page: $("quote-page").value.trim() });
  $("quote-body").value = "";
  $("quote-page").value = "";
  update();
});

$("next-quote").addEventListener("click", showRandomQuote);
$("filter-reading").addEventListener("change", showRandomQuote);

$("export-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "reading-quotes-backup.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

$("import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.readings)) throw new Error("bad format");
    if (confirm("Replace your current readings and quotes with this backup?")) {
      state = data;
      update();
    }
  } catch (_) {
    alert("That file doesn't look like a Reading Quotes backup.");
  }
  e.target.value = "";
});

$("sync-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const repo = $("sync-repo").value.trim().replace(/^https:\/\/github\.com\//, "").replace(/\/$/, "");
  const token = $("sync-token").value.trim() || (sync && sync.token);
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo) || !token) {
    setStatus("Enter the repository as owner/name, and a token.");
    return;
  }
  sync = { repo, token };
  if (await loadFromGitHub()) {
    localStorage.setItem(SYNC_KEY, JSON.stringify(sync));
  } else {
    sync = loadSync();
  }
  renderSync();
});

$("sync-disconnect").addEventListener("click", () => {
  localStorage.removeItem(SYNC_KEY);
  sync = null;
  remoteSha = null;
  renderSync();
  setStatus("Disconnected. Quotes stay on this device.");
});

update({ persist: false });
renderSync();
if (sync) loadFromGitHub();
