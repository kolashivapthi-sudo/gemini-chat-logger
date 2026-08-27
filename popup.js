document.addEventListener("DOMContentLoaded", () => {
  const countEl = document.getElementById("count");
  const ratedEl = document.getElementById("rated");
  const statusEl = document.getElementById("status");
  const csvPreviewContainer = document.getElementById("csvPreviewContainer");
  const csvPreviewHead = document.getElementById("csvPreviewHead");
  const csvPreviewBody = document.getElementById("csvPreviewBody");
  const noLogsMsg = document.getElementById("noLogsMsg");
  const csvPreviewScroll = document.getElementById("csvPreviewScroll");

  loadStats();

  // ── Preview CSV (display inline, no download) ──────────────────────────────
  document.getElementById("previewCsv").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "EXPORT_CSV" }, (response) => {
      if (response?.csv) {
        renderCsvPreview(response.csv);
        csvPreviewContainer.classList.add("visible");
        csvPreviewContainer.scrollIntoView({ behavior: "smooth" });
      } else {
        showStatus("No logs to preview.");
      }
    });
  });

  // ── Close Preview ──────────────────────────────────────────────────────────
  document.getElementById("closePreview").addEventListener("click", () => {
    csvPreviewContainer.classList.remove("visible");
    csvPreviewHead.innerHTML = "";
    csvPreviewBody.innerHTML = "";
    noLogsMsg.style.display = "none";
    csvPreviewScroll.style.display = "";
  });

  // ── Export CSV ─────────────────────────────────────────────────────────────
  document.getElementById("exportCsv").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "EXPORT_CSV" }, (response) => {
      if (response?.csv) {
        downloadFile(response.csv, "gemini_logs.csv", "text/csv");
        showStatus("CSV exported successfully!");
      }
    });
  });

  // ── Export JSON ────────────────────────────────────────────────────────────
  document.getElementById("exportJson").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "GET_LOGS" }, (logs) => {
      if (logs) {
        const json = JSON.stringify(logs, null, 2);
        downloadFile(json, "gemini_logs.json", "application/json");
        showStatus("JSON exported successfully!");
      }
    });
  });

  // ── Clear Logs ─────────────────────────────────────────────────────────────
  document.getElementById("clearLogs").addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all logs?")) {
      chrome.storage.local.set({ logs: [] }, () => {
        loadStats();
        // Also close preview if open
        csvPreviewContainer.classList.remove("visible");
        csvPreviewHead.innerHTML = "";
        csvPreviewBody.innerHTML = "";
        showStatus("Logs cleared!");
      });
    }
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  function loadStats() {
    chrome.runtime.sendMessage({ type: "GET_LOGS" }, (logs) => {
      const all = logs || [];
      const rated = all.filter((l) => l.rating);
      countEl.textContent = all.length;
      ratedEl.textContent = rated.length;
    });
  }

  /**
   * Parses a CSV string and renders it as an HTML table inside the preview panel.
   * Handles quoted fields that may contain commas or newlines.
   */
  function renderCsvPreview(csvString) {
    csvPreviewHead.innerHTML = "";
    csvPreviewBody.innerHTML = "";

    const rows = parseCsv(csvString);

    if (rows.length === 0) {
      csvPreviewScroll.style.display = "none";
      noLogsMsg.style.display = "block";
      return;
    }

    noLogsMsg.style.display = "none";
    csvPreviewScroll.style.display = "";

    // Header row
    const headerRow = document.createElement("tr");
    rows[0].forEach((cell) => {
      const th = document.createElement("th");
      th.textContent = cell;
      headerRow.appendChild(th);
    });
    csvPreviewHead.appendChild(headerRow);

    // Data rows
    for (let i = 1; i < rows.length; i++) {
      const tr = document.createElement("tr");
      rows[i].forEach((cell) => {
        const td = document.createElement("td");
        td.textContent = cell;
        tr.appendChild(td);
      });
      csvPreviewBody.appendChild(tr);
    }

    if (rows.length <= 1) {
      csvPreviewScroll.style.display = "none";
      noLogsMsg.style.display = "block";
    }
  }

  /**
   * Minimal RFC-4180-compatible CSV parser.
   * Returns an array of rows, each row being an array of field strings.
   */
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
      const ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            // Escaped quote
            field += '"';
            i += 2;
          } else {
            inQuotes = false;
            i++;
          }
        } else {
          field += ch;
          i++;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
          i++;
        } else if (ch === ",") {
          row.push(field);
          field = "";
          i++;
        } else if (ch === "\r" && text[i + 1] === "\n") {
          row.push(field);
          field = "";
          rows.push(row);
          row = [];
          i += 2;
        } else if (ch === "\n") {
          row.push(field);
          field = "";
          rows.push(row);
          row = [];
          i++;
        } else {
          field += ch;
          i++;
        }
      }
    }

    // Push last field/row if any
    if (field !== "" || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    // Filter out completely empty trailing rows
    return rows.filter((r) => r.some((c) => c.trim() !== ""));
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function showStatus(msg) {
    statusEl.textContent = msg;
    setTimeout(() => {
      statusEl.textContent = "";
    }, 3000);
  }
});
