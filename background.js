chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_LOGS") {
    chrome.storage.local.get("logs", (data) => {
      sendResponse(data.logs || []);
    });
    return true;
  }

  if (request.type === "SAVE_LOG") {
    chrome.storage.local.get("logs", (data) => {
      const logs = data.logs || [];
      logs.push(request.log);
      chrome.storage.local.set({ logs }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (request.type === "UPDATE_RATING") {
    chrome.storage.local.get("logs", (data) => {
      const logs = data.logs || [];
      const log = logs.find(l => l.id === request.id);
      if (log) {
        log.rating = request.rating;
        chrome.storage.local.set({ logs }, () => {
          sendResponse({ success: true });
        });
      } else {
        sendResponse({ success: false });
      }
    });
    return true;
  }

  if (request.type === "EXPORT_CSV") {
    chrome.storage.local.get("logs", (data) => {
      const logs = data.logs || [];
      const csv = convertToCSV(logs);
      sendResponse({ csv });
    });
    return true;
  }
});

function convertToCSV(logs) {
  const headers = [
    "entry_number",
    "question_timestamp",
    "answer_timestamp",
    "question_text",
    "question_tokens",
    "answer_text",
    "answer_tokens",
    "rating"
  ];

  const rows = logs.map(log => [
    log.entry_number,
    log.question_timestamp,
    log.answer_timestamp,
    `"${(log.question_text || "").replace(/"/g, '""')}"`,
    log.question_tokens || "",
    `"${(log.answer_text || "").replace(/"/g, '""')}"`,
    log.answer_tokens || "",
    log.rating || ""
  ]);

  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}
