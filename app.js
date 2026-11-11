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

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {
    alert("Couldn't save — your browser may be blocking storage.");
  }
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

function update({ newQuote = true } = {}) {
  save();
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

update();
