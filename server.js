const http = require("http");
const fs = require("fs");

const NODE_NAME = process.env.NODE_NAME || "unknown";
const PORT = parseInt(process.env.PORT || "3000");
const PROBE_INTERVAL = parseInt(process.env.PROBE_INTERVAL || "300000");
const PAYLOAD_PATH = process.env.PAYLOAD_PATH || "/data/payload.json";
const LOG_PATH = process.env.LOG_PATH || "/logs/probes.log";

const targets = (process.env.TARGETS || "")
  .split(",")
  .filter(Boolean)
  .map((entry) => {
    const [name, hostport] = entry.split("=");
    const [hostname, port] = hostport.split(":");
    return { name, hostname, port: parseInt(port || "3000") };
  });

// Load big payload from file
let bigPayload;
try {
  bigPayload = fs.readFileSync(PAYLOAD_PATH, "utf-8");
  console.log(`[${NODE_NAME}] loaded big payload from ${PAYLOAD_PATH} (${Buffer.byteLength(bigPayload)} bytes)`);
} catch (err) {
  bigPayload = JSON.stringify({ source: NODE_NAME, data: "x".repeat(10000) });
  console.log(`[${NODE_NAME}] payload file not found, using default`);
}

// Small hello-world payload
const smallPayload = JSON.stringify({ source: NODE_NAME, message: "hello world" });
console.log(`[${NODE_NAME}] small payload: ${Buffer.byteLength(smallPayload)} bytes`);

function log(line) {
  const entry = `[${new Date().toISOString()}] ${line}`;
  console.log(entry);
  fs.appendFileSync(LOG_PATH, entry + "\n");
}

// --- Server ---
const server = http.createServer((req, res) => {
  if (req.url === "/return" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ node: NODE_NAME, received_at: Date.now() }));
    });
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

server.listen(PORT, () => {
  console.log(`[${NODE_NAME}] listening on :${PORT}`);
  console.log(`[${NODE_NAME}] probing ${targets.length} target(s) every ${PROBE_INTERVAL}ms`);
  if (targets.length > 0) startProbing();
});

// --- Client ---
function sendProbe(target, payload, label) {
  const start = process.hrtime.bigint();

  const req = http.request(
    {
      hostname: target.hostname,
      port: target.port,
      path: "/return",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
      timeout: 30000,
    },
    (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        log(`${NODE_NAME} -> ${target.name} [${label}] | ${ms.toFixed(2)} ms | status=${res.statusCode}`);
      });
    }
  );

  req.on("error", (err) => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    log(`${NODE_NAME} -> ${target.name} [${label}] | FAIL ${ms.toFixed(2)} ms | ${err.message}`);
  });

  req.on("timeout", () => {
    req.destroy(new Error("timeout"));
  });

  req.end(payload);
}

function probe(target) {
  sendProbe(target, bigPayload, "big");
  sendProbe(target, smallPayload, "small");
}

function startProbing() {
  for (const target of targets) probe(target);
  setInterval(() => {
    for (const target of targets) probe(target);
  }, PROBE_INTERVAL);
}
