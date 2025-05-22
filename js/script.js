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
  sidebar.innerHTML = `
    <h2>Specimens</h2>
    <input type="text" id="specimenSearch" placeholder="Search…" />
  `;

  Object.entries(specimenMap).forEach(([id, spec]) => {
    const species = [
      spec["Species 1"], spec["Species 2"], spec["Species 3"],
      spec["Species 4"], spec["Species 5"]
    ].filter(Boolean).join(", ");

    const title = spec["Specimen Title"]?.trim();
    const label = title
      ? `<span class="specimen-id">${id}</span> | ${title}`
      : `<span class="specimen-id">${id}</span> | ${species || "Unknown"}`;

    const link = document.createElement("a");
    link.href = `#${id}`;
    link.className = "specimen";
    link.dataset.id = id;
    link.dataset.title = title || "";
    link.dataset.species = species;
    link.innerHTML = label;
    sidebar.appendChild(link);
  });

  // --- Unified search logic for all searchbars ---
  function filterSpecimens(query) {
    const q = query.trim().toLowerCase();
    document.querySelectorAll("#sidebar a.specimen").forEach(link => {
      const id = link.dataset.id || "";
      const title = (link.dataset.title || "").toLowerCase();
      const species = (link.dataset.species || "").toLowerCase();
      const searchText = `${id} ${title} ${species}`;
      link.style.display = searchText.includes(q) ? "" : "none";
    });
  }

  // Listen to both possible searchbars for the sidebar
  const search1 = document.getElementById("specimenSearch");
  if (search1) {
    search1.addEventListener("input", () => filterSpecimens(search1.value));
  }
  const search2 = document.getElementById("sidebarSearch");
  if (search2) {
    search2.addEventListener("input", () => filterSpecimens(search2.value));
  }
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

  // Use images from folder, not Google Sheet
  const fileNames = await getSpecimenImages(id);

  let currentSlide = 0;
  const visibleCount = 2;

  function renderCarousel(images) {
    const galleryDiv = document.getElementById("gallery-content");
    if (!galleryDiv) {
      console.error("❌ No #gallery-content found");
      return;
    }

    const end = Math.min(currentSlide + visibleCount, images.length);
    const description = spec["Description"]?.trim() || "";
    const shown = images.slice(currentSlide, end).map((name, idx) =>
      `<img src="${name}" alt="${description}" class="specimen-img carousel-img" data-img="${name}" loading="lazy" style="cursor: pointer;" />`
    ).join("");

    const hasPrev = currentSlide > 0;
    const hasNext = end < images.length;

    galleryDiv.innerHTML = `
      <div class="carousel-wrapper">
        <button class="carousel-btn prev" id="prevBtn" ${hasPrev ? "" : "disabled"}>‹</button>
        <div class="image-row">${shown}</div>
        <button class="carousel-btn next" id="nextBtn" ${hasNext ? "" : "disabled"}>›</button>
      </div>
      <div id="img-modal" class="img-modal hidden">
        <div style="display:flex; flex-direction:row; align-items:center; justify-content:center;">
          <button class="carousel-btn" id="modalPrevBtn" style="margin-right:1em;">‹</button>
          <div style="display:flex; flex-direction:column; align-items:center; position:relative;">
            <span class="img-modal-close" id="img-modal-close" style="position:absolute; left:0; top:0; font-size:2.5em; color:#fff; cursor:pointer; z-index:10; padding:0 16px;">&times;</span>
            <img class="img-modal-content" id="img-modal-img" />
            <div id="img-modal-desc" class="img-modal-desc" style="color:#fff; text-align:center; margin-top:1em; max-width:90vw;"></div>
          </div>
          <button class="carousel-btn" id="modalNextBtn" style="margin-left:1em;">›</button>
        </div>
      </div>
    `;

    // Carousel buttons
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        currentSlide = Math.max(0, currentSlide - visibleCount);
        renderCarousel(images);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        currentSlide += visibleCount;
        renderCarousel(images);
      });
    }

    // Popout modal logic
    const imgs = galleryDiv.querySelectorAll(".carousel-img");
    const modal = document.getElementById("img-modal");
    const modalImg = document.getElementById("img-modal-img");
    const modalClose = document.getElementById("img-modal-close");
    const modalPrevBtn = document.getElementById("modalPrevBtn");
    const modalNextBtn = document.getElementById("modalNextBtn");

    let modalIndex = 0;

    imgs.forEach((img, idx) => {
      img.addEventListener("click", () => {
        modal.classList.remove("hidden");
        modalImg.src = img.src;
        modalImg.alt = img.alt;
        document.getElementById("img-modal-desc").textContent = description;
        modalIndex = currentSlide + idx;
        updateModalButtons();
      });
    });

    function updateModalButtons() {
      if (modalPrevBtn) modalPrevBtn.disabled = (modalIndex <= 0);
      if (modalNextBtn) modalNextBtn.disabled = (modalIndex >= images.length - 1);
    }

    if (modalPrevBtn) {
      modalPrevBtn.addEventListener("click", () => {
        if (modalIndex > 0) {
          modalIndex--;
          modalImg.src = images[modalIndex];
          modalImg.alt = description;
          updateModalButtons();
        }
      });
    }
    if (modalNextBtn) {
      modalNextBtn.addEventListener("click", () => {
        if (modalIndex < images.length - 1) {
          modalIndex++;
          modalImg.src = images[modalIndex];
          modalImg.alt = description;
          updateModalButtons();
        }
      });
    }

    modalClose.addEventListener("click", () => {
      modal.classList.add("hidden");
      modalImg.src = "";
      document.getElementById("img-modal-desc").textContent = "";
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.add("hidden");
        modalImg.src = "";
        document.getElementById("img-modal-desc").textContent = "";
      }
    });
  }

  const renderImages = () => {
    console.log("📷 Rendering image carousel...");
    renderCarousel(fileNames);
  };


  const mindatLocUrl = spec["Mindat Locality"];
  const mindatLocHtml = mindatLocUrl
    ? `<a href="${mindatLocUrl}" target="_blank">${mindatLocUrl}</a>` : "—";

  content.innerHTML = `
    <h2>${spec["Specimen Title"] || species || `Catalog ${id}`}</h2>

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
      <p><strong>Year Acquired:</strong> ${spec["Year of Acquisition"] || "—"}</p>
      <p><strong>Dimensions:</strong> ${spec["Dimensions"] || "—"}</p>
      <p><strong>Source:</strong> ${spec["Specimen Source"] || "—"}</p>
      <p><strong>Notes:</strong> ${spec["Notes"] || "—"}</p>
      <p><strong>Coordinates:</strong> ${spec["Coordinates"] || "—"}</p>
    </div>

    <div id="map"></div>
  `;

  renderImages();

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

