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

  // --- Render collection stats on home page ---
  renderCollectionStats();
}

function renderCollectionStats() {
  // Only show stats if no specimen is selected (no hash)
  if (window.location.hash && window.location.hash.length > 1) return;

  const specimens = Object.values(specimenMap);
  const totalSpecimens = specimens.length;
  const uniqueSpecies = new Set();
  let totalImages = 0;

  specimens.forEach(spec => {
    // Count unique species
    ["Species 1", "Species 2", "Species 3", "Species 4", "Species 5"].forEach(key => {
      if (spec[key]) uniqueSpecies.add(spec[key].trim());
    });
    // Count images (estimate by Photos column or just 1 per specimen)
    if (spec["Photos"] && !isNaN(spec["Photos"])) {
      totalImages += parseInt(spec["Photos"]);
    } else {
      totalImages += 1;
    }
  });

  content.innerHTML = `
    <h2>Collection Stats</h2>
    <ul style="font-size:1.2em;line-height:1.7;">
      <li><strong>Total Specimens:</strong> ${totalSpecimens}</li>
      <li><strong>Unique Species:</strong> ${uniqueSpecies.size}</li>
      <li><strong>Total Images:</strong> ${totalImages}</li>
    </ul>
    <p style="color:#888;">Select a specimen from the sidebar to view details.</p>
    <div id="stats-map" style="height:400px;margin-top:2em;border-radius:8px;overflow:hidden;"></div>
  `;

  // --- Add map with all specimen markers ---
  setTimeout(() => {
    if (typeof L === "undefined" || typeof L.markerClusterGroup === "undefined") return; // Leaflet or cluster not loaded

    // Gather all valid specimens with coordinates
    const points = [];
    specimens.forEach(spec => {
      const coordString = spec["Coordinates"];
      if (coordString && coordString.includes(",")) {
        const [lat, lng] = coordString.split(",").map(s => parseFloat(s));
        if (!isNaN(lat) && !isNaN(lng)) {
          points.push({
            lat, lng,
            id: spec["Catalog ID"],
            title: spec["Specimen Title"] || "",
            species: [
              spec["Species 1"], spec["Species 2"], spec["Species 3"],
              spec["Species 4"], spec["Species 5"]
            ].filter(Boolean).join(", "),
            locality: spec["Locality"] || ""
          });
        }
      }
    });

    // Center map on average of points, fallback to [20,0]
    let center = [20, 0];
    if (points.length) {
      const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
      const avgLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
      center = [avgLat, avgLng];
    }

    const map = L.map("stats-map").setView(center, 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const cluster = L.markerClusterGroup({
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      maxClusterRadius: 40
    });

    points.forEach(sp => {
      const marker = L.marker([sp.lat, sp.lng])
        .bindPopup(`<a href="#${sp.id}">${sp.title || sp.species || "Specimen"} (Cat ID: ${sp.id})</a><br>${sp.locality}`);
      cluster.addLayer(marker);
    });

    map.addLayer(cluster);
  }, 0);
}

// === Main Viewer ===
async function showSpecimen(id) {
  const spec = specimenMap[id];
  if (!spec) return;

  const species = [
    spec["Species 1"], spec["Species 2"], spec["Species 3"],
    spec["Species 4"], spec["Species 5"]
  ].filter(Boolean).join(", ");

  const speciesNames = [
    spec["Species 1"], spec["Species 2"], spec["Species 3"],
    spec["Species 4"], spec["Species 5"]
  ].filter(Boolean);

  const speciesInfoLinks = (spec["Species Info"] || "")
    .split(/\s+/)
    .filter(url => url.startsWith("http"));

  console.log("speciesNames", speciesNames, "speciesInfoLinks", speciesInfoLinks);

  let mindatLinks = "";
  if (speciesNames.length && speciesInfoLinks.length) {
    mindatLinks = speciesNames.map((name, i) => {
      const url = speciesInfoLinks[i] || speciesInfoLinks[0]; // fallback to first if not enough links
      return `<li><a href="${url}" target="_blank">${name}</a></li>`;
    }).join("");
  } else if (speciesInfoLinks.length) {
    mindatLinks = speciesInfoLinks.map(url =>
      `<li><a href="${url}" target="_blank">${url}</a></li>`
    ).join("");
  }

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
        // Update description for the current image
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
          // Update description for the new image
          document.getElementById("img-modal-desc").textContent = description;
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
          // Update description for the new image
          document.getElementById("img-modal-desc").textContent = description;
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
  const localityText = spec["Locality"] || "—";
  const localityHtml = mindatLocUrl
    ? `<a href="${mindatLocUrl}" target="_blank">${localityText}</a>`
    : localityText;

  content.innerHTML = `
    <h2>${spec["Specimen Title"] || species || `Catalog ${id}`}</h2>

    <div class="gallery">
      <div id="gallery-content"></div>
    </div>

    <div class="section">
      <p><strong>Catalog ID:</strong> ${id}</p>
      <p><strong>Mindat ID:</strong> ${spec["MinID"] || "—"}</p>
      ${
        speciesInfoLinks.length
          ? `<p><strong>Species:</strong> ${
              speciesNames.length
                ? speciesNames.map((name, i) => {
                    const url = speciesInfoLinks[i] || speciesInfoLinks[0];
                    return `<a href="${url}" target="_blank">${name}</a>`;
                  }).join(", ")
                : speciesInfoLinks.map(url => `<a href="${url}" target="_blank">${url}</a>`).join(", ")
            }</p>`
          : ""
      }
      <p><strong>Locality:</strong> ${localityHtml}</p>
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

// Home link functionality
document.addEventListener("DOMContentLoaded", () => {
  const homeLink = document.getElementById("home-link");
  if (homeLink) {
    homeLink.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.hash = "";
      renderCollectionStats();
    });
  }
});

// --- Link preview popup ---
document.addEventListener("DOMContentLoaded", () => {
  const preview = document.createElement("div");
  preview.className = "link-preview-popup";
  document.body.appendChild(preview);

  document.body.addEventListener("mouseover", function(e) {
    const a = e.target.closest('a[href^="http"]');
    if (a && a.closest("#main-content")) {
      const url = a.href;
      preview.style.display = "block";
      preview.style.left = (e.pageX + 20) + "px";
      preview.style.top = (e.pageY - 40) + "px";
      // Show favicon and full URL as a preview
      const domain = url.replace(/^https?:\/\//, '').split('/')[0];
      const favicon = `https://www.google.com/s2/favicons?domain=${domain}`;
      preview.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <img src="${favicon}" style="width:20px;height:20px;vertical-align:middle;border-radius:3px;" alt="favicon"/>
          <span style="font-weight:600;word-break:break-all;">${url}</span>
        </div>
      `;
    }
  });

  document.body.addEventListener("mousemove", function(e) {
    if (preview.style.display === "block") {
      preview.style.left = (e.pageX + 20) + "px";
      preview.style.top = (e.pageY - 40) + "px";
    }
  });

  document.body.addEventListener("mouseout", function(e) {
    const a = e.target.closest('a[href^="http"]');
    if (a && a.closest("#main-content")) {
      preview.style.display = "none";
      preview.innerHTML = "";
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  if (window.location.hash) loadFromHash();
});
