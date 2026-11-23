// This is a client-side logic. Text is inserted with .textContent (never innerHTML) to prevent XSS.

//Cache of the last successful forecast
let cachedForecastList = [];

const statusBanner = document.getElementById("status-banner");
const tableBody = document.getElementById("forecast-table-body");
const tableTitle = document.getElementById("table-title");
const nodeBadge = document.getElementById("active-node-badge");

const latField = document.getElementById("lat-field");
const lonField = document.getElementById("lon-field");
const cityField = document.getElementById("city-field");

const searchInput = document.getElementById("time-search-input");
const conditionFilter = document.getElementById("condition-filter");
const metricSort = document.getElementById("metric-sort");
const sortDirection = document.getElementById("sort-direction");

const WINDY_THRESHOLD_KMH = 15;
const WARM_THRESHOLD_C =22;

function showBanner(message, isError) {
    statusBanner.textContent = message;
    statusBanner.classList.add("visible");
    statusBanner.classList.toggle("error", Boolean(isError));
}

function hideBanner() {
   statusBanner.textContent = "";
   statusBanner.classList.remove("visible", "error");
}

async function requestForecastData() {
  showBanner("Loading forecast...", false);

  const query = new URLSearchParams({
    lat_input: latField.value.trim(),
    lon_input: lonField.value.trim(),
    city_label: cityField.value.trim() || "Unnamed location",
  });

  try {
    const res = await fetch("/api/forecast?" + query.toString());

    if (!res.ok) {
       let message = "Something went wrong (HTTP"  + res.status + ").";
       try {
         const errData = await res.json();
         if (errData.error_message) message = errData.error_message;
       } catch (parseError) {
         // Not JSON (for example a proxy error page): keep the default message
       }
       showBanner(message, true);
       cachedForecastList = [];
       tableBody.replaceChildren();
       return;
    }

    const data = await res.json();
    cachedForecastList = data.hourly_records || [];
    nodeBadge.textContent = data.node_identity;
    tableTitle.textContent = "Next 24 hours - " + data.city_label;
    hideBanner();
    renderFilteredAndSortedRows ();
  } catch (networkError) {
    console.error("Real error:", networkError);
    showBanner ("Could not reach the server. Check your connection and try again.", true);
    cachedForecastList = [];
    tableBody.replaceChildren();
  }
} 

function matchesCondition(record, condition) {
  if (condition === "rainy") return record.rain_mm > 0;
  if (condition === "windy") return record.wind_kmh >= WINDY_THRESHOLD_KMH;
  if (condition === "warm") return record.temp_celsius >= WARM_THRESHOLD_C;
  return true;
}

function formatHour(timestamp) {
  // "2026-11-20T14:00" becomes "20 Nov, 14:00"
  const [datePart, timePart] = String(timestamp).split("T");
  const date = new Date(datePart + "T00:00:00");
  const dayLabel = isNaN(date)
     ? datePart
     : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return dayLabel + ", " + (timePart || "");
}

function renderFilteredAndSortedRows () {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const condition = conditionFilter.value;
  const sortKey = metricSort.value;
  const direction = sortDirection.value === "desc" ? -1 : 1;

  const filteredList = cachedForecastList.filter(function (record) {
     const timeText = String(record.timestamp).toLowerCase();
     return timeText.includes(searchTerm) && matchesCondition(record, condition);
  });

  const sortedList = [...filteredList].sort(function (a,b) {
    const left = a[sortKey];
    const right = b[sortKey];
    if (typeof left === "string") return left.localeCompare(right) * direction;
    return (left - right) * direction;
  });

  tableBody.replaceChildren();

  if (sortedList.length ===0 && cachedForecastList.length > 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No hours match your search or filter.";
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }

  sortedList.forEach(function (record) {
    const row = document.createElement("tr");

    const values = [
      { text: formatHour(record.timestamp), cls:""},
      { text: record.temp_celsius, cls: record.temp_celsius >= WARM_THRESHOLD_C ? "hot" : "" },
      { text: record.humidity_pct, cls: ""},
      { text: record.wind_kmh, cls: record.wind_kmh >= WINDY_THRESHOLD_KMH ? "gusty" : "" },
      { text: record.rain_mm, cls: record.rain_mm > 0 ? "wet" : "" },
    ];
    
    values.forEach(function (item) {
      const cell = document.createElement("td");
      cell.textContent = item.text;
      if (item.cls) cell.className = item.cls;
      row.appendChild(cell);
    });

    tableBody.appendChild(row);
  });
}

//---The wiring of event---
document.getElementById("fetch-btn").addEventListener("click", requestForecastData);

document.querySelectorAll(".preset-btn").forEach(function (button) {
  button.addEventListener("click", function () {
    cityField.value = button.dataset.city;
    latField.value = button.dataset.lat;
    lonField.value = button.dataset.lon;
    document.querySelectorAll(".preset-btn").forEach(function (b) {
      b.classList.toggle("active", b === button);
    });
    requestForecastData();
  });
});  

[searchInput, conditionFilter, metricSort, sortDirection]. forEach(function (control) {
  control.addEventListener("input", renderFilteredAndSortedRows);
});

//Load Kigali on first visit
document.querySelector('.preset-btn[data-city="Kigali"]').classList.add("active");
requestForecastData();