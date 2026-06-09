/*
 scripts/keep_supabase_awake.js

 Usage examples:
  node scripts/keep_supabase_awake.js https://mi-dominio.com --once
  KEEP_ALIVE_URLS="https://a.example,https://b.example" KEEP_ALIVE_INTERVAL_MINUTES=10 node scripts/keep_supabase_awake.js

 This script performs HTTP(S) GET requests to given URLs to keep a service
 from idling. It uses only Node core modules (no extra deps).
*/

const http = require('http');
const https = require('https');
const { URL } = require('url');

function httpGet(u, timeout = 150000) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(u); } catch (e) { return reject(new Error('Invalid URL: ' + u)); }
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.get(url, { timeout }, (res) => {
      const { statusCode } = res;
      // consume data and finish
      res.on('data', () => {});
      res.on('end', () => resolve({ url: u, statusCode }));
    });
    req.on('error', (err) => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { urls: [], once: false, interval: null, jitter: null };
  for (const a of args) {
    if (a === '--once' || a === '-1') opts.once = true;
    else if (a.startsWith('--interval=')) opts.interval = parseInt(a.split('=')[1], 10);
    else if (a.startsWith('--jitter=')) opts.jitter = parseInt(a.split('=')[1], 10);
    else if (a.startsWith('--')) {
      // ignore unknown flags
    } else {
      opts.urls.push(a);
    }
  }
  if (opts.urls.length === 0 && process.env.KEEP_ALIVE_URLS) {
    opts.urls = process.env.KEEP_ALIVE_URLS.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (opts.urls.length === 0) {
    console.error('No URLs provided. Usage: node scripts/keep_supabase_awake.js <url1> [url2] --once');
    process.exit(2);
  }
  opts.interval = opts.interval || parseInt(process.env.KEEP_ALIVE_INTERVAL_MINUTES || '10', 10);
  opts.jitter = opts.jitter || parseInt(process.env.KEEP_ALIVE_JITTER_SECONDS || '60', 10);
  return opts;
}

async function pingAll(urls) {
  for (const u of urls) {
    const start = Date.now();
    try {
      const r = await httpGet(u);
      console.log(`${new Date().toISOString()} ${u} -> ${r.statusCode} (${Date.now() - start}ms)`);
    } catch (err) {
      console.error(`${new Date().toISOString()} ${u} -> ERROR: ${err.message}`);
    }
  }
}

(async () => {
  const opts = parseArgs();
  if (opts.once) {
    await pingAll(opts.urls);
    process.exit(0);
  }
  console.log(`${new Date().toISOString()} Starting keep-alive for ${opts.urls.length} URL(s): ${opts.urls.join(', ')}`);
  while (true) {
    await pingAll(opts.urls);
    const waitMs = opts.interval * 60 * 1000 + Math.floor(Math.random() * opts.jitter * 1000);
    console.log(`${new Date().toISOString()} Waiting ${Math.round(waitMs/1000)}s until next ping`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
})();
