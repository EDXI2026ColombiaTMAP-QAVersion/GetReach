const form = document.getElementById("uploadForm");
const linksInput = document.getElementById("links");
const statusEl = document.getElementById("status");
const warningEl = document.getElementById("warning");
const submitBtn = document.getElementById("submitBtn");
const copyBtn = document.getElementById("copyBtn");
const copyMonthlyBtn = document.getElementById("copyMonthlyBtn");
const resultsEl = document.getElementById("results");

function normalizeUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function isLikelyUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return false;
  try {
    const url = new URL(normalizeUrl(raw));
    return Boolean(url.hostname && url.hostname.includes("."));
  } catch {
    return false;
  }
}

function extractDomain(input) {
  try {
    const url = new URL(normalizeUrl(input));
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

//Get numbers
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseMetricNearLabel(text, label) {
  const source = String(text || "");
  const pattern = new RegExp(
    `${escapeRegex(label)}[\\s\\S]{0,120}?([0-9][0-9.,]*\\s*[KM]?)`,
    "i"
  );
  const match = source.match(pattern);
  if (!match?.[1]) return "N/A";
  return match[1].replace(/\s+/g, "");
}

function parseHypestatMonthlyVisits(text) {
  return parseMetricNearLabel(text, "Monthly Visits");
}

function parseSimilarWebMonthlyVisits(text) {
  return parseMetricNearLabel(text, "Monthly Visits (SimilarWeb)");
}

//12.5K -> 12500
function parseNumericValue(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "N/A") return null;
  const compact = raw.replace(/,/g, "");
  const match = compact.match(/^([0-9]*\.?[0-9]+)([KM])?$/i);
  if (!match) return null;
  const num = Number(match[1]);
  if (!Number.isFinite(num)) return null;
  const suffix = (match[2] || "").toUpperCase();
  if (suffix === "K") return num * 1000;
  if (suffix === "M") return num * 1000000;
  return num;
}

//1234.56 -> 1235
function formatMonthlyValue(value) {
  if (!Number.isFinite(value)) return "N/A";
  return Math.round(value).toString();
}

function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function fetchMetricsForDomain(domain) {
  if (!domain) {
    return {
      hypestatMonthlyVisits: "N/A",
      similarwebMonthlyVisits: "N/A"
    };
  }
  const directUrl = `https://hypestat.com/info/${encodeURIComponent(domain)}`;
  const proxyUrls = [
    directUrl,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`,
    `https://r.jina.ai/http://hypestat.com/info/${encodeURIComponent(domain)}`
  ];

  for (const url of proxyUrls) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          headers: { accept: "text/html,text/plain,*/*" }
        },
        8000
      );
      if (!response.ok) continue;
      const body = await response.text();
      const parsed = {
        hypestatMonthlyVisits: parseHypestatMonthlyVisits(body),
        similarwebMonthlyVisits: parseSimilarWebMonthlyVisits(body)
      };
      if (parsed.hypestatMonthlyVisits !== "N/A" || parsed.similarwebMonthlyVisits !== "N/A") {
        return parsed;
      }
    } catch (_) {
      // Try the next source.
    }
  }

  return {
    hypestatMonthlyVisits: "N/A",
    similarwebMonthlyVisits: "N/A"
  };
}

function makeTable(rows) {
  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr><th>Link</th><th>Reach</th></tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = row.map((cell) => `<td>${String(cell || "").replace(/</g, "&lt;")}</td>`).join("");
    tbody.appendChild(tr);
  });
  return table;
}

function makeCopyText(rows) {
  return rows.map((row) => row.join("\t")).join("\n");
}

function makeMonthlyOnlyText(rows) {
  return rows.map((row) => row[1]).join("\n");
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;

  async function run() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const raw = String(linksInput.value || "").trim();
  if (!raw) return;

  submitBtn.disabled = true;
  copyBtn.disabled = true;
  copyMonthlyBtn.disabled = true;
  warningEl.textContent = "";
  statusEl.textContent = "Reading links...";
  resultsEl.style.display = "none";
  resultsEl.innerHTML = "";

  try {
    const rows = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => [line]);
    const urls = rows.map((row) => row?.[0]).filter((value) => isLikelyUrl(value));
    const uniqueDomains = [...new Set(urls.map(extractDomain).filter(Boolean))];

    statusEl.textContent = `Checking 0 of ${uniqueDomains.length} domains...`;

    const results = await mapLimit(uniqueDomains, 2, async (domain, currentIndex) => {
      statusEl.textContent = `Checking ${currentIndex + 1} of ${uniqueDomains.length} domains... ${domain}`;
      const metrics = await fetchMetricsForDomain(domain);
      return [domain, metrics];
    });

    const lookup = new Map(results);
    const outputRows = rows.map((row) => {
      const original = row?.[0] ?? "";
      if (!isLikelyUrl(original)) {
        return [original, "N/A"];
      }
      const domain = extractDomain(original);
      const metrics = lookup.get(domain) || {
        hypestatMonthlyVisits: "N/A",
        similarwebMonthlyVisits: "N/A"
      };
      const numericValues = [
        parseNumericValue(metrics.hypestatMonthlyVisits),
        parseNumericValue(metrics.similarwebMonthlyVisits)
      ].filter((value) => Number.isFinite(value));
      const average = numericValues.length
        ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
        : null;
      return [original, formatMonthlyValue(average)];
    });

    resultsEl.innerHTML = "";
    resultsEl.appendChild(makeTable(outputRows.slice(0, 20)));
    resultsEl.style.display = "block";
    copyBtn.disabled = false;
    copyBtn.onclick = async () => {
      const copyText = makeCopyText(outputRows);
      await navigator.clipboard.writeText(copyText);
      statusEl.textContent = "Results copied to clipboard.";
    };
    copyMonthlyBtn.disabled = false;
    copyMonthlyBtn.onclick = async () => {
      const copyText = makeMonthlyOnlyText(outputRows);
      await navigator.clipboard.writeText(copyText);
      statusEl.textContent = "Reach values copied to clipboard.";
    };
    statusEl.textContent = "Done. The results are ready to copy.";
  } catch (error) {
    statusEl.textContent = error.message || "Could not process the file.";
  } finally {
    submitBtn.disabled = false;
  }
});
