// use the same sheet URLs
const metaCsvUrl  = "https://docs.google.com/spreadsheets/d/1KWMTZaLluEq3l0XPYcfM1gixYcynKklUfWFdDePV05g/gviz/tq?tqx=out:csv&sheet=Database";

const specimens = [];
Papa.parse(metaCsvUrl, {
  download: true,
  header: false,
  complete: res => {
    const rows = res.data;
    const hdrRow = rows.findIndex(r => r.includes("Catalog ID"));
    if (hdrRow === -1) return;

    const header = rows[hdrRow].map(c => c.trim());
    rows.slice(hdrRow + 1).forEach(r => {
      const obj = {};
      header.forEach((col, i) => obj[col] = r[i]);
      if (obj["Coordinates"] && obj["Coordinates"].includes(",")) {
        const [lat, lng] = obj["Coordinates"].split(",").map(s => parseFloat(s));
        if (!isNaN(lat) && !isNaN(lng))
          specimens.push({ 
            lat, lng,
            id: obj["Catalog ID"],
            title: obj["Specimen Title"] || "",
            species: [
              obj["Species 1"], obj["Species 2"], obj["Species 3"],
              obj["Species 4"], obj["Species 5"]
            ].filter(Boolean).join(", "),
            source: obj["Specimen Source"] || ""   // <-- Changed: use "Specimen Source" instead of Locality
          });
      }
    });
    populateFilters(specimens);  // Populate the dropdowns using specimens data
    makeMap();
  }
});

let allMarkers = [];

function populateFilters(specimensArray) {
  const sourceSet = new Set();
  const speciesSet = new Set();

  specimensArray.forEach(pt => {
    if (pt.source) sourceSet.add(pt.source);
    if (pt.species) {
      pt.species.split(",").map(s => s.trim()).forEach(s => {
        if (s) speciesSet.add(s);
      });
    }
  });
  
  // Update: we now use a dropdown with id "sourceFilter"
  const sourceSelect = document.getElementById("sourceFilter");
  const speciesSelect = document.getElementById("speciesFilter");
  
  sourceSet.forEach(source => {
    const option = document.createElement("option");
    option.value = source;
    option.textContent = source;
    sourceSelect.appendChild(option);
  });
  
  speciesSet.forEach(species => {
    const option = document.createElement("option");
    option.value = species;
    option.textContent = species;
    speciesSelect.appendChild(option);
  });
}

function makeMap() {
  if (!specimens.length) { alert("No coords"); return; }

  const avgLat = specimens.reduce((s, p) => s + p.lat, 0) / specimens.length;
  const avgLng = specimens.reduce((s, p) => s + p.lng, 0) / specimens.length;

  const map = L.map('map').setView([avgLat, avgLng], 2);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const cluster = L.markerClusterGroup({
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    maxClusterRadius: 40
  });

  allMarkers = specimens.map(sp => {
    const imageUrl = `images/${sp.id}.jpg`;

    const popupHtml = `
      <div style="min-width:220px;max-width:340px;">
        <img src="${imageUrl}" alt="Specimen ${sp.id}" style="width:100%;max-width:220px;max-height:160px;object-fit:contain;border-radius:8px;border:1px solid #ccc;box-shadow:0 1px 8px #0002;margin-bottom:10px;">
        <div style="font-weight:600;font-size:1.1em;margin-bottom:4px;">${sp.title || sp.species || "Specimen"} (Cat ID: ${sp.id})</div>
        <div style="font-size:1em;margin-bottom:2px;">${sp.species || ""}</div>
        <div style="font-size:0.97em;color:#aaa;">${sp.lat.toFixed(4)}, ${sp.lng.toFixed(4)}</div>
        <button id="goto-specimen-${sp.id}" style="margin-top:10px;padding:0.5em 1.2em;font-size:1em;border-radius:6px;border:none;background:#008397;color:#fff;cursor:pointer;">View Specimen</button>
      </div>
    `;

    const marker = L.marker([sp.lat, sp.lng])
      .bindTooltip(
        `<div style="display:flex;align-items:center;gap:12px;min-width:220px;">
          <img src="${imageUrl}" alt="Specimen ${sp.id}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid #ccc;box-shadow:0 1px 4px #0002;">
          <div>
            <div style="font-weight:600;">${sp.title || sp.species || "Specimen"} (Cat ID: ${sp.id})</div>
            <div style="font-size:0.97em;">${sp.species || ""}</div>
            <div style="font-size:0.97em;">${sp.lat.toFixed(4)}, ${sp.lng.toFixed(4)}</div>
          </div>
        </div>`,
        { direction: 'top', sticky: true, className: 'map-hover-tooltip', opacity: 1 }
      )
      .bindPopup(popupHtml, { className: 'map-large-popup', maxWidth: 420 })
      .on('mouseover', function(e) { this.openTooltip(); })
      .on('mouseout', function(e) { this.closeTooltip(); })
      .on('click', function(e) {
        this.openPopup();
        setTimeout(() => {
          const btn = document.getElementById(`goto-specimen-${sp.id}`);
          if (btn) {
            btn.onclick = () => {
              window.location.href = `index.html#${sp.id}`;
            };
          }
        }, 100);
      });

    cluster.addLayer(marker);
    marker._specimenData = sp;
    return marker;
  });

  cluster.addTo(map);

  // --- Unified text search logic ---
  const searchInput = document.getElementById("mapSearch");
  if (searchInput) {
    searchInput.addEventListener("input", filterMarkers);
  }
  
  // --- Updated Dropdown filter event listeners ---
  // Now using "sourceFilter" instead of "localityFilter"
  const sourceSelect = document.getElementById("sourceFilter");
  const speciesSelect = document.getElementById("speciesFilter");

  if (sourceSelect) sourceSelect.addEventListener("change", filterMarkers);
  if (speciesSelect) speciesSelect.addEventListener("change", filterMarkers);

  // --- Function to filter markers based on text search, specimen source, and species ---
  function filterMarkers() {
    const q = (searchInput ? searchInput.value.trim().toLowerCase() : "");
    const selectedSource = (sourceSelect ? sourceSelect.value : "");
    const selectedSpecies = (speciesSelect ? speciesSelect.value : "");

    cluster.clearLayers();
    allMarkers.forEach(marker => {
      const sp = marker._specimenData;
      const id = sp.id ? sp.id.toString() : "";
      const title = (sp.title || "").toLowerCase();
      const species = (sp.species || "").toLowerCase();
      const source = (sp.source || "").toLowerCase();
      const searchText = `${id} ${title} ${species} ${source}`;
      
      const textMatches = searchText.includes(q);
      const sourceMatches = selectedSource ? source === selectedSource.toLowerCase() : true;
      const speciesMatches = selectedSpecies ? species.includes(selectedSpecies.toLowerCase()) : true;
      
      if (textMatches && sourceMatches && speciesMatches) {
        cluster.addLayer(marker);
      }
    });
  }
}

