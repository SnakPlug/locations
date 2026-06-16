/* =========================================================================
   Old Vienna — Chicago Store Finder
   ========================================================================= */

const CHICAGO = [41.8781, -87.6298];
const DEFAULT_ZOOM = 11;
const GENERIC_PRODUCT = "old vienna chips";

const state = {
  locations: [],
  markers: new Map(),
  activeFilter: "all",
  query: "",
  activeId: null,
  userPos: null,
  userMarker: null,
};

/* ---------- Map setup ---------- */
const map = L.map("map", {
  scrollWheelZoom: false,
  zoomControl: false,
}).setView(CHICAGO, DEFAULT_ZOOM);

map.on("click", () => map.scrollWheelZoom.enable());
L.control.zoom({ position: "bottomright" }).addTo(map);

L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }
).addTo(map);

/* ---------- DOM ---------- */
const listEl = document.querySelector("#location-list");
const countEl = document.querySelector("#location-count");
const panelSubEl = document.querySelector("#panel-sub");
const searchEl = document.querySelector("#search");
const nearMeBtn = document.querySelector("#near-me");
const locator = document.querySelector("#locator");
const filters = Array.from(document.querySelectorAll(".chip"));
const segments = Array.from(document.querySelectorAll(".seg"));
const statStores = document.querySelector("#stat-stores");
const statHoods = document.querySelector("#stat-hoods");
const statFlavors = document.querySelector("#stat-flavors");

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

function directionsUrl(location) {
  const dest =
    Number.isFinite(location.lat) && Number.isFinite(location.lng)
      ? `${location.lat},${location.lng}`
      : encodeURIComponent(location.address || location.name);
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
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

/* ---------- Markers ---------- */
function markerIcon() {
  return L.divIcon({
    className: "chip-pin",
    html: '<span class="pin-body"></span>',
    iconSize: [28, 34],
    iconAnchor: [14, 30],
    popupAnchor: [0, -28],
  });
}

function addMarker(location) {
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return;

  const marker = L.marker([location.lat, location.lng], {
    icon: markerIcon(),
    title: location.name,
    riseOnHover: true,
  }).addTo(map);

  marker.bindPopup(`
    <p class="popup-title">${escapeHtml(location.name)}</p>
    <span class="popup-addr">${escapeHtml(location.address || "")}</span><br/>
    <a class="popup-dir" href="${directionsUrl(location)}" target="_blank" rel="noopener">Get directions →</a>
  `);

  marker.on("click", () => focusLocation(location.id, { fly: false }));
  state.markers.set(location.id, marker);
}

function setActive(id, { scrollCard = false } = {}) {
  state.activeId = id;

  document.querySelectorAll(".location-card").forEach((card) => {
    const on = card.dataset.id === id;
    card.classList.toggle("is-active", on);
    if (on && scrollCard) {
      card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });

  state.markers.forEach((marker, markerId) => {
    const el = marker.getElement();
    if (el) el.classList.toggle("is-active", markerId === id);
  });
}

function focusLocation(id, { fly = true } = {}) {
  const marker = state.markers.get(id);
  if (marker) {
    if (fly) map.flyTo(marker.getLatLng(), 15, { duration: 0.6 });
    marker.openPopup();
  }
  setActive(id, { scrollCard: true });
}

function fitVisibleMarkers(locations) {
  const coords = locations
    .filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng))
    .map((l) => [l.lat, l.lng]);

  if (state.userPos) coords.push(state.userPos);

  if (coords.length === 0) {
    map.setView(CHICAGO, DEFAULT_ZOOM);
  } else if (coords.length === 1) {
    map.setView(coords[0], 14);
  } else {
    map.fitBounds(coords, { padding: [50, 50], maxZoom: 14 });
  }
}

function refreshMap(locations) {
  requestAnimationFrame(() => {
    map.invalidateSize();
    fitVisibleMarkers(locations);
  });
}

