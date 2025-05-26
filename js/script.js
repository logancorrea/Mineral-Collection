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
  });

  content.innerHTML = `
    <h2>Collection Stats</h2>
    <ul style="font-size:1.2em;line-height:1.7;">
      <li><strong>Total Specimens:</strong> ${totalSpecimens}</li>
      <li><strong>Unique  Minerals:</strong> ${uniqueSpecies.size}</li>
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

  let mainIndex = 0; // Track the main image index

  function renderCarousel(images) {
    const galleryDiv = document.getElementById("gallery-content");
    if (!galleryDiv) return;

    const description = spec["Description"]?.trim() || "";

    galleryDiv.innerHTML = `
      <div class="carousel-main-image-wrap">
        <img src="${images[mainIndex]}" alt="${description}" class="carousel-main-image" id="carousel-main-image" style="cursor:pointer;" />
      </div>
      ${
        images.length > 1
          ? `<div class="carousel-thumbnails" id="carousel-thumbnails">
              ${images.map((img, idx) => `
                <img src="${img}" alt="Thumbnail ${idx + 1}" class="carousel-thumb${idx === mainIndex ? ' active' : ''}" data-idx="${idx}" />
              `).join('')}
            </div>`
          : ""
      }
      <!-- Modal HTML stays the same -->
      <div id="img-modal" class="img-modal hidden">
        <div style="display:flex; flex-direction:row; align-items:center; justify-content:center;">
          <button class="carousel-btn" id="modalPrevBtn">‹</button>
          <div class="img-modal-col" style="display:flex; flex-direction:column; align-items:center; position:relative;">
            <span class="img-modal-close" id="img-modal-close" style="position:absolute; left:0; top:0; font-size:2.5em; color:#fff; cursor:pointer; z-index:10; padding:0 16px;">&times;</span>
            <img class="img-modal-content" id="img-modal-img" />
            <!-- Move navigator here -->
            <div class="img-modal-navigator" id="img-modal-navigator" style="display:none;">
              <div class="img-modal-navigator-img-wrap">
                <img id="img-modal-navigator-img" src="" alt="Navigator" />
                <div id="img-modal-navigator-box" class="img-modal-navigator-box"></div>
              </div>
            </div>
            <div id="img-modal-desc" class="img-modal-desc" style="color:#fff; text-align:center; margin-top:1em; max-width:90vw;"></div>
          </div>
          <button class="carousel-btn" id="modalNextBtn">›</button>
        </div>
      </div>
    `;

    // Only add thumbnail click logic if there are thumbnails
    if (images.length > 1) {
      document.querySelectorAll('.carousel-thumb').forEach(thumb => {
        thumb.addEventListener('click', () => {
          mainIndex = parseInt(thumb.dataset.idx, 10);
          renderCarousel(images);
        });
      });
    }

    // Main image click opens modal
    const mainImg = document.getElementById('carousel-main-image');
    mainImg.addEventListener('click', () => {
      // Open modal with mainIndex
      modal.classList.remove("hidden");
      modalImg.src = images[mainIndex];
      modalImg.alt = description;
      document.getElementById("img-modal-desc").textContent = description;
      modalIndex = mainIndex;
      updateModalButtons();
    });

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
    const navigator = document.getElementById('img-modal-navigator');
    const navigatorImg = document.getElementById('img-modal-navigator-img');
    const navigatorBox = document.getElementById('img-modal-navigator-box');

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
          document.getElementById("img-modal-desc").textContent = description;
          updateModalButtons();
          // Reset zoom and pan
          zoom = 1;
          lastX = 0;
          lastY = 0;
          modalImg.style.transform = 'scale(1)';
          modalImg.style.cursor = "grab";
          updateNavigator(zoom, lastX, lastY);
        }
      });
    }
    if (modalNextBtn) {
      modalNextBtn.addEventListener("click", () => {
        if (modalIndex < images.length - 1) {
          modalIndex++;
          modalImg.src = images[modalIndex];
          modalImg.alt = description;
          document.getElementById("img-modal-desc").textContent = description;
          updateModalButtons();
          // Reset zoom and pan
          zoom = 1;
          lastX = 0;
          lastY = 0;
          modalImg.style.transform = 'scale(1)';
          modalImg.style.cursor = "grab";
          updateNavigator(zoom, lastX, lastY);
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

    // --- Image zooming logic ---
    let zoom = 1;
    const ZOOM_STEP = 0.1;
    const ZOOM_MIN = 0.2;
    const ZOOM_MAX = 5;

    modalImg.addEventListener('wheel', function(e) {
      e.preventDefault();
      if (e.deltaY < 0) {
        zoom = Math.min(zoom + ZOOM_STEP, ZOOM_MAX);
      } else {
        zoom = Math.max(zoom - ZOOM_STEP, ZOOM_MIN);
      }
      modalImg.style.transform = `scale(${zoom})`;
      modalImg.style.transition = 'transform 0.1s';
      updateNavigator(zoom, lastX, lastY); // Update navigator on zoom
    });

    modalClose.addEventListener('click', () => {
      zoom = 1;
      modalImg.style.transform = 'scale(1)';
    });

    // --- Drag-to-pan logic for zoomed modal image ---
    let isDragging = false;
    let startX = 0, startY = 0;
    let lastX = 0, lastY = 0;

    modalImg.style.cursor = "grab";

    modalImg.addEventListener('mousedown', function(e) {
      if (zoom <= 1) return; // Only allow drag when zoomed in
      isDragging = true;
      startX = e.clientX - lastX;
      startY = e.clientY - lastY;
      modalImg.style.cursor = "grabbing";
      e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      lastX = e.clientX - startX;
      lastY = e.clientY - startY;
      modalImg.style.transform = `scale(${zoom}) translate(${lastX / zoom}px, ${lastY / zoom}px)`;
      updateNavigator(zoom, lastX, lastY); // Update navigator on drag
    });

    document.addEventListener('mouseup', function() {
      if (isDragging) {
        isDragging = false;
        modalImg.style.cursor = "grab";
      }
    });

    // Reset pan on zoom reset/close
    modalClose.addEventListener('click', () => {
      zoom = 1;
      lastX = 0;
      lastY = 0;
      modalImg.style.transform = 'scale(1)';
      modalImg.style.cursor = "grab";
    });

    // Show navigator when zoomed in
    function updateNavigator(zoom, lastX, lastY) {
      if (zoom <= 1) {
        navigator.style.display = 'none';
        return;
      }
      navigator.style.display = 'flex';
      navigatorImg.src = modalImg.src;

      // Get modal image and container sizes
      const imgRect = modalImg.getBoundingClientRect();
      const modalRect = modalImg.closest('.img-modal-col').getBoundingClientRect();

      // Navigator sizes
      const navW = navigatorImg.offsetWidth;
      const navH = navigatorImg.offsetHeight;

      // Calculate visible area as a fraction of the zoomed image
      const scale = zoom;
      const viewW = modalRect.width / (imgRect.width * scale);
      const viewH = modalRect.height / (imgRect.height * scale);

      // Calculate box position (centered panning)
      const centerX = 0.5 - (lastX / (imgRect.width * scale));
      const centerY = 0.5 - (lastY / (imgRect.height * scale));
      const boxLeft = (centerX - viewW / 2) * navW;
      const boxTop = (centerY - viewH / 2) * navH;
      const boxWidth = viewW * navW;
      const boxHeight = viewH * navH;

      navigatorBox.style.left = `${boxLeft}px`;
      navigatorBox.style.top = `${boxTop}px`;
      navigatorBox.style.width = `${boxWidth}px`;
      navigatorBox.style.height = `${boxHeight}px`;
    }

    // Call updateNavigator(zoom, lastX, lastY) whenever zoom or pan changes
    // Example (inside your wheel and drag handlers):
    // updateNavigator(zoom, lastX, lastY);

    // Hide navigator on modal close
    modalClose.addEventListener('click', () => {
      navigator.style.display = 'none';
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
    <div class="specimen-flex-row">
      <div class="specimen-images">
        <div id="gallery-content"></div>
      </div>
      <div class="specimen-details">
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
          <p><strong>Dimensions:</strong> ${spec["Dimensions"] ? spec["Dimensions"] + "mm" : "—"}</p>
          <p><strong>Max Crystal Size:</strong> ${spec["Max Crystal Size"] ? spec["Max Crystal Size"] + "mm" : "—"}</p>
          <p><strong>Source:</strong> ${spec["Specimen Source"] || "—"}</p>
          <p><strong>Notes:</strong> ${spec["Notes"] || "—"}</p>
          <p><strong>Coordinates:</strong> ${spec["Coordinates"] || "—"}</p>
        </div>
      </div>
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
document.getElementById('thumbsPrevBtn').onclick = () => {
  document.getElementById('carousel-thumbnails').scrollBy({left: -120, behavior: 'smooth'});
};
document.getElementById('thumbsNextBtn').onclick = () => {
  document.getElementById('carousel-thumbnails').scrollBy({left: 120, behavior: 'smooth'});
};

function matchDetailsCardToImage() {
  const img = document.getElementById('main-specimen-image');
  const card = document.getElementById('specimen-details-card');
  if (img && card) {
    // Wait for image to load to get correct height
    if (!img.complete) {
      img.onload = () => matchDetailsCardToImage();
      return;
    }
    card.style.height = img.offsetHeight + 'px';
  }
}

// Call after rendering specimen content
matchDetailsCardToImage();

// Optionally, re-run on window resize for responsiveness
window.addEventListener('resize', matchDetailsCardToImage);

// --- Static Modal Logic ---
function openStaticModal(images, i, spec, description) {
  currentModalImages = images;
  currentModalIndex = i;
  currentModalSpec = spec;

  // (Optional: set modal header content here if needed)
  modalImg.src = images[i];
  modalImg.alt = description;
  modalDesc.textContent = spec["Description"] || '';
  modal.classList.remove('hidden');
  btnPrev.disabled = (i === 0);
  btnNext.disabled = (i === images.length - 1);
}

document.addEventListener('keydown', function(e) {
  // Only run keyboard navigation if the modal is visible
  if (modal.classList.contains('hidden')) return;
  
  if (e.key === "ArrowLeft" && !btnPrev.disabled) {
    btnPrev.click();
    e.preventDefault();
  }
  
  if (e.key === "ArrowRight" && !btnNext.disabled) {
    btnNext.click();
    e.preventDefault();
  }
  
  if (e.key === "Escape") {
    btnClose.click();
    e.preventDefault();
  }
});

btnClose.onclick = () => {
  modal.classList.add('hidden');
  // No need to reset document.onkeydown because our global listener checks modal visibility
};
