(() => {
  if (window.__unseenFacebookLoaded) return;
  window.__unseenFacebookLoaded = true;

  const STORY_MUTATION = "storiesUpdateSeenStateMutation";

  const readEnabled = () => {
    const value = localStorage.getItem("unseen_DISABLE_STORIES_SEEN");
    return value === null ? true : value === "true";
  };

  let blockStories = readEnabled();

  const isStoryRequest = (body) =>
    typeof body === "string" && body.includes(STORY_MUTATION);

  const fakeResponse = () =>
    new Response('{"data":{"direct_message_thread_update_seen_state":{}}}', {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const url = args[0];
    const options = args[1];
    const body = options?.body;

    if (
      blockStories &&
      typeof url === "string" &&
      url.includes("/api/graphql/") &&
      isStoryRequest(body)
    ) {
      return Promise.resolve(fakeResponse());
    }

    return originalFetch.apply(this, args);
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__unseenUrl = url;
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (
      blockStories &&
      typeof this.__unseenUrl === "string" &&
      this.__unseenUrl.includes("/api/graphql/") &&
      isStoryRequest(body)
    ) {
      const responseText =
        '{"data":{"direct_message_thread_update_seen_state":{}}}';

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

  window.addEventListener("storage", (event) => {
    if (event.key === "unseen_DISABLE_STORIES_SEEN") {
      blockStories = event.newValue === "true";
    }
  });

  console.debug("[Unseen] story protection active");
})();
