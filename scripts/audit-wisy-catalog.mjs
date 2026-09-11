import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const IMPORTANT_FIELDS = ["name", "url", "category", "priority", "summary", "preis", "bookable"];

export function extractN8nCatalog(workflow) {
  const catalogNode = workflow?.nodes?.find((node) => node.name === "katalog");
  const code = catalogNode?.parameters?.jsCode;
  if (typeof code !== "string") throw new Error("n8n catalog node not found");

  const marker = "const treatments = ";
  const markerIndex = code.indexOf(marker);
  if (markerIndex < 0) throw new Error("n8n treatments array not found");

  const start = markerIndex + marker.length;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < code.length; index += 1) {
    const character = code[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "[") depth += 1;
    if (character === "]") {
      depth -= 1;
      if (depth === 0) return JSON.parse(code.slice(start, index + 1));
    }
  }

  throw new Error("n8n treatments array is incomplete");
}

export function getProductHandle(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/products\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function duplicateIds(items) {
  const seen = new Set();
  const duplicates = new Set();
  for (const item of items) {
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  }
  return [...duplicates].sort();
}

export function compareCatalogs(backendCatalog, n8nCatalog) {
  const backendById = new Map(backendCatalog.map((item) => [item.id, item]));
  const n8nById = new Map(n8nCatalog.map((item) => [item.id, item]));
  const sharedIds = [...backendById.keys()].filter((id) => n8nById.has(id)).sort();

  return {
    backendCount: backendCatalog.length,
    n8nCount: n8nCatalog.length,
    duplicateBackendIds: duplicateIds(backendCatalog),
    duplicateN8nIds: duplicateIds(n8nCatalog),
    onlyBackend: [...backendById.keys()].filter((id) => !n8nById.has(id)).sort(),
    onlyN8n: [...n8nById.keys()].filter((id) => !backendById.has(id)).sort(),
    different: sharedIds.flatMap((id) => {
      const fields = IMPORTANT_FIELDS.filter(
        (field) => JSON.stringify(backendById.get(id)?.[field] ?? null)
          !== JSON.stringify(n8nById.get(id)?.[field] ?? null),
      );
      return fields.length ? [{ id, fields }] : [];
    }),
  };
}

function documentedPrice(value) {
  if (typeof value !== "string") return null;
  const match = value.replace(",", ".").match(/(\d+(?:\.\d{1,2})?)/);
  return match ? Number(match[1]) : null;
}

export function auditShopifyLinks(items, shopifyProducts) {
  const productsByHandle = new Map(shopifyProducts.map((product) => [product.handle, product]));
  const issues = [];

  for (const item of items) {
    const handle = getProductHandle(item.url);
    if (!handle) continue;

    const product = productsByHandle.get(handle);
    if (!product) {
      issues.push({ id: item.id, type: "missing_product", handle });
      continue;
    }
    if (product.status !== "ACTIVE") {
      issues.push({ id: item.id, type: "product_not_active", handle, status: product.status });
    }

    const catalogPrice = documentedPrice(item.preis);
    const shopifyPrice = Number(product.priceRangeV2?.minVariantPrice?.amount);
    if (catalogPrice !== null && Number.isFinite(shopifyPrice) && catalogPrice !== shopifyPrice) {
      issues.push({ id: item.id, type: "price_mismatch", catalogPrice, shopifyPrice });
    }
  }

  return issues;
}

function printList(label, values) {
  console.log(`${label}: ${values.length ? values.join(", ") : "none"}`);
}

function run() {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const backendCatalog = JSON.parse(fs.readFileSync(path.join(projectRoot, "treatments.json"), "utf8"));
  const workflow = JSON.parse(fs.readFileSync(path.join(projectRoot, "wisy.json"), "utf8"));
  const n8nCatalog = extractN8nCatalog(workflow);
  const comparison = compareCatalogs(backendCatalog, n8nCatalog);

  console.log(`backend_count=${comparison.backendCount}`);
  console.log(`n8n_count=${comparison.n8nCount}`);
  printList("only_backend", comparison.onlyBackend);
  printList("only_n8n", comparison.onlyN8n);
  printList("duplicate_backend_ids", comparison.duplicateBackendIds);
  printList("duplicate_n8n_ids", comparison.duplicateN8nIds);
  for (const difference of comparison.different) {
    console.log(`different=${difference.id}:${difference.fields.join(",")}`);
  }

  const snapshotFlag = process.argv.indexOf("--shopify-snapshot");
  if (snapshotFlag >= 0) {
    const snapshotPath = process.argv[snapshotFlag + 1];
    if (!snapshotPath) throw new Error("--shopify-snapshot requires a JSON file");
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
    const products = snapshot.products?.nodes;
    if (!Array.isArray(products)) throw new Error("invalid Shopify product snapshot");

    for (const [source, items] of [["backend", backendCatalog], ["n8n", n8nCatalog]]) {
      for (const issue of auditShopifyLinks(items, products)) {
        console.log(`shopify_issue=${source}:${issue.id}:${issue.type}`);
      }
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) run();
