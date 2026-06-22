const INCREMENT_PER_DISPENSE = 1;   // one tick per dispense (per PDF download), not per label
const ALLOWED_ORIGIN = "*";          // tighten to the site's exact origin in production

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    const id = env.ODOMETER.idFromName("global");   // single global instance
    const stub = env.ODOMETER.get(id);
    return stub.fetch(request);
  },
};

export class OdometerCounter {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/count") {
      const count = (await this.ctx.storage.get("count")) ?? 0;
      return json({ count });
    }
    if (request.method === "POST" && pathname === "/increment") {
      const current = (await this.ctx.storage.get("count")) ?? 0;
      const count = current + INCREMENT_PER_DISPENSE;  // atomic: single-threaded DO serializes requests
      await this.ctx.storage.put("count", count);
      return json({ count });
    }
    return json({ error: "Not found" }, 404);
  }
}
