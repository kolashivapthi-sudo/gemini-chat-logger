(() => {
  "use strict";

  const PROCESSED_ATTR = "data-gemini-logger-processed";
  let entryCounter = 0;

  // Inject the fetch interceptor into the page context
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("inject.js");
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => script.remove();

  // Load existing log count
  chrome.runtime.sendMessage({ type: "GET_LOGS" }, (logs) => {
    entryCounter = (logs || []).length;
  });

  // Listen for intercepted log entries
  window.addEventListener("gemini-logger-entry", (e) => {
    const logEntry = e.detail;
    logEntry.entry_number = ++entryCounter;
    chrome.runtime.sendMessage({ type: "SAVE_LOG", log: logEntry });

    // Attach rating to the latest response element
    attachStarRatingToLatestResponse(logEntry);
  });

  // Observe DOM for new response elements
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          scanForResponses(node);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  function scanForResponses(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const selectors = [
      '[data-message-author-role="1"]',
      "model-response",
      ".model-response-text",
      ".response-container",
      'message-content[class*="model"]',
    ];

    for (const sel of selectors) {
      const matches = node.matches?.(sel) ? [node] : [];
      const found = node.querySelectorAll?.(sel) || [];
      [...matches, ...found].forEach(tryAttachStars);
    }
  }

  function tryAttachStars(el) {
    if (el.getAttribute(PROCESSED_ATTR)) return;
    el.setAttribute(PROCESSED_ATTR, "true");

    const container = el.closest(
      '[data-message-author-role="1"], model-response, .response-container'
    ) || el.parentElement;

    if (!container || container.querySelector(".gemini-logger-stars")) return;

    injectStarUI(container, el);
  }

  function attachStarRatingToLatestResponse(logEntry) {
    const responses = document.querySelectorAll(
      '[data-message-author-role="1"], model-response, .model-response-text'
    );
    if (responses.length === 0) return;

    const last = responses[responses.length - 1];
    const container = last.closest(
      '[data-message-author-role="1"], model-response, .response-container'
    ) || last.parentElement;

    if (!container) return;

    let starsContainer = container.querySelector(".gemini-logger-stars");
    if (!starsContainer) {
      starsContainer = injectStarUI(container, last);
    }

    if (starsContainer) {
      starsContainer.dataset.logId = logEntry.id;
    }
  }

  function injectStarUI(container, responseEl) {
    const starsContainer = document.createElement("div");
    starsContainer.className = "gemini-logger-stars";

    let currentRating = 0;

    for (let i = 1; i <= 5; i++) {
      const star = document.createElement("span");
      star.className = "gemini-logger-star";
      star.textContent = "\u2605";
      star.dataset.value = i;

      star.addEventListener("click", () => {
        currentRating = i;
        updateStars(starsContainer, i);

        const logId = starsContainer.dataset.logId;
        if (logId) {
          chrome.runtime.sendMessage({
            type: "UPDATE_RATING",
            id: logId,
            rating: i,
          });
        } else {
          // Fallback: save a standalone rating entry
          const allResponses = document.querySelectorAll(
            '[data-message-author-role="1"], model-response, .model-response-text'
          );
          let idx = -1;
          allResponses.forEach((r, n) => {
            if (r === responseEl || r.contains(responseEl)) idx = n;
          });

          const userMessages = document.querySelectorAll(
            '[data-message-author-role="0"], model-prompt, user-message'
          );
          const questionEl = userMessages[idx];

          const logEntry = {
            id: `rating_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            entry_number: ++entryCounter,
            question_timestamp: new Date().toISOString(),
            answer_timestamp: new Date().toISOString(),
            question_text: questionEl?.textContent?.trim() || "",
            question_tokens: null,
            answer_text: responseEl.textContent?.trim() || "",
            answer_tokens: null,
            rating: i,
          };

          chrome.runtime.sendMessage({ type: "SAVE_LOG", log: logEntry });
          starsContainer.dataset.logId = logEntry.id;
        }
      });

      star.addEventListener("mouseenter", () =>
        highlightStars(starsContainer, i)
      );
      star.addEventListener("mouseleave", () =>
        highlightStars(starsContainer, currentRating)
      );

      starsContainer.appendChild(star);
    }

    const anchor = container.querySelector(".markdown, .response-content") ||
      responseEl;

    if (anchor?.parentNode) {
      anchor.parentNode.insertBefore(starsContainer, anchor.nextSibling);
    } else {
      container.appendChild(starsContainer);
    }

    return starsContainer;
  }

  function updateStars(container, rating) {
    container.querySelectorAll(".gemini-logger-star").forEach((star) => {
      star.classList.toggle("active", parseInt(star.dataset.value) <= rating);
    });
  }

  function highlightStars(container, rating) {
    container.querySelectorAll(".gemini-logger-star").forEach((star) => {
      star.classList.toggle("hover", parseInt(star.dataset.value) <= rating);
    });
  }

  // Scan existing responses on load
  document.querySelectorAll(
    '[data-message-author-role="1"], model-response, .model-response-text'
  ).forEach(tryAttachStars);
})();
