const photoCsvUrl = "https://docs.google.com/spreadsheets/d/1KWMTZaLluEq3l0XPYcfM1gixYcynKklUfWFdDePV05g/gviz/tq?tqx=out:csv&sheet=photo_ids";
const metaCsvUrl  = "https://docs.google.com/spreadsheets/d/1KWMTZaLluEq3l0XPYcfM1gixYcynKklUfWFdDePV05g/gviz/tq?tqx=out:csv&sheet=Database";

const sidebar = document.getElementById("sidebar");
const content = document.getElementById("main-content");

const photoMap = {};
const specimenMap = {};

// === Load photo_ids.csv ===
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

// === Load Database CSV and detect header dynamically ===
Papa.parse(metaCsvUrl, {
  download: true,
  header: false,
  complete: (results) => {
    const rows = results.data;

    let headerRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].includes("Catalog Number")) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      console.error("❌ Could not find header row with 'Catalog Number'");
      return;
    }

    const rawHeaderRow = rows[headerRowIndex];
    const headerRow = rawHeaderRow.map(col => col?.trim().replace(/\s+/g, " "));
    const dataRows = rows.slice(headerRowIndex + 1);

    console.log("✅ Detected header row:", headerRow);

    dataRows.forEach((row, rowIndex) => {
      if (!row || row.length === 0) return;

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

    console.log("✔ specimenMap loaded:", Object.keys(specimenMap));
    renderSidebar();
  }
});

function renderSidebar() {
    sidebar.innerHTML = "<h2>Specimens</h2>";
  
    Object.values(specimenMap).forEach(spec => {
      const div = document.createElement("div");
      div.className = "specimen";
      const speciesList = [
        spec["Species 1"],
        spec["Species 2"],
        spec["Species 3"],
        spec["Species 4"],
        spec["Species 5"]
      ].filter(Boolean).join(", ");
      
      div.textContent = `${spec["Catalog Number"]} | ${speciesList || "Unknown"}`;
      
      div.onclick = () => showSpecimen(parseInt(spec["Catalog Number"]));
      sidebar.appendChild(div);
    });
  }
  
  
  

  function showSpecimen(id) {
    const spec = specimenMap[id];
    const fileIds = photoMap[id] || [];
  
    // Gather all species names
    const species = [
      spec["Species 1"],
      spec["Species 2"],
      spec["Species 3"],
      spec["Species 4"],
      spec["Species 5"]
    ].filter(Boolean).join(", ");
  
    // Display any associated Mindat.org links in a bulleted list
    const mindatLinks = (spec["Species Info"] || "").split(/\s+/)
      .filter(url => url.startsWith("http"))
      .map(url => `<li><a href="${url}" target="_blank">${url}</a></li>`)
      .join("");
  
    content.innerHTML = `
      <h2>${spec["Specimen Title"] || species || `Catalog ${id}`}</h2>
  
      <div class="section">
        <p><strong>Catalog Number:</strong> ${id}</p>
        <p><strong>Species:</strong> ${species || "—"}</p>
        ${mindatLinks ? `<p><strong>Mindat Links:</strong><ul>${mindatLinks}</ul></p>` : ""}
        <p><strong>Locality:</strong> ${spec["Locality"] || "—"}</p>
        <p><strong>Date Acquired:</strong> ${spec["Date of Acquisition"] || "—"}</p>
        <p><strong>Dimensions:</strong> ${spec["Dimensions"] || "—"}</p>
        <p><strong>Max Crystal Size:</strong> ${spec["Max Crystal Size"] || "—"}</p>
        <p><strong>Source:</strong> ${spec["Specimen Source"] || "—"}</p>
        <p><strong>Notes:</strong> ${spec["Notes"] || "—"}</p>
        <p><strong>Coordinates:</strong> ${spec["Coordinates"] || "—"}</p>
      </div>
  
      <div class="images">
        ${
          fileIds.length > 0
            ? fileIds.map(fileId =>
                `<img src="https://drive.google.com/uc?export=view&id=${fileId}" style="max-width: 100%; max-height: 300px; margin: 10px 0;" />`
              ).join("")
            : "<p>No images found.</p>"
        }
      </div>
    `;
  }
  
