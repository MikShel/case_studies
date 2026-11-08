// Full-screen title cards for the demo video (1440×900).
const shell = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html { height: 100%; background: #0f172a; }
  body { margin: 0; height: 100%; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: radial-gradient(circle at 20% 20%, #312e81, #0f172a 60%); color: #e2e8f0; display: flex; align-items: center; justify-content: center; }
  .wrap { width: 1080px; }
  .kicker { color: #a5b4fc; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; font-size: 18px; }
  h1 { font-size: 72px; margin: 14px 0 18px; color: #fff; letter-spacing: -.02em; }
  h2 { font-size: 44px; margin: 10px 0 26px; color: #fff; }
  p { font-size: 26px; line-height: 1.45; color: #cbd5e1; margin: 0 0 16px; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; margin-top: 26px; }
  .box { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: 18px; padding: 24px 26px; }
  .box b { display: block; color: #fff; font-size: 26px; margin-bottom: 8px; }
  .box span { font-size: 21px; color: #cbd5e1; line-height: 1.4; }
  .num { color: #fbbf24; font-weight: 800; }
  .muted { color: #94a3b8; font-size: 20px; }
</style></head><body><div class="wrap">${body}</div></body></html>`;

export const CARDS = {
  title: shell(`
    <div class="kicker">Synthesia · real-time avatars · new session type</div>
    <h1>Troubleshooting Sessions</h1>
    <p>An avatar that helps employees through an internal software rollout, and hands off cleanly when the fix needs an admin who isn't there.</p>
    <p class="muted">Prototype · Expensio rollout at Northwind Labs (fictional) · simulated avatar</p>`),
  problem: shell(`
    <div class="kicker">The problem</div>
    <h2>Week 1 of a rollout: people get stuck, the admin is away</h2>
    <div class="two">
      <div class="box"><b><span class="num">1</span> · Creation</b><span>The creator defines the boundary: what the avatar may tell people to do themselves, and what needs an admin.</span></div>
      <div class="box"><b><span class="num">2</span> · Consumption</b><span>The admin isn't available, so the session must end in a clean async handoff, not "please contact your admin".</span></div>
    </div>`),
  closing: shell(`
    <div class="kicker">How we'd know it works</div>
    <h2>Metrics &amp; learning</h2>
    <div class="two">
      <div class="box"><b>North star</b><span>% of issues resolved without a ticket</span></div>
      <div class="box"><b>Handoff quality</b><span>% of requests approved without back-and-forth</span></div>
      <div class="box"><b>Guardrail</b><span>Wrong-instruction rate ≈ 0 (evals on every publish)</span></div>
      <div class="box"><b>Learning plan</b><span>3 design partners, mid-rollout, for 6 weeks</span></div>
    </div>
    <p class="muted" style="margin-top:28px">Thank you.</p>`),
};