/**
 * Returns an array of image URLs for a given specimen id.
 * Checks for id.jpg, id-2.jpg, id-3.jpg, ... up to maxImages.
 */
async function getSpecimenImages(id, maxImages = 5) {
  const urls = [];
  const extensions = ["jpg", "JPG"]; // Add both lowercase and uppercase
  for (let i = 1; i <= maxImages; i++) {
    const suffix = i === 1 ? '' : `-${i}`;
    let found = false;
    for (const ext of extensions) {
      const url = `images/${id}${suffix}.${ext}`;
      try {
        const res = await fetch(url, { method: "HEAD" });
        if (res.ok) {
          urls.push(url);
          found = true;
          break; // Stop checking other extensions for this index
        }
      } catch {
        // ignore
      }
    }
    if (!found) break; // Stop at first missing image in sequence
  }
  return urls;
}

// Example usage:
// getSpecimenImages(1).then(urls => {
//   // urls = ["images/1.jpg", "images/1-2.jpg", ...]
//   // Render these images in your UI
// });


// === Handle hash navigation on page load or hash change ===
function loadFromHash() {
  const hash = window.location.hash;
  if (hash && hash.startsWith("#")) {
    const id = parseInt(hash.substring(1));
    if (!isNaN(id)) showSpecimen(id);
  }
}

window.addEventListener("hashchange", loadFromHash);
