document.addEventListener("DOMContentLoaded", () => {
  const countEl = document.getElementById("count");
  const ratedEl = document.getElementById("rated");
  const statusEl = document.getElementById("status");

  loadStats();

  document.getElementById("exportCsv").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "EXPORT_CSV" }, (response) => {
      if (response?.csv) {
        downloadFile(response.csv, "gemini_logs.csv", "text/csv");
        showStatus("CSV exported successfully!");
      }
    });
  });

  document.getElementById("exportJson").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "GET_LOGS" }, (logs) => {
      if (logs) {
        const json = JSON.stringify(logs, null, 2);
        downloadFile(json, "gemini_logs.json", "application/json");
        showStatus("JSON exported successfully!");
      }
    });
  });

  document.getElementById("clearLogs").addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all logs?")) {
      chrome.storage.local.set({ logs: [] }, () => {
        loadStats();
        showStatus("Logs cleared!");
      });
    }
  });

  function loadStats() {
    chrome.runtime.sendMessage({ type: "GET_LOGS" }, (logs) => {
      const all = logs || [];
      const rated = all.filter((l) => l.rating);
      countEl.textContent = all.length;
      ratedEl.textContent = rated.length;
    });
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
