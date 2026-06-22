(function () {
  const ODOMETER_API = "https://sidewalk-saints-odometer.stephenbwickham.workers.dev"; // no trailing slash
  const DIGITS = 6; // matches the "000000" plate

  function render(count) {
    const el = document.getElementById("odometerValue");
    if (!el) return;
    const safe = Math.max(0, Math.floor(Number(count) || 0));
    el.textContent = String(safe).padStart(DIGITS, "0");
  }
  async function refresh() {
    try {
      const res = await fetch(ODOMETER_API + "/count");
      if (!res.ok) throw new Error("GET /count -> " + res.status);
      const { count } = await res.json();
      render(count); return count;
    } catch (e) { console.warn("[odometer] load failed:", e); return null; }
  }
  async function recordDispense() {   // call ONCE after a PDF actually downloads
    try {
      const res = await fetch(ODOMETER_API + "/increment", { method: "POST" });
      if (!res.ok) throw new Error("POST /increment -> " + res.status);
      const { count } = await res.json();
      render(count); return count;
    } catch (e) { console.warn("[odometer] increment failed:", e); return null; }
  }
  document.addEventListener("DOMContentLoaded", refresh);
  window.Odometer = { refresh, recordDispense };
})();
