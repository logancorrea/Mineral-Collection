const photoCsvUrl = "https://docs.google.com/spreadsheets/d/1KWMTZaLluEq3l0XPYcfM1gixYcynKklUfWFdDePV05g/gviz/tq?tqx=out:csv&sheet=photo_ids";
const metaCsvUrl  = "https://docs.google.com/spreadsheets/d/1KWMTZaLluEq3l0XPYcfM1gixYcynKklUfWFdDePV05g/gviz/tq?tqx=out:csv&sheet=Database";

const sidebar = document.getElementById("sidebar");
const content = document.getElementById("main-content");

const photoMap = {};
const specimenMap = {};

Papa.parse(photoCsvUrl, {
  download: true,
  header: true,
  complete: (results) => {
    results.data.forEach(row => {
      const id = parseInt(row["Catalog Number"]);
      if (!isNaN(id) && row["File IDs"]) {
        photoMap[id] = row["File IDs"].split(",").map(s => s.trim());
      }
    });
  }
});

Papa.parse(metaCsvUrl, {
  download: true,
  header: true,
  complete: (results) => {
    results.data.forEach(row => {
      const id = parseInt(row["Catalog Number"]);
      if (!isNaN(id)) {
        specimenMap[id] = row;
      }
    });
    renderSidebar();
  }
});

function renderSidebar() {
  Object.values(specimenMap).forEach(spec => {
    const div = document.createElement("div");
    div.className = "specimen";
    div.textContent = `${spec["Catalog Number"]}: ${spec["Name"]}`;
    div.onclick = () => showSpecimen(parseInt(spec["Catalog Number"]));
    sidebar.appendChild(div);
  });
}

function showSpecimen(id) {
  const spec = specimenMap[id];
  const fileIds = photoMap[id] || [];

  content.innerHTML = `
    <h2>${spec["Name"]} (#${id})</h2>
    <p><strong>Formula:</strong> ${spec["Formula"]}</p>
    <p><strong>Hardness:</strong> ${spec["Hardness"]}</p>
    <p><strong>Color:</strong> ${spec["Color"]}</p>
    <div class="images">
      ${
        fileIds.length > 0
          ? fileIds.map(id => `<img src="https://drive.google.com/uc?export=view&id=${id}" />`).join("")
          : "<p>No images found.</p>"
      }
    </div>
  `;
}
