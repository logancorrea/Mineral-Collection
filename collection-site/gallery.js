const metaCsvUrl = "https://docs.google.com/spreadsheets/d/1KWMTZaLluEq3l0XPYcfM1gixYcynKklUfWFdDePV05g/gviz/tq?tqx=out:csv&sheet=Database";

const galleryGrid = document.getElementById("gallery-grid");
const extensions = ["jpg", "jpeg", "png", "webp"];

async function imageExists(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

function getFirstImageUrl(id) {
  return Promise.all(
    extensions.map(ext => fetch(`images/${id}.${ext}`, { method: "HEAD" }).then(res => res.ok ? `images/${id}.${ext}` : null).catch(() => null))
  ).then(results => results.find(Boolean) || "images/test.jpg");
}

// Load specimen data
Papa.parse(metaCsvUrl, {
  download: true,
  header: false,
  complete: async (results) => {
    const rows = results.data;
    const headerIndex = rows.findIndex(row => row.includes("Catalog Number"));
    if (headerIndex === -1) return;

    const headers = rows[headerIndex].map(col => col?.trim());
    const dataRows = rows.slice(headerIndex + 1);

    for (const row of dataRows) {
      const spec = {};
      headers.forEach((col, i) => spec[col] = row[i]);

      const id = parseInt(spec["Catalog Number"]);
      if (!id) continue;

      const species = [
        spec["Species 1"], spec["Species 2"],
        spec["Species 3"], spec["Species 4"], spec["Species 5"]
      ].filter(Boolean).join(", ");

      const imageUrl = await getFirstImageUrl(id);

      const card = document.createElement("div");
      card.className = "gallery-card";
      card.innerHTML = `
        <a href="index.html#${id}">
          <img src="${imageUrl}" alt="Specimen ${id}" />
          <div class="caption">Catalog ${id}<br>${species || "—"}</div>
        </a>
      `;
      galleryGrid.appendChild(card);
    }
  }
});
