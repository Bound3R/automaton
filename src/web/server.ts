/**
 * Conway Automaton — Web UI Server
 *
 * Serves a futuristic Tron-style log viewer and streams logs via SSE.
 * Requires no external HTTP dependencies — uses Node's built-in http module.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { StructuredLogger } from "../observability/logger.js";
import type { LogEntry } from "../types.js";

const LOG_BUFFER_SIZE = 500;
const logBuffer: LogEntry[] = [];
const sseClients: Set<ServerResponse> = new Set();

function pushLog(entry: LogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();
  const data = `data: ${JSON.stringify(entry)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
}

function handleSSE(req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  // Send buffered logs on connect
  for (const entry of logBuffer) {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  }

  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
}

function handleUI(_req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(HTML);
}

export function startWebServer(port: number = 3000): void {
  StructuredLogger.setSink((entry) => {
    // Also write to stdout
    try {
      process.stdout.write(JSON.stringify(entry) + "\n");
    } catch {
      // ignore
    }
    pushLog(entry);
  });

  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/logs/stream") return handleSSE(req, res);
    return handleUI(req, res);
  });

  server.listen(port, "0.0.0.0", () => {
    process.stdout.write(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        module: "web",
        message: `Web UI running → http://0.0.0.0:${port}`,
      }) + "\n",
    );
  });
}

/* ─── Futuristic HTML UI ──────────────────────────────────────────────── */

const HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>AUTOMATON // CONWAY</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');

  :root {
    --cyan:    #00f5ff;
    --green:   #39ff14;
    --yellow:  #ffe600;
    --red:     #ff1744;
    --magenta: #e040fb;
    --dim:     #1a2a2a;
    --bg:      #020c0c;
    --grid:    #0a2525;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--cyan);
    font-family: 'Share Tech Mono', monospace;
    font-size: 13px;
    line-height: 1.5;
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Scanlines ── */
  body::after {
    content: '';
    position: fixed;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0,0,0,0.15) 2px,
      rgba(0,0,0,0.15) 4px
    );
    pointer-events: none;
    z-index: 100;
  }

  /* ── Neon grid background ── */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
      linear-gradient(var(--grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--grid) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
    z-index: 0;
  }

  /* ── Header ── */
  header {
    position: relative;
    z-index: 10;
    padding: 12px 24px;
    border-bottom: 1px solid var(--cyan);
    display: flex;
    align-items: center;
    gap: 20px;
    background: linear-gradient(180deg, rgba(0,245,255,0.06) 0%, transparent 100%);
    flex-shrink: 0;
  }

  .logo {
    font-family: 'Orbitron', sans-serif;
    font-weight: 900;
    font-size: 20px;
    letter-spacing: 4px;
    color: var(--cyan);
    text-shadow: 0 0 8px var(--cyan), 0 0 20px var(--cyan), 0 0 40px rgba(0,245,255,0.4);
    animation: flicker 8s infinite;
  }

  .logo span { color: #fff; text-shadow: 0 0 8px #fff; }

  .subtitle {
    font-size: 10px;
    letter-spacing: 3px;
    color: rgba(0,245,255,0.5);
    text-transform: uppercase;
  }

  .status-bar {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 11px;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 6px var(--green), 0 0 12px var(--green);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .dot.disconnected { background: var(--red); box-shadow: 0 0 6px var(--red); animation: none; }

  .counter {
    color: rgba(0,245,255,0.6);
    font-size: 11px;
  }

  /* ── Controls ── */
  .controls {
    position: relative;
    z-index: 10;
    padding: 6px 24px;
    border-bottom: 1px solid rgba(0,245,255,0.2);
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(0,0,0,0.4);
    flex-shrink: 0;
  }

  .level-filter {
    display: flex;
    gap: 6px;
  }

  .lvl-btn {
    background: transparent;
    border: 1px solid;
    padding: 2px 10px;
    font-family: 'Share Tech Mono', monospace;
    font-size: 11px;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all 0.15s;
    text-transform: uppercase;
  }

  .lvl-btn.all   { border-color: var(--cyan);    color: var(--cyan);    }
  .lvl-btn.debug { border-color: rgba(0,245,255,0.4); color: rgba(0,245,255,0.5); }
  .lvl-btn.info  { border-color: rgba(57,255,20,0.5); color: rgba(57,255,20,0.6); }
  .lvl-btn.warn  { border-color: rgba(255,230,0,0.5); color: rgba(255,230,0,0.6); }
  .lvl-btn.error { border-color: rgba(255,23,68,0.5); color: rgba(255,23,68,0.6); }
  .lvl-btn.fatal { border-color: rgba(224,64,251,0.5); color: rgba(224,64,251,0.6); }

  .lvl-btn.active.all   { background: rgba(0,245,255,0.12);    box-shadow: 0 0 8px rgba(0,245,255,0.3); }
  .lvl-btn.active.debug { background: rgba(0,245,255,0.08);    box-shadow: 0 0 8px rgba(0,245,255,0.2); color: var(--cyan); border-color: var(--cyan); }
  .lvl-btn.active.info  { background: rgba(57,255,20,0.08);    box-shadow: 0 0 8px rgba(57,255,20,0.3); color: var(--green); border-color: var(--green); }
  .lvl-btn.active.warn  { background: rgba(255,230,0,0.08);    box-shadow: 0 0 8px rgba(255,230,0,0.3); color: var(--yellow); border-color: var(--yellow); }
  .lvl-btn.active.error { background: rgba(255,23,68,0.08);    box-shadow: 0 0 8px rgba(255,23,68,0.3); color: var(--red); border-color: var(--red); }
  .lvl-btn.active.fatal { background: rgba(224,64,251,0.08);   box-shadow: 0 0 8px rgba(224,64,251,0.3); color: var(--magenta); border-color: var(--magenta); }

  .clear-btn {
    margin-left: auto;
    background: transparent;
    border: 1px solid rgba(255,23,68,0.4);
    color: rgba(255,23,68,0.6);
    padding: 2px 12px;
    font-family: 'Share Tech Mono', monospace;
    font-size: 11px;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .clear-btn:hover { background: rgba(255,23,68,0.1); color: var(--red); border-color: var(--red); }

  .autoscroll-btn {
    background: transparent;
    border: 1px solid rgba(0,245,255,0.3);
    color: rgba(0,245,255,0.5);
    padding: 2px 10px;
    font-family: 'Share Tech Mono', monospace;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .autoscroll-btn.on { color: var(--cyan); border-color: var(--cyan); background: rgba(0,245,255,0.08); box-shadow: 0 0 6px rgba(0,245,255,0.2); }

  /* ── Log area ── */
  #log-container {
    position: relative;
    z-index: 10;
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
    scrollbar-width: thin;
    scrollbar-color: rgba(0,245,255,0.3) transparent;
  }

  #log-container::-webkit-scrollbar { width: 6px; }
  #log-container::-webkit-scrollbar-track { background: transparent; }
  #log-container::-webkit-scrollbar-thumb { background: rgba(0,245,255,0.3); border-radius: 3px; }

  .log-entry {
    display: grid;
    grid-template-columns: 180px 56px 140px 1fr;
    gap: 0 12px;
    padding: 2px 24px;
    border-bottom: 1px solid transparent;
    transition: background 0.1s;
    font-size: 12px;
  }

  .log-entry:hover { background: rgba(0,245,255,0.04); border-bottom-color: rgba(0,245,255,0.08); }

  .log-entry.new { animation: slideIn 0.2s ease-out; }

  .ts  { color: rgba(0,245,255,0.35); white-space: nowrap; }
  .mod { color: rgba(0,245,255,0.5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .msg { word-break: break-word; }
  .msg pre { font-family: inherit; white-space: pre-wrap; }

  .lvl {
    font-weight: bold;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-size: 10px;
    padding-top: 2px;
  }

  .lvl-debug { color: rgba(0,245,255,0.6); }
  .lvl-info  { color: var(--green); text-shadow: 0 0 4px rgba(57,255,20,0.5); }
  .lvl-warn  { color: var(--yellow); text-shadow: 0 0 4px rgba(255,230,0,0.5); }
  .lvl-error { color: var(--red);    text-shadow: 0 0 6px rgba(255,23,68,0.6); }
  .lvl-fatal { color: var(--magenta); text-shadow: 0 0 8px rgba(224,64,251,0.7); animation: fatalPulse 0.5s ease-in-out; }

  /* ── Boot overlay ── */
  #boot-overlay {
    position: fixed;
    inset: 0;
    background: var(--bg);
    z-index: 200;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    transition: opacity 0.6s;
  }

  #boot-overlay.hidden { opacity: 0; pointer-events: none; }

  .boot-logo {
    font-family: 'Orbitron', sans-serif;
    font-size: 36px;
    font-weight: 900;
    letter-spacing: 10px;
    color: var(--cyan);
    text-shadow: 0 0 20px var(--cyan), 0 0 60px rgba(0,245,255,0.4);
    animation: flicker 3s infinite;
  }

  .boot-sub {
    font-size: 12px;
    letter-spacing: 6px;
    color: rgba(0,245,255,0.5);
  }

  .boot-bar-wrap {
    width: 320px;
    height: 2px;
    background: rgba(0,245,255,0.15);
    margin-top: 24px;
  }

  .boot-bar {
    height: 100%;
    background: var(--cyan);
    box-shadow: 0 0 8px var(--cyan), 0 0 20px var(--cyan);
    width: 0;
    animation: bootLoad 1.4s ease-out forwards;
  }

  .boot-msg {
    font-size: 11px;
    color: rgba(0,245,255,0.4);
    letter-spacing: 2px;
    animation: blink 0.8s step-end infinite;
  }

  /* ── Footer ── */
  footer {
    position: relative;
    z-index: 10;
    padding: 4px 24px;
    border-top: 1px solid rgba(0,245,255,0.15);
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 10px;
    color: rgba(0,245,255,0.3);
    flex-shrink: 0;
    background: rgba(0,0,0,0.4);
  }

  footer span { letter-spacing: 1px; }

  /* ── Animations ── */
  @keyframes pulse {
    0%,100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.5; transform: scale(0.85); }
  }

  @keyframes flicker {
    0%,95%,100% { opacity: 1; }
    96%          { opacity: 0.6; }
    98%          { opacity: 0.8; }
  }

  @keyframes bootLoad {
    0%   { width: 0; }
    60%  { width: 70%; }
    80%  { width: 85%; }
    100% { width: 100%; }
  }

  @keyframes blink {
    0%,100% { opacity: 1; }
    50%      { opacity: 0; }
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-8px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  @keyframes fatalPulse {
    0%,100% { background: transparent; }
    50%     { background: rgba(224,64,251,0.08); }
  }

  @media (max-width: 768px) {
    .log-entry { grid-template-columns: 1fr; }
    .ts, .mod  { font-size: 10px; }
  }
</style>
</head>
<body>

<!-- Boot overlay -->
<div id="boot-overlay">
  <div class="boot-logo">AUTOMATON</div>
  <div class="boot-sub">CONWAY SOVEREIGN RUNTIME</div>
  <div class="boot-bar-wrap"><div class="boot-bar"></div></div>
  <div class="boot-msg">INITIALIZING UPLINK...</div>
</div>

<!-- Header -->
<header>
  <div>
    <div class="logo">AUTO<span>MATON</span></div>
    <div class="subtitle">Conway Sovereign Runtime // Log Stream</div>
  </div>
  <div class="status-bar">
    <div class="status-indicator">
      <div class="dot" id="conn-dot"></div>
      <span id="conn-label">CONNECTING</span>
    </div>
    <span class="counter" id="entry-count">0 entries</span>
  </div>
</header>

<!-- Controls -->
<div class="controls">
  <div class="level-filter" id="level-filter">
    <button class="lvl-btn all active" data-level="all">ALL</button>
    <button class="lvl-btn debug" data-level="debug">DEBUG</button>
    <button class="lvl-btn info"  data-level="info">INFO</button>
    <button class="lvl-btn warn"  data-level="warn">WARN</button>
    <button class="lvl-btn error" data-level="error">ERROR</button>
    <button class="lvl-btn fatal" data-level="fatal">FATAL</button>
  </div>
  <button class="autoscroll-btn on" id="autoscroll-btn">⬇ AUTO-SCROLL</button>
  <button class="clear-btn" id="clear-btn">✕ CLEAR</button>
</div>

<!-- Log area -->
<div id="log-container"></div>

<!-- Footer -->
<footer>
  <span>CONWAY AUTOMATON v0.2.0</span>
  <span id="footer-time"></span>
  <span style="margin-left:auto">SSE /logs/stream</span>
</footer>

<script>
(function () {
  const container = document.getElementById('log-container');
  const connDot    = document.getElementById('conn-dot');
  const connLabel  = document.getElementById('conn-label');
  const entryCount = document.getElementById('entry-count');
  const autoscrollBtn = document.getElementById('autoscroll-btn');
  const clearBtn   = document.getElementById('clear-btn');
  const bootOverlay = document.getElementById('boot-overlay');
  const footerTime = document.getElementById('footer-time');

  let autoScroll  = true;
  let activeLevel = 'all';
  let allEntries  = [];
  let total       = 0;

  // ── Boot sequence ──────────────────────────────────────────────
  setTimeout(() => {
    bootOverlay.classList.add('hidden');
    setTimeout(() => bootOverlay.remove(), 700);
  }, 1600);

  // ── Clock ──────────────────────────────────────────────────────
  function tick() {
    footerTime.textContent = new Date().toISOString().replace('T', ' ').replace('Z', ' UTC');
  }
  tick();
  setInterval(tick, 1000);

  // ── Level filter ───────────────────────────────────────────────
  document.getElementById('level-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('.lvl-btn');
    if (!btn) return;
    document.querySelectorAll('.lvl-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeLevel = btn.dataset.level;
    renderAll();
  });

  // ── Auto-scroll toggle ─────────────────────────────────────────
  autoscrollBtn.addEventListener('click', () => {
    autoScroll = !autoScroll;
    autoscrollBtn.classList.toggle('on', autoScroll);
    autoscrollBtn.textContent = autoScroll ? '⬇ AUTO-SCROLL' : '⏸ PAUSED';
  });

  container.addEventListener('scroll', () => {
    const atBottom = container.scrollHeight - container.clientHeight - container.scrollTop < 40;
    if (!atBottom && autoScroll) {
      autoScroll = false;
      autoscrollBtn.classList.remove('on');
      autoscrollBtn.textContent = '⏸ PAUSED';
    }
  });

  // ── Clear ──────────────────────────────────────────────────────
  clearBtn.addEventListener('click', () => {
    allEntries = [];
    total = 0;
    container.innerHTML = '';
    entryCount.textContent = '0 entries';
  });

  // ── Render ─────────────────────────────────────────────────────
  const LEVEL_CLASS = { debug:'lvl-debug', info:'lvl-info', warn:'lvl-warn', error:'lvl-error', fatal:'lvl-fatal' };

  function formatTS(iso) {
    try {
      const d = new Date(iso);
      const hh = String(d.getHours()).padStart(2,'0');
      const mm = String(d.getMinutes()).padStart(2,'0');
      const ss = String(d.getSeconds()).padStart(2,'0');
      const ms = String(d.getMilliseconds()).padStart(3,'0');
      return \`\${d.toISOString().slice(0,10)} \${hh}:\${mm}:\${ss}.\${ms}\`;
    } catch { return iso; }
  }

  function buildRow(entry, isNew = false) {
    const row = document.createElement('div');
    row.className = 'log-entry' + (isNew ? ' new' : '');
    row.dataset.level = entry.level;

    let msgHTML = entry.message || '';
    if (entry.error) {
      msgHTML += '\\n<span style="color:rgba(255,23,68,0.7);font-size:11px">' +
        (entry.error.message || '') + (entry.error.stack ? '\\n' + entry.error.stack : '') + '</span>';
    }
    if (entry.context && Object.keys(entry.context).length) {
      msgHTML += '\\n<span style="color:rgba(0,245,255,0.35);font-size:11px">' +
        JSON.stringify(entry.context) + '</span>';
    }

    row.innerHTML =
      '<span class="ts">'  + formatTS(entry.timestamp) + '</span>' +
      '<span class="lvl ' + (LEVEL_CLASS[entry.level] || '') + '">' + (entry.level || '').toUpperCase() + '</span>' +
      '<span class="mod">' + (entry.module || '') + '</span>' +
      '<span class="msg"><pre>' + msgHTML + '</pre></span>';

    return row;
  }

  function renderAll() {
    container.innerHTML = '';
    const filtered = activeLevel === 'all'
      ? allEntries
      : allEntries.filter(e => e.level === activeLevel);
    const frag = document.createDocumentFragment();
    filtered.forEach(e => frag.appendChild(buildRow(e, false)));
    container.appendChild(frag);
    if (autoScroll) container.scrollTop = container.scrollHeight;
  }

  function addEntry(entry, isNew = true) {
    allEntries.push(entry);
    total++;
    entryCount.textContent = total + ' entr' + (total === 1 ? 'y' : 'ies');

    if (activeLevel === 'all' || entry.level === activeLevel) {
      const row = buildRow(entry, isNew);
      container.appendChild(row);
      if (autoScroll) container.scrollTop = container.scrollHeight;
    }
  }

  // ── SSE connection ─────────────────────────────────────────────
  let retryDelay = 1000;

  function connect() {
    connDot.className = 'dot disconnected';
    connLabel.textContent = 'CONNECTING';

    const es = new EventSource('/logs/stream');

    es.onopen = () => {
      connDot.className = 'dot';
      connLabel.textContent = 'LIVE';
      retryDelay = 1000;
    };

    es.onmessage = (ev) => {
      try {
        const entry = JSON.parse(ev.data);
        addEntry(entry);
      } catch { /* ignore malformed */ }
    };

    es.onerror = () => {
      connDot.className = 'dot disconnected';
      connLabel.textContent = 'RECONNECTING';
      es.close();
      setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30000);
    };
  }

  connect();
})();
</script>
</body>
</html>`;
