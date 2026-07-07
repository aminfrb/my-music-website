import type { Request, Response } from "express";

/**
 * A tiny, fully self-contained GraphQL console (no CDN / external assets) so the
 * API is explorable in the browser even when offline — a stand-in for Apollo
 * Sandbox, which loads its UI from a CDN. Served on GET /graphql.
 */
const HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Harmony · GraphQL Console</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
    background: #0e1116; color: #e6edf3; }
  header { padding: 12px 16px; background: linear-gradient(90deg,#1f6feb22,#a371f722);
    border-bottom: 1px solid #30363d; display:flex; align-items:center; gap:12px; }
  header h1 { font-size: 15px; margin: 0; font-weight: 600; }
  header .badge { font-size: 11px; color:#7d8590; }
  .bar { display:flex; gap:8px; padding:10px 16px; flex-wrap:wrap; align-items:center;
    border-bottom:1px solid #30363d; }
  .bar input, .bar select { background:#0d1117; color:#e6edf3; border:1px solid #30363d;
    border-radius:6px; padding:6px 8px; font:inherit; }
  #token { flex:1; min-width:240px; }
  button { background:#238636; color:#fff; border:0; border-radius:6px; padding:8px 16px;
    font:inherit; font-weight:600; cursor:pointer; }
  button:hover { background:#2ea043; }
  main { display:grid; grid-template-columns: 1fr 1fr; gap:1px; background:#30363d;
    height: calc(100vh - 116px); }
  @media (max-width: 800px){ main{ grid-template-columns:1fr; height:auto; } }
  .pane { display:flex; flex-direction:column; background:#0e1116; min-height:200px; }
  .pane label { padding:6px 12px; font-size:11px; color:#7d8590; text-transform:uppercase;
    letter-spacing:.04em; border-bottom:1px solid #21262d; }
  textarea, pre { flex:1; margin:0; border:0; padding:12px; background:#0e1116; color:#e6edf3;
    font:inherit; resize:none; outline:none; overflow:auto; white-space:pre; }
  #vars { flex:0 0 110px; border-top:1px solid #21262d; }
  pre { white-space:pre-wrap; word-break:break-word; }
  .err { color:#ff7b72; }
</style>
</head>
<body>
  <header>
    <h1>🎵 Harmony · GraphQL Console</h1>
    <span class="badge">offline · POST /graphql</span>
  </header>
  <div class="bar">
    <input id="token" placeholder="Authorization: Bearer &lt;accessToken&gt; (optional)" />
    <select id="locale" title="x-locale">
      <option value="">locale: default</option>
      <option value="en">en</option>
      <option value="fa">fa</option>
    </select>
    <button id="run">▶ Run (Ctrl/⌘+Enter)</button>
  </div>
  <main>
    <div class="pane">
      <label>Query / Mutation</label>
      <textarea id="query" spellcheck="false"># Try a query, then Run.
# Tip: log in first, paste the accessToken above as: Bearer XXX
query {
  health
  latestMusic(first: 3) {
    totalCount
    nodes { id title artistName genre { name } }
  }
}</textarea>
      <label>Variables (JSON)</label>
      <textarea id="vars" spellcheck="false">{}</textarea>
    </div>
    <div class="pane">
      <label>Response</label>
      <pre id="out">// Response appears here…</pre>
    </div>
  </main>
<script>
  const $ = (id) => document.getElementById(id);
  async function run() {
    const out = $("out");
    out.classList.remove("err");
    out.textContent = "Loading…";
    let variables = {};
    const rawVars = $("vars").value.trim();
    if (rawVars) {
      try { variables = JSON.parse(rawVars); }
      catch (e) { out.classList.add("err"); out.textContent = "Invalid variables JSON: " + e.message; return; }
    }
    const headers = { "content-type": "application/json" };
    const token = $("token").value.trim();
    if (token) headers["authorization"] = token.startsWith("Bearer ") ? token : "Bearer " + token;
    const locale = $("locale").value;
    if (locale) headers["x-locale"] = locale;
    try {
      const res = await fetch("/graphql", {
        method: "POST", headers,
        body: JSON.stringify({ query: $("query").value, variables }),
      });
      const json = await res.json();
      out.textContent = JSON.stringify(json, null, 2);
      if (json.errors) out.classList.add("err");
    } catch (e) {
      out.classList.add("err"); out.textContent = "Network error: " + e.message;
    }
  }
  $("run").addEventListener("click", run);
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); }
  });
</script>
</body>
</html>`;

export function graphqlConsole(_req: Request, res: Response): void {
  res.type("html").send(HTML);
}
