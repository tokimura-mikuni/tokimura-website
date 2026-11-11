// Record a distinct GA4 event per room: eventName is available in GA4 reports
// without registering a custom dimension. Guidebook links are not room clicks.
(() => {
  "use strict";
  const validRooms = new Set(["A", "B", "C", "D", "E"]);
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
