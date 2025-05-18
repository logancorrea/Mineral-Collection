const metaCsvUrl = "https://docs.google.com/spreadsheets/d/1KWMTZaLluEq3l0XPYcfM1gixYcynKklUfWFdDePV05g/gviz/tq?tqx=out:csv&sheet=Database";

const sidebar = document.getElementById("sidebar");
const content = document.getElementById("main-content");

const specimenMap = {};

// === Utility: Check if image exists ===
async function imageExists(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

// === Load Database CSV ===
Papa.parse(metaCsvUrl, {
  download: true,
  header: false,
  complete: async (results) => {
    const rows = results.data;
    const headerRowIndex = rows.findIndex(row => row.includes("Catalog Number"));
    if (headerRowIndex === -1) return console.error("❌ Could not find header row.");

    const headerRow = rows[headerRowIndex].map(col => col?.trim().replace(/\s+/g, " "));
    const dataRows = rows.slice(headerRowIndex + 1);

    dataRows.forEach(row => {
      const rowObj = {};
      headerRow.forEach((col, i) => {
        rowObj[col] = row[i];
      });
      const rawId = rowObj["Catalog Number"];
      if (rawId && !isNaN(rawId)) {
        const id = parseInt(rawId);
        specimenMap[id] = rowObj;
      }
    });

    renderSidebar();
  }
});

// === Sidebar ===
function renderSidebar() {
  sidebar.innerHTML = "<h2>Specimens</h2>";
  Object.values(specimenMap).forEach(spec => {
    const species = [
      spec["Species 1"], spec["Species 2"], spec["Species 3"],
      spec["Species 4"], spec["Species 5"]
    ].filter(Boolean).join(", ");

    const div = document.createElement("div");
    div.className = "specimen";
    div.textContent = `${spec["Catalog Number"]} - ${species || "Unknown"}`;
    div.onclick = () => showSpecimen(parseInt(spec["Catalog Number"]));
    sidebar.appendChild(div);
  });
}

// === Main Viewer ===
async function showSpecimen(id) {
  const spec = specimenMap[id];
  const species = [
    spec["Species 1"], spec["Species 2"], spec["Species 3"],
    spec["Species 4"], spec["Species 5"]
  ].filter(Boolean).join(", ");

  const mindatLinks = (spec["Species Info"] || "")
    .split(/\s+/)
    .filter(url => url.startsWith("http"))
    .map(url => `<li><a href="${url}" target="_blank">${url}</a></li>`)
    .join("");

  // Images
  const extensions = ["jpg", "jpeg", "png", "webp"];
  const maxImages = 20;
  const validImages = [];
  for (let i = 0; i < maxImages; i++) {
    const base = i === 0 ? `${id}` : `${id}-${i}`;
    for (const ext of extensions) {
      const url = `images/${base}.${ext}`;
      if (await imageExists(url)) {
        validImages.push(url);
        break;
      }
    }
  }

  const toggleButton = validImages.length > 4
    ? `<button id="toggleGallery">Show all photos</button>` : "";

  const imagesHtml = validImages.map((url, i) => `
    <img src="${url}" alt="Specimen image" class="specimen-img ${i >= 4 ? 'hidden' : ''}" />
  `).join("");

  // Mindat Locality link
  const mindatLocUrl = spec["Mindat Locality"];
  const mindatLocHtml = mindatLocUrl
    ? `<a href="${mindatLocUrl}" target="_blank">${mindatLocUrl}</a>` : "—";

  content.innerHTML = `
    <h2>${spec["Specimen Title"] || species || `Catalog ${id}`}</h2>
    <div class="section">
      <p><strong>Catalog Number:</strong> ${id}</p>
      <p><strong>Species:</strong> ${species || "—"}</p>
      ${mindatLinks ? `<p><strong>Mindat Links:</strong><ul>${mindatLinks}</ul></p>` : ""}
      <p><strong>Locality:</strong> ${spec["Locality"] || "—"}</p>
      <p><strong>Mindat Locality:</strong> ${mindatLocHtml}</p>
      <p><strong>Date Acquired:</strong> ${spec["Date of Acquisition"] || "—"}</p>
      <p><strong>Dimensions:</strong> ${spec["Dimensions"] || "—"}</p>
      <p><strong>Max Crystal Size:</strong> ${spec["Max Crystal Size"] || "—"}</p>
      <p><strong>Source:</strong> ${spec["Specimen Source"] || "—"}</p>
      <p><strong>Notes:</strong> ${spec["Notes"] || "—"}</p>
      <p><strong>Coordinates:</strong> ${spec["Coordinates"] || "—"}</p>
    </div>

    <div class="gallery">
      ${toggleButton}
      <div class="image-grid">${imagesHtml}</div>
    </div>
  `;

// === Add map container if coordinates exist ===
const mapContainer = document.createElement("div");
mapContainer.id = "map";
content.appendChild(mapContainer);

// Parse and add marker
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
    mapContainer.innerHTML = "<p>Invalid coordinates.</p>";
  }
} else {
  mapContainer.innerHTML = "<p>No coordinates available.</p>";
}


  // Expand Gallery
  const btn = document.getElementById("toggleGallery");
  if (btn) {
    btn.onclick = () => {
      document.querySelectorAll(".specimen-img").forEach(img => img.classList.remove("hidden"));
      btn.remove();
    };
  }
}
