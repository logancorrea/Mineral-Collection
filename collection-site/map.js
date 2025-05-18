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
      header.forEach((col,i)=> obj[col] = r[i]);
      if (obj["Coordinates"] && obj["Coordinates"].includes(",")) {
        const [lat,lng] = obj["Coordinates"].split(",").map(s=>parseFloat(s));
        if (!isNaN(lat) && !isNaN(lng))
          specimens.push({ lat, lng,
            id: obj["Catalog ID"],
            title: obj["Specimen Title"] || obj["Species 1"] || "Specimen"
          });
      }
    });
    makeMap();
  }
});

function makeMap() {
  if (!specimens.length) { alert("No coords"); return; }

  const avgLat = specimens.reduce((s,p)=>s+p.lat,0)/specimens.length;
  const avgLng = specimens.reduce((s,p)=>s+p.lng,0)/specimens.length;

  const map = L.map("map").setView([avgLat, avgLng], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  /* ▶︎ create one cluster group ◀︎ */
  const cluster = L.markerClusterGroup({
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    maxClusterRadius: 40          // tweak if you like
  });

  /* add every marker to the group */
  specimens.forEach(sp => {
    const m = L.marker([sp.lat, sp.lng])
              .bindPopup(`<a href="index.html#${sp.id}">
                            ${sp.title} (Cat ID: ${sp.id})
                          </a>`);
    cluster.addLayer(m);
  });

  cluster.addTo(map);
}

