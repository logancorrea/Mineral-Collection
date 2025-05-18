const metaCsvUrl = "https://docs.google.com/spreadsheets/d/1KWMTZaLluEq3l0XPYcfM1gixYcynKklUfWFdDePV05g/gviz/tq?tqx=out:csv&sheet=Database";
const photoCsvUrl = "https://docs.google.com/spreadsheets/d/1KWMTZaLluEq3l0XPYcfM1gixYcynKklUfWFdDePV05g/gviz/tq?tqx=out:csv&sheet=photo_ids";

const sidebar = document.getElementById("sidebar");
const content = document.getElementById("main-content");

const specimenMap = {};
const photoMap = {};

// === Utility: Check if image exists ===
async function imageExists(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

// === Load photo_ids CSV ===
Papa.parse(photoCsvUrl, {
  download: true,
  header: true,
  complete: (results) => {
    results.data.forEach(row => {
      const id = parseInt(row["Catalog ID"]);
      if (!isNaN(id) && row["File Names"]) {
        photoMap[id] = row["File Names"].split(",").map(s => s.trim());
      }
    });
  }
});

// === Load Database CSV ===
Papa.parse(metaCsvUrl, {
  download: true,
  header: false,
  complete: async (results) => {
    const rows = results.data;
    const headerRowIndex = rows.findIndex(row => row.includes("Catalog ID"));
    if (headerRowIndex === -1) return console.error("❌ Could not find header row.");

    const headerRow = rows[headerRowIndex].map(col => col?.trim().replace(/\s+/g, " "));
    const dataRows = rows.slice(headerRowIndex + 1);

    dataRows.forEach(row => {
      const rowObj = {};
      headerRow.forEach((col, i) => {
        rowObj[col] = row[i];
      });
      const rawId = rowObj["Catalog ID"];
      if (rawId && !isNaN(rawId)) {
        const id = parseInt(rawId);
        specimenMap[id] = rowObj;
      }
    });

    renderSidebar();
    loadFromHash();
  }
});

// === Render Sidebar ===
function renderSidebar() {
  // 1) header + search box
  sidebar.innerHTML = `
    <h2>Specimens</h2>
    <input type="text" id="specimenSearch" placeholder="Search…" />
  `;

  // 2) add specimen links
  Object.entries(specimenMap).forEach(([id, spec]) => {
    const species = [
      spec["Species 1"], spec["Species 2"], spec["Species 3"],
      spec["Species 4"], spec["Species 5"]
    ].filter(Boolean).join(", ");

    const link = document.createElement("a");
    link.href = `#${id}`;
    link.className = "specimen";
    link.textContent = `Cat ID: ${id} | ${species || "Unknown"}`;
    sidebar.appendChild(link);
  });

  // 3) attach the listener ONCE
  const search = document.getElementById("specimenSearch");
  search.addEventListener("input", () => {
    const q = search.value.toLowerCase();
    document.querySelectorAll("#sidebar a.specimen").forEach(a => {
      a.style.display = a.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  });
}

// === Main Viewer ===
async function showSpecimen(id) {
  const spec = specimenMap[id];
  if (!spec) return;

  const species = [
    spec["Species 1"], spec["Species 2"], spec["Species 3"],
    spec["Species 4"], spec["Species 5"]
  ].filter(Boolean).join(", ");

  const mindatLinks = (spec["Species Info"] || "")
    .split(/\s+/)
    .filter(url => url.startsWith("http"))
    .map(url => `<li><a href="${url}" target="_blank">${url}</a></li>`)
    .join("");

  // ✅ Use preloaded photoMap
  const fileNames = photoMap[id] || [];
  let currentSlide = 0;
const visibleCount = 3;

function renderCarousel(images) {
  const end   = Math.min(currentSlide + visibleCount, images.length);
  const shown = images.slice(currentSlide, end).map(name =>
    `<img src="images/${name}" alt="Specimen image" class="specimen-img" loading="lazy" />`
  ).join("");

  const hasPrev = currentSlide > 0;
  const hasNext = end < images.length;

  return `
    <div class="carousel-wrapper">
      <button class="carousel-btn prev" id="prevBtn" ${hasPrev ? "" : "disabled"}>‹</button>
      <div class="image-row">${shown}</div>
      <button class="carousel-btn next" id="nextBtn" ${hasNext ? "" : "disabled"}>›</button>
    </div>
  `;
}


const renderImages = () => {
  const galleryDiv = document.getElementById("gallery-content");
  if (galleryDiv) {
    galleryDiv.innerHTML = renderCarousel(fileNames);
    const next = document.getElementById("nextBtn");
    const prev = document.getElementById("prevBtn");

    if (next) next.onclick = () => {
      currentSlide += visibleCount;
      renderImages();
    };
    if (prev) prev.onclick = () => {
      currentSlide = Math.max(0, currentSlide - visibleCount);
      renderImages();
    };
  }
};


  const mindatLocUrl = spec["Mindat Locality"];
  const mindatLocHtml = mindatLocUrl
    ? `<a href="${mindatLocUrl}" target="_blank">${mindatLocUrl}</a>` : "—";

content.innerHTML = `
  <h2>${spec["Specimen Title"] || species || `Catalog ${id}`}</h2>

  <!-- ⬇️  GALLERY NOW COMES RIGHT AFTER THE TITLE -->
  <div class="gallery">
    <div id="gallery-content"></div>
  </div>

  <div class="section">
    <p><strong>Catalog ID:</strong> ${id}</p>
    <p><strong>Mindat ID:</strong> ${spec["MinID"] || "—"}</p>
    <p><strong>Species:</strong> ${species || "—"}</p>
    ${mindatLinks ? `<p><strong>Mindat Links:</strong><ul>${mindatLinks}</ul></p>` : ""}
    <p><strong>Locality:</strong> ${spec["Locality"] || "—"}</p>
    <p><strong>Mindat Locality:</strong> ${mindatLocHtml}</p>
    <p><strong>Date Acquired:</strong> ${spec["Date of Acquisition"] || "—"}</p>
    <p><strong>Dimensions:</strong> ${spec["Dimensions"] || "—"}</p>
    <p><strong>Source:</strong> ${spec["Specimen Source"] || "—"}</p>
    <p><strong>Notes:</strong> ${spec["Notes"] || "—"}</p>
    <p><strong>Coordinates:</strong> ${spec["Coordinates"] || "—"}</p>
  </div>

  <div id="map"></div>
`;

  renderImages(); // initialize carousel

  // === Map ===
  const coordString = spec["Coordinates"];
  if (coordString && coordString.includes(",")) {
    const [latStr, lngStr] = coordString.split(",").map(s => s.trim());
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (!isNaN(lat) && !isNaN(lng)) {
      const map = L.map("map").setView([lat, lng], 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      L.marker([lat, lng]).addTo(map).bindPopup(spec["Locality"] || `Catalog ${id}`);
    } else {
      document.getElementById("map").innerHTML = "<p>Invalid coordinates.</p>";
    }
  } else {
    document.getElementById("map").innerHTML = "<p>No coordinates available.</p>";
  }
}

// === Handle hash navigation on page load or hash change ===
function loadFromHash() {
  const hash = window.location.hash;
  if (hash && hash.startsWith("#")) {
    const id = parseInt(hash.substring(1));
    if (!isNaN(id)) showSpecimen(id);
  }
}

window.addEventListener("hashchange", loadFromHash);
