/* =========================================================================
   Old Vienna — Chicago Stock Finder
   List-only, app-style finder with native maps directions.
   ========================================================================= */

const GENERIC_PRODUCT = "old vienna chips";

/* Detect Apple platforms so directions open in Apple Maps, everything else
   gets the Google Maps universal link (which opens the native app on Android
   and the web app on desktop). */
const IS_APPLE =
  /iphone|ipad|ipod|macintosh/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const state = {
  locations: [],
  activeFilter: "all",
  query: "",
  userPos: null,
};

/* ---------- DOM ---------- */
const listEl = document.querySelector("#location-list");
const countEl = document.querySelector("#location-count");
const resultsSubEl = document.querySelector("#results-sub");
const searchEl = document.querySelector("#search");
const nearMeBtn = document.querySelector("#near-me");
const filters = Array.from(document.querySelectorAll(".chip"));
const statStores = document.querySelector("#stat-stores");
const statHoods = document.querySelector("#stat-hoods");
const statFlavors = document.querySelector("#stat-flavors");
const tickerTrack = document.querySelector("#ticker-track");

/* ---------- Utils ---------- */
function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function flavorsOf(location) {
  const flavors = (location.products || []).filter(
    (product) => normalize(product) !== GENERIC_PRODUCT
  );
  return flavors.length ? flavors : location.products || [];
}

function haversine(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 3958.8; // miles
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* Build a directions link that hands the store address straight to the
   phone's native maps app. */
function directionsUrl(location) {
  const address = encodeURIComponent(location.address || location.name);
  if (IS_APPLE) {
    return `https://maps.apple.com/?daddr=${address}&dirflg=d`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${address}&travelmode=driving`;
}

/* ---------- CSV parser ---------- */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);

  const headers = rows.shift().map((header) => normalize(header));
  return rows.map((cells) => {
    const record = Object.fromEntries(
      headers.map((header, index) => [header, cells[index] || ""])
    );
    return {
      ...record,
      lat: Number(record.lat),
      lng: Number(record.lng),
      products: String(record.products || "")
        .split(";")
        .map((product) => product.trim())
        .filter(Boolean),
      demo: normalize(record.demo) === "true",
    };
  });
}

/* ---------- Filtering & sorting ---------- */
function matchesLocation(location) {
  const query = normalize(state.query);
  const matchesFilter =
    state.activeFilter === "all" || location.area === state.activeFilter;
  if (!query) return matchesFilter;

  const haystack = normalize(
    [
      location.name,
      location.neighborhood,
      location.address,
      location.zip,
      location.notes,
      ...(location.products || []),
    ].join(" ")
  );
  return matchesFilter && haystack.includes(query);
}

function visibleLocations() {
  const visible = state.locations.filter(matchesLocation);
  if (state.userPos) {
    visible.forEach((location) => {
      location._dist =
        Number.isFinite(location.lat) && Number.isFinite(location.lng)
          ? haversine(state.userPos, [location.lat, location.lng])
          : Infinity;
    });
    visible.sort((a, b) => (a._dist ?? Infinity) - (b._dist ?? Infinity));
  }
  return visible;
}

/* ---------- Rendering ---------- */
function renderEmpty() {
  listEl.innerHTML = `
    <div class="empty-state">
      <h3>Nothing on this block.</h3>
      <p>Try another neighborhood, side of town, or ZIP — or clear your filters.</p>
    </div>`;
}

function cardHtml(location, index) {
  const flavors = flavorsOf(location)
    .slice(0, 3)
    .map((flavor) => `<span class="tag tag-flavor">${escapeHtml(flavor)}</span>`)
    .join("");

  const nearby = state.userPos;
  const distBadge =
    nearby && Number.isFinite(location._dist) && location._dist !== Infinity
      ? `<span class="dist-badge">${location._dist.toFixed(1)} mi</span>`
      : `<span class="rank">${index + 1}</span>`;

  return `
    <article class="location-card">
      <div class="card-top">
        <h3>${escapeHtml(location.name)}</h3>
        ${distBadge}
      </div>
      <div class="card-tags">
        <span class="tag tag-area">${escapeHtml(location.neighborhood || "Chicago")}</span>
        ${flavors}
      </div>
      <p class="card-address">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
        ${escapeHtml(location.address || "")}
      </p>
      <span class="card-hours"><span class="open-dot"></span>${escapeHtml(location.hours || "Hours vary")}</span>
      ${location.notes ? `<p class="notes">${escapeHtml(location.notes)}</p>` : ""}
      <a class="directions" href="${directionsUrl(location)}" target="_blank" rel="noopener"
         aria-label="Directions to ${escapeHtml(location.name)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
        Directions
      </a>
    </article>`;
}

function renderLocations() {
  const visible = visibleLocations();
  countEl.textContent = String(visible.length);

  if (visible.length === 0) {
    resultsSubEl.textContent = "Adjust your search";
    renderEmpty();
    return;
  }

  resultsSubEl.textContent = state.userPos
    ? "Closest to you first"
    : "Tap a spot for directions";
  listEl.innerHTML = visible.map((loc, i) => cardHtml(loc, i)).join("");
}

function renderStats() {
  const hoods = new Set();
  const flavors = new Set();
  state.locations.forEach((location) => {
    if (location.neighborhood) hoods.add(location.neighborhood);
    (location.products || []).forEach((product) => {
      if (normalize(product) !== GENERIC_PRODUCT) flavors.add(product);
    });
  });
  statStores.textContent = state.locations.length;
  statHoods.textContent = hoods.size;
  statFlavors.textContent = flavors.size;
}

/* Duplicate the ticker content so the marquee loops seamlessly. */
function primeTicker() {
  if (tickerTrack) tickerTrack.innerHTML += tickerTrack.innerHTML;
}

/* ---------- Near me ---------- */
function handleNearMe() {
  if (state.userPos) {
    state.userPos = null;
    nearMeBtn.classList.remove("is-on");
    renderLocations();
    return;
  }
  if (!navigator.geolocation) {
    nearMeBtn.querySelector(".locate-label").textContent = "Unavailable";
    return;
  }

  nearMeBtn.classList.add("is-loading");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.userPos = [position.coords.latitude, position.coords.longitude];
      nearMeBtn.classList.remove("is-loading");
      nearMeBtn.classList.add("is-on");
      renderLocations();
      document.querySelector("#finder").scrollIntoView({ behavior: "smooth", block: "start" });
    },
    () => {
      nearMeBtn.classList.remove("is-loading");
      const label = nearMeBtn.querySelector(".locate-label");
      label.textContent = "Denied";
      setTimeout(() => (label.textContent = "Near me"), 2500);
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

/* ---------- Load ---------- */
async function loadLocations() {
  try {
    const response = await fetch("locations.csv", { cache: "no-store" });
    if (!response.ok) throw new Error(`Location fetch failed: ${response.status}`);
    state.locations = parseCsv(await response.text());
  } catch (error) {
    console.error(error);
    state.locations = [];
  }
  renderStats();
  renderLocations();
}

/* ---------- Events ---------- */
let searchTimer;
searchEl.addEventListener("input", (event) => {
  state.query = event.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderLocations, 120);
});

filters.forEach((button) => {
  button.addEventListener("click", () => {
    filters.forEach((filter) => filter.classList.remove("is-active"));
    button.classList.add("is-active");
    state.activeFilter = button.dataset.filter;
    renderLocations();
  });
});

nearMeBtn.addEventListener("click", handleNearMe);

primeTicker();
loadLocations();
