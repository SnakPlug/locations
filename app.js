const CHICAGO = [41.8781, -87.6298];
const DEFAULT_ZOOM = 11;

const state = {
  locations: [],
  markers: new Map(),
  activeFilter: "all",
  query: "",
};

const map = L.map("map", {
  scrollWheelZoom: true,
  zoomControl: false,
}).setView(CHICAGO, DEFAULT_ZOOM);

L.control.zoom({ position: "bottomright" }).addTo(map);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const listEl = document.querySelector("#location-list");
const countEl = document.querySelector("#location-count");
const searchEl = document.querySelector("#search");
const filters = Array.from(document.querySelectorAll(".filter"));

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function matchesLocation(location) {
  const query = normalize(state.query);
  const matchesFilter =
    state.activeFilter === "all" || location.area === state.activeFilter;

  if (!query) {
    return matchesFilter;
  }

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

function markerIcon() {
  return L.divIcon({
    className: "chip-marker",
    html: '<span aria-hidden="true"></span>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function addMarker(location) {
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    return;
  }

  const marker = L.marker([location.lat, location.lng], {
    icon: markerIcon(),
    title: location.name,
  }).addTo(map);

  marker.bindPopup(`
    <p class="popup-title">${location.name}</p>
    <span>${location.address || ""}</span>
  `);

  marker.on("click", () => setActiveCard(location.id));
  state.markers.set(location.id, marker);
}

function setActiveCard(id) {
  document
    .querySelectorAll(".location-card")
    .forEach((card) => card.classList.toggle("is-active", card.dataset.id === id));
}

function fitVisibleMarkers(locations) {
  const coordinates = locations
    .filter((location) => Number.isFinite(location.lat) && Number.isFinite(location.lng))
    .map((location) => [location.lat, location.lng]);

  if (coordinates.length === 0) {
    map.setView(CHICAGO, DEFAULT_ZOOM);
    return;
  }

  if (coordinates.length === 1) {
    map.setView(coordinates[0], 14);
    return;
  }

  map.fitBounds(coordinates, { padding: [42, 42], maxZoom: 14 });
}

function renderEmpty() {
  listEl.innerHTML = `
    <article class="empty-state">
      <h3>Location list coming soon.</h3>
      <p>
        Verified Chicago stockists are being added now. Check back for the
        live neighborhood list.
      </p>
    </article>
  `;
}

function renderLocations() {
  const visible = state.locations.filter(matchesLocation);
  countEl.textContent = String(visible.length);

  state.markers.forEach((marker) => map.removeLayer(marker));
  state.markers.clear();

  visible.forEach(addMarker);
  fitVisibleMarkers(visible);

  if (visible.length === 0) {
    renderEmpty();
    return;
  }

  listEl.innerHTML = visible
    .map(
      (location) => `
        <article class="location-card" data-id="${location.id}" tabindex="0">
          <h3>${location.name}</h3>
          <p>${location.address}</p>
          <span class="tag">${location.neighborhood || "Chicago"}</span>
          <div class="meta">
            <span>${location.hours || "Hours vary"}</span>
            <span>${(location.products || ["Old Vienna chips"]).join(", ")}</span>
          </div>
        </article>
      `
    )
    .join("");

  document.querySelectorAll(".location-card").forEach((card) => {
    const marker = state.markers.get(card.dataset.id);
    card.addEventListener("click", () => {
      if (marker) {
        marker.openPopup();
        map.setView(marker.getLatLng(), 14);
      }
      setActiveCard(card.dataset.id);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        card.click();
      }
    });
  });
}

async function loadLocations() {
  try {
    const response = await fetch("locations.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Location fetch failed: ${response.status}`);
    }
    state.locations = await response.json();
  } catch (error) {
    console.error(error);
    state.locations = [];
  }

  renderLocations();
}

searchEl.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderLocations();
});

filters.forEach((button) => {
  button.addEventListener("click", () => {
    filters.forEach((filter) => filter.classList.remove("is-active"));
    button.classList.add("is-active");
    state.activeFilter = button.dataset.filter;
    renderLocations();
  });
});

loadLocations();
