(() => {
  if (window.__unseenFbIgLoaded) return;
  window.__unseenFbIgLoaded = true;

  // Mutations that mark stories/messages as seen
  const BLOCKED_MUTATIONS = [
    "storiesUpdateSeenStateMutation", // Facebook / Messenger
    "PolarisStoriesV3SeenMutation"    // Instagram
  ];

  const readEnabled = () => {
    const value = localStorage.getItem("unseen_DISABLE_STORIES_SEEN");
    return value === null ? true : value === "true";
  };

  let blockStories = readEnabled();

  const getBodyString = (body) => {
    if (!body) return "";
    if (typeof body === "string") return body;
    if (body instanceof URLSearchParams) return body.toString();
    return "";
  };

  const getHeaderName = (headers, name) => {
    if (!headers) return "";
    if (typeof headers.get === "function") {
      return headers.get(name) || "";
    }
    if (typeof headers === "object") {
      const lowerName = name.toLowerCase();
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lowerName) return headers[key];
      }
    }
    return "";
  };

  const isStoryRequest = (url, body, headers) => {
    if (typeof url !== "string" || !url.includes("/api/graphql")) return false;

    // 1. Check the body payload
    const bodyStr = getBodyString(body);
    for (const mutation of BLOCKED_MUTATIONS) {
      if (bodyStr.includes(mutation)) return true;
    }

    // 2. Fallback: Check headers (Instagram often uses x-fb-friendly-name)
    const friendlyName = getHeaderName(headers, "x-fb-friendly-name");
    if (friendlyName && BLOCKED_MUTATIONS.includes(friendlyName)) return true;

    return false;
  };

  const getFakeResponseText = () => 
    '{"data":{"direct_message_thread_update_seen_state":{},"xdt_mark_story_reel_seen":{"__typename":"XDTMarkSeenResponse"}}}';

  const fakeResponse = () =>
    new Response(getFakeResponseText(), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  // --- Intercept Fetch API ---
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    let input = args[0];
    let init = args[1] || {};
    
    let url = "";
    let body = init.body;
    let headers = init.headers;

    // Handle both string URLs and Request objects
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof Request) {
      url = input.url;
      if (!body) body = init.body; 
      if (!headers) headers = input.headers;
    }

    if (blockStories && isStoryRequest(url, body, headers)) {
      return Promise.resolve(fakeResponse());
    }
    return originalFetch.apply(this, args);
  };

  // --- Intercept XMLHttpRequest ---
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__unseenUrl = url;
    this.__unseenHeaders = {};
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (this.__unseenHeaders) {
      this.__unseenHeaders[name.toLowerCase()] = value;
    }
    return originalSetRequestHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (blockStories && isStoryRequest(this.__unseenUrl, body, this.__unseenHeaders)) {
      const responseText = getFakeResponseText();
      Object.defineProperties(this, {
        responseText: { configurable: true, value: responseText },
        response: { configurable: true, value: responseText },
        status: { configurable: true, value: 200 },
        readyState: { configurable: true, value: 4 }
      });
      queueMicrotask(() => {
        this.dispatchEvent(new Event("readystatechange"));
        this.dispatchEvent(new Event("load"));
        this.dispatchEvent(new Event("loadend"));
        this.onload?.();
      });
      return;
    }
    return originalSend.call(this, body);
  };

  // --- Sync state from Popup ---
  window.addEventListener("storage", (event) => {
    if (event.key === "unseen_DISABLE_STORIES_SEEN") {
      blockStories = event.newValue === "true";
    }
  });

  console.debug("[Unseen] Story protection active for Facebook & Instagram");
})();