/* ---------- Rendering ---------- */
function renderEmpty() {
  listEl.innerHTML = `
    <div class="empty-state">
      <h3>No stores match that search.</h3>
      <p>Try another neighborhood, side of town, or ZIP code — or clear your filters.</p>
    </div>`;
}

function cardHtml(location) {
  const flavors = flavorsOf(location)
    .slice(0, 3)
    .map((flavor) => `<span class="tag tag-flavor">${escapeHtml(flavor)}</span>`)
    .join("");

  const distBadge =
    Number.isFinite(location._dist) && location._dist !== Infinity
      ? `<span class="dist-badge">${location._dist.toFixed(1)} mi</span>`
      : "";

  return `
    <article class="location-card" data-id="${escapeHtml(location.id)}" tabindex="0">
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
      <div class="card-foot">
        <span class="card-hours"><span class="open-dot"></span>${escapeHtml(location.hours || "Hours vary")}</span>
        <a class="directions" href="${directionsUrl(location)}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
          Directions
        </a>
      </div>
      ${location.notes ? `<p class="notes">${escapeHtml(location.notes)}</p>` : ""}
    </article>`;
}

function renderLocations({ refit = true } = {}) {
  const visible = visibleLocations();
  countEl.textContent = String(visible.length);

  state.markers.forEach((marker) => map.removeLayer(marker));
  state.markers.clear();
  visible.forEach(addMarker);
  if (refit) refreshMap(visible);

  if (visible.length === 0) {
    panelSubEl.textContent = "Adjust your search to see stores";
    renderEmpty();
    return;
  }

  panelSubEl.textContent = state.userPos
    ? "Sorted by distance from you"
    : "Tap a store to see it on the map";

  listEl.innerHTML = visible.map(cardHtml).join("");

  document.querySelectorAll(".location-card").forEach((card) => {
    const id = card.dataset.id;
    const go = () => {
      focusLocation(id);
      if (window.matchMedia("(max-width: 900px)").matches) setView("map");
    };
    card.addEventListener("click", (event) => {
      if (event.target.closest(".directions")) return; // let the link work
      go();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        go();
      }
    });
  });

  if (state.activeId) setActive(state.activeId);
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

/* ---------- View toggle (mobile) ---------- */
function setView(view) {
  locator.dataset.view = view;
  segments.forEach((seg) => seg.classList.toggle("is-active", seg.dataset.view === view));
  if (view === "map") refreshMap(visibleLocations());
}

/* ---------- Near me ---------- */
function clearUserMarker() {
  if (state.userMarker) {
    map.removeLayer(state.userMarker);
    state.userMarker = null;
  }
}

function handleNearMe() {
  if (state.userPos) {
    // toggle off
    state.userPos = null;
    clearUserMarker();
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
      clearUserMarker();
      state.userMarker = L.marker(state.userPos, {
        icon: L.divIcon({
          className: "you-pin-wrap",
          html: '<span class="you-pin"></span>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
        interactive: false,
        zIndexOffset: 1000,
      }).addTo(map);
      nearMeBtn.classList.remove("is-loading");
      nearMeBtn.classList.add("is-on");
      renderLocations();
    },
    () => {
      nearMeBtn.classList.remove("is-loading");
      nearMeBtn.querySelector(".locate-label").textContent = "Denied";
      setTimeout(() => {
        nearMeBtn.querySelector(".locate-label").textContent = "Near me";
      }, 2500);
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
  searchTimer = setTimeout(() => renderLocations(), 120);
});

filters.forEach((button) => {
  button.addEventListener("click", () => {
    filters.forEach((filter) => filter.classList.remove("is-active"));
    button.classList.add("is-active");
    state.activeFilter = button.dataset.filter;
    renderLocations();
  });
});

segments.forEach((seg) => {
  seg.addEventListener("click", () => setView(seg.dataset.view));
});

nearMeBtn.addEventListener("click", handleNearMe);

window.addEventListener("resize", () => refreshMap(visibleLocations()));

loadLocations();
