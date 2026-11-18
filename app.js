const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const MIN_SEARCH_INTERVAL_MS = 1100;

const locations = {
  origin: null,
  destination: null,
};

const elements = {
  form: document.querySelector("#route-form"),
  inputs: {
    origin: document.querySelector("#origin-input"),
    destination: document.querySelector("#destination-input"),
  },
  resultLists: {
    origin: document.querySelector("#origin-results"),
    destination: document.querySelector("#destination-results"),
  },
  selectedPlaces: {
    origin: document.querySelector("#origin-selected"),
    destination: document.querySelector("#destination-selected"),
  },
  searchButtons: [...document.querySelectorAll("[data-search]")],
  measureButton: document.querySelector("#measure-button"),
  swapButton: document.querySelector("#swap-button"),
  status: document.querySelector("#status-message"),
  result: document.querySelector("#route-result"),
  distance: document.querySelector("#distance-value"),
  summary: document.querySelector("#route-summary"),
  mapLink: document.querySelector("#map-link"),
};

let lastSearchAt = 0;
const searchCache = new Map();

function setStatus(message) {
  elements.status.textContent = message;
}

function clearResult() {
  elements.result.hidden = true;
  elements.distance.textContent = "";
  elements.summary.textContent = "";
  elements.mapLink.href = "#";
}

function clearLocation(field) {
  locations[field] = null;
  elements.resultLists[field].replaceChildren();
  elements.selectedPlaces[field].textContent = "";
  clearResult();
}

function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters).toLocaleString("ko-KR")} m`;
  }
  const kilometers = meters / 1000;
  const digits = kilometers < 10 ? 2 : 1;
  return `${kilometers.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} km`;
}

function makeMapUrl(origin, destination) {
  const originCoordinates = `${origin.lat},${origin.lon}`;
  const destinationCoordinates = `${destination.lat},${destination.lon}`;
  const params = new URLSearchParams({
    engine: "fossgis_osrm_car",
    route: `${originCoordinates};${destinationCoordinates}`,
  });
  return `https://www.openstreetmap.org/directions?${params}`;
}

async function respectSearchRateLimit() {
  const wait = MIN_SEARCH_INTERVAL_MS - (Date.now() - lastSearchAt);
  if (wait > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, wait));
  }
  lastSearchAt = Date.now();
}

function renderResults(field, places) {
  const list = elements.resultLists[field];
  list.replaceChildren();

  if (places.length === 0) {
    setStatus("검색 결과가 없습니다. 다른 이름이나 주소로 다시 검색해 주세요.");
    return;
  }

  places.forEach((place) => {
    const option = document.createElement("button");
    const title = place.name || place.display_name.split(",")[0];
    const address = place.display_name;
    option.type = "button";
    option.className = "result-option";

    const titleElement = document.createElement("strong");
    titleElement.textContent = title;
    const addressElement = document.createElement("span");
    addressElement.textContent = address;
    option.append(titleElement, addressElement);
    option.addEventListener("click", () => {
      locations[field] = {
        lat: place.lat,
        lon: place.lon,
        name: title,
        address,
      };
      elements.inputs[field].value = title;
      elements.selectedPlaces[field].textContent = `선택됨 · ${address}`;
      list.replaceChildren();
      clearResult();
      setStatus("");
    });
    list.append(option);
  });

  setStatus("검색 결과에서 정확한 장소를 선택해 주세요.");
}

async function searchLocation(field) {
  const query = elements.inputs[field].value.trim();
  if (!query) {
    setStatus("출발지와 도착지를 입력한 다음 검색해 주세요.");
    elements.inputs[field].focus();
    return;
  }

  const searchButton = elements.searchButtons.find(
    (button) => button.dataset.search === field,
  );
  searchButton.disabled = true;
  elements.resultLists[field].replaceChildren();
  setStatus("장소를 검색하고 있습니다...");

  try {
    const cacheKey = query.toLocaleLowerCase("ko-KR");
    let places = searchCache.get(cacheKey);
    if (!places) {
      await respectSearchRateLimit();
      const params = new URLSearchParams({
        q: query,
        format: "jsonv2",
        addressdetails: "1",
        limit: "5",
      });
      const response = await fetch(`${NOMINATIM_URL}?${params}`);
      if (!response.ok) {
        throw new Error(`장소 검색 요청이 실패했습니다 (${response.status}).`);
      }
      places = await response.json();
      searchCache.set(cacheKey, places);
    }

    if (elements.inputs[field].value.trim() === query) {
      renderResults(field, places);
    }
  } catch (error) {
    setStatus(
      error instanceof Error
        ? `${error.message} 잠시 후 다시 시도해 주세요.`
        : "장소 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    );
  } finally {
    searchButton.disabled = false;
  }
}

async function measureRoute(event) {
  event.preventDefault();
  setStatus("");
  clearResult();

  if (!locations.origin || !locations.destination) {
    setStatus("출발지와 도착지를 각각 검색한 뒤 결과에서 선택해 주세요.");
    const missingField = locations.origin ? "destination" : "origin";
    elements.inputs[missingField].focus();
    return;
  }

  elements.measureButton.disabled = true;
  elements.measureButton.querySelector(".measure-label").textContent =
    "경로를 찾고 있습니다...";

  try {
    const coordinates = [
      `${locations.origin.lon},${locations.origin.lat}`,
      `${locations.destination.lon},${locations.destination.lat}`,
    ].join(";");
    const response = await fetch(
      `${OSRM_URL}/${coordinates}?overview=false&steps=false`,
    );
    if (!response.ok) {
      throw new Error(`경로 요청이 실패했습니다 (${response.status}).`);
    }

    const routeData = await response.json();
    if (routeData.code !== "Ok" || !routeData.routes?.length) {
      throw new Error("두 장소 사이의 자동차 경로를 찾을 수 없습니다.");
    }

    const distance = routeData.routes[0].distance;
    elements.distance.textContent = formatDistance(distance);
    elements.summary.textContent = `${locations.origin.name}에서 ${locations.destination.name}까지`;
    elements.mapLink.href = makeMapUrl(locations.origin, locations.destination);
    elements.result.hidden = false;
  } catch (error) {
    setStatus(
      error instanceof Error
        ? `${error.message} 장소를 확인하거나 잠시 후 다시 시도해 주세요.`
        : "경로를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    );
  } finally {
    elements.measureButton.disabled = false;
    elements.measureButton.querySelector(".measure-label").textContent =
      "거리 확인하기";
  }
}

elements.searchButtons.forEach((button) => {
  button.addEventListener("click", () => searchLocation(button.dataset.search));
});

Object.entries(elements.inputs).forEach(([field, input]) => {
  input.addEventListener("input", () => {
    clearLocation(field);
    setStatus("");
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchLocation(field);
    }
  });
});

elements.swapButton.addEventListener("click", () => {
  const originValue = elements.inputs.origin.value;
  elements.inputs.origin.value = elements.inputs.destination.value;
  elements.inputs.destination.value = originValue;

  const originLocation = locations.origin;
  locations.origin = locations.destination;
  locations.destination = originLocation;

  for (const field of ["origin", "destination"]) {
    elements.selectedPlaces[field].textContent = locations[field]
      ? `선택됨 · ${locations[field].address}`
      : "";
    elements.resultLists[field].replaceChildren();
  }
  setStatus("");
  clearResult();
});

elements.form.addEventListener("submit", measureRoute);
