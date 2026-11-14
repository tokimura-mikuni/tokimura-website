// Record a distinct GA4 event per room: eventName is available in GA4 reports
// without registering a custom dimension. Guidebook links are not room clicks.
(() => {
  "use strict";
  const validRooms = new Set(["A", "B", "C", "D", "E"]);

  // Count a page only after 3 cumulative seconds in the visible foreground.
  // Hidden tab time is excluded and each page fires at most one GA4 event.
  const MIN_VISIBLE_MS = 3000;
  let visibleStartedAt = null;
  let visibleElapsedMs = 0;
  let qualificationTimer = null;
  let qualifiedViewSent = false;
  const clock = () => window.performance?.now?.() ?? Date.now();
  const isVisible = () => document.visibilityState !== "hidden";

  function stopVisibleClock() {
    if (qualificationTimer !== null) {
      window.clearTimeout?.(qualificationTimer);
      qualificationTimer = null;
    }
    if (visibleStartedAt !== null) {
      visibleElapsedMs += Math.max(0, clock() - visibleStartedAt);
      visibleStartedAt = null;
    }
  }

  function checkVisibleTime() {
    stopVisibleClock();
    if (!isVisible() || qualifiedViewSent) return;
    if (visibleElapsedMs >= MIN_VISIBLE_MS) {
      qualifiedViewSent = true;
      window.gtag?.("event", "qualified_page_view");
    } else startVisibleClock();
  }

  function startVisibleClock() {
    if (!isVisible() || qualifiedViewSent || !window.setTimeout) return;
    if (visibleStartedAt !== null) return;
    visibleStartedAt = clock();
    qualificationTimer = window.setTimeout(checkVisibleTime,
      Math.max(1, MIN_VISIBLE_MS - visibleElapsedMs));
  }

  document.addEventListener("visibilitychange", () => {
    if (isVisible()) startVisibleClock();
    else stopVisibleClock();
  });
  window.addEventListener?.("pagehide", stopVisibleClock);
  window.addEventListener?.("pageshow", startVisibleClock);
  startVisibleClock();
  document.addEventListener("click", (event) => {
    const link = event.target?.closest?.("a[data-airbnb-room]");
    const room = link?.dataset?.airbnbRoom;
    if (!validRooms.has(room) || typeof window.gtag !== "function") return;
    try {
      const url = new URL(link.href, window.location.href);
      if (url.protocol !== "https:" || url.hostname !== "www.airbnb.com" ||
          url.pathname !== "/h/wabisabi-house-mikuni-room" + room.toLowerCase()) return;
    } catch { return; }
    window.gtag("event", "airbnb_link_click_" + room.toLowerCase(), {
      transport_type: "beacon",
    });
  }, true);
})();
