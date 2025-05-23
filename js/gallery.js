const metaCsvUrl = "https://docs.google.com/spreadsheets/d/1KWMTZaLluEq3l0XPYcfM1gixYcynKklUfWFdDePV05g/gviz/tq?tqx=out:csv&sheet=Database";

const galleryGrid = document.getElementById("gallery-grid");
const extensions = ["jpg", "JPG", "jpeg", "png", "webp"];

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
    const headerIndex = rows.findIndex(row => row.includes("Catalog ID"));
    if (headerIndex === -1) return;

    const headers = rows[headerIndex].map(col => col?.trim());
    const dataRows = rows.slice(headerIndex + 1);

    for (const row of dataRows) {
      const spec = {};
      headers.forEach((col, i) => spec[col] = row[i]);

      const id = parseInt(spec["Catalog ID"]);
      if (!id) continue;

      const species = [
        spec["Species 1"], spec["Species 2"],
        spec["Species 3"], spec["Species 4"], spec["Species 5"]
      ].filter(Boolean).join(", ");

      const title = spec["Specimen Title"]?.trim();
      const description = spec["Description"]?.trim() || ""; // Get Description

      // Label: Title (or species if missing), then Catalog ID
      let labelMain = title ? title : (species ? species : "Specimen");
      let label = `<span style="font-weight:600;">${labelMain}</span><br><span style="font-size:0.95em;color:#888;">Catalog ID: ${id}</span>`;

      const searchTitle = title ? title.toLowerCase() : "";
      const speciesStr = species.toLowerCase();
      const idStr = id.toString();

      const imageUrl = await getFirstImageUrl(id);

      const card = document.createElement("div");
      card.className = "gallery-card";
      card.dataset.search = `${idStr} ${searchTitle} ${speciesStr}`;
      card.dataset.id = id;
      card.innerHTML = `
        <a href="index.html#${id}">
          <img src="${imageUrl}" alt="${description || labelMain}" />
          <div class="caption">${label}</div>
        </a>
      `;
      galleryGrid.appendChild(card);
    }

    // --- Add search functionality ---
    const searchInput = document.getElementById("gallerySearch");
    searchInput.addEventListener("input", function() {
      const q = this.value.trim().toLowerCase();
      document.querySelectorAll("#gallery-grid .gallery-card").forEach(card => {
        const searchText = card.dataset.search;
        card.style.display = searchText.includes(q) ? "" : "none";
      });
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const galleryModal = document.getElementById("gallery-modal");
  const galleryModalImg = document.getElementById("gallery-modal-img");
  const galleryModalClose = document.getElementById("gallery-modal-close");
  const galleryModalPrevBtn = document.getElementById("galleryModalPrevBtn");
  const galleryModalNextBtn = document.getElementById("galleryModalNextBtn");
  const galleryModalDesc = document.getElementById("gallery-modal-desc");

  let galleryModalImages = [];
  let galleryModalIndex = 0;

  async function getSpecimenImages(id, maxImages = 5) {
    const urls = [];
    const extensions = ["jpg", "JPG", "jpeg", "png", "webp"];
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
            break;
          }
        } catch {}
      }
      if (!found) break;
    }
    return urls;
  }

  function showGalleryModalImage() {
    galleryModalImg.src = galleryModalImages[galleryModalIndex];
    galleryModalDesc.textContent = `Image ${galleryModalIndex + 1} of ${galleryModalImages.length}`;
    galleryModalPrevBtn.disabled = galleryModalIndex === 0;
    galleryModalNextBtn.disabled = galleryModalIndex === galleryModalImages.length - 1;
  }

  if (galleryModalPrevBtn) {
    galleryModalPrevBtn.addEventListener("click", () => {
      if (galleryModalIndex > 0) {
        galleryModalIndex--;
        showGalleryModalImage();
      }
    });
  }
  if (galleryModalNextBtn) {
    galleryModalNextBtn.addEventListener("click", () => {
      if (galleryModalIndex < galleryModalImages.length - 1) {
        galleryModalIndex++;
        showGalleryModalImage();
      }
    });
  }
  if (galleryModalClose) {
    galleryModalClose.addEventListener("click", () => {
      galleryModal.classList.add("hidden");
      galleryModalImg.src = "";
    });
  }
  if (galleryModal) {
    galleryModal.addEventListener("click", (e) => {
      if (e.target === galleryModal) {
        galleryModal.classList.add("hidden");
        galleryModalImg.src = "";
      }
    });
  }
});
