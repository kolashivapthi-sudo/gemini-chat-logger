(() => {
  "use strict";

  const GEMINI_API_PATTERN = /generativelanguage\.googleapis\.com.*\/(streamGenerateContent|generateContent)/;

  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const [resource, config] = args;
    const url = typeof resource === "string" ? resource : resource?.url;

    if (!url || !GEMINI_API_PATTERN.test(url)) {
      return originalFetch.apply(this, args);
    }

    let requestBody = null;
    if (config?.body) {
      try {
        requestBody = typeof config.body === "string"
          ? JSON.parse(config.body)
          : null;
      } catch (e) {}
    }

    const questionText = extractQuestionText(requestBody);
    const startTime = Date.now();

    const response = await originalFetch.apply(this, args);

    const cloned = response.clone();
    const reader = cloned.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let usageMetadata = null;

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;

          const parsed = parseSSEChunks(chunk);
          if (parsed.text) {
            // streaming text, accumulate
          }
          if (parsed.usageMetadata) {
            usageMetadata = parsed.usageMetadata;
          }
        }

        const finalParsed = parseSSEChunks(fullText);
        const answerText = finalParsed.text || fullText;

        const logEntry = {
          id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          entry_number: 0,
          question_timestamp: new Date(startTime).toISOString(),
          answer_timestamp: new Date().toISOString(),
          question_text: questionText,
          question_tokens: requestBody?.usageMetadata?.promptTokenCount ||
            requestBody?.contents?.[0]?.usageMetadata?.promptTokenCount ||
            null,
          answer_text: answerText,
          answer_tokens: usageMetadata?.candidatesTokenCount ||
            usageMetadata?.totalTokenCount
              ? (usageMetadata.totalTokenCount - (usageMetadata.promptTokenCount || 0))
              : null,
          rating: null,
        };

        window.dispatchEvent(
          new CustomEvent("gemini-logger-entry", { detail: logEntry })
        );
      } catch (e) {
        // streaming read error — non-critical
      }
    })();

    return response;
  };

  function extractQuestionText(body) {
    if (!body?.contents) return "";
    const contents = body.contents;
    for (let i = contents.length - 1; i >= 0; i--) {
      const part = contents[i];
      if (part.role === "user" && part.parts) {
        return part.parts
          .map((p) => p.text || "")
          .join("")
          .trim();
      }
    }
    return "";
  }

  function parseSSEChunks(raw) {
    let text = "";
    let usageMetadata = null;

    const lines = raw.split("\n");
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;

      try {
        const obj = JSON.parse(jsonStr);
        if (obj.candidates?.[0]?.content?.parts) {
          for (const part of obj.candidates[0].content.parts) {
            if (part.text) text += part.text;
          }
        }
        if (obj.usageMetadata) {
          usageMetadata = obj.usageMetadata;
        }
      } catch (e) {}
    }

    return { text, usageMetadata };
  }
})();
