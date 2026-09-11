import assert from "node:assert/strict";
import test from "node:test";
import {
  auditShopifyLinks,
  compareCatalogs,
  extractN8nCatalog,
  getProductHandle,
} from "../scripts/audit-wisy-catalog.mjs";

test("extracts the embedded n8n catalog without evaluating workflow code", () => {
  const workflow = {
    nodes: [{ name: "katalog", parameters: { jsCode: 'const treatments = [{"id":"one"}]; return treatments;' } }],
  };
  assert.deepEqual(extractN8nCatalog(workflow), [{ id: "one" }]);
});

test("reports catalog drift by id and important field", () => {
  const result = compareCatalogs(
    [{ id: "one", url: "https://example.com/one" }, { id: "backend-only" }],
    [{ id: "one", url: "https://example.com/changed" }, { id: "n8n-only" }],
  );

  assert.deepEqual(result.onlyBackend, ["backend-only"]);
  assert.deepEqual(result.onlyN8n, ["n8n-only"]);
  assert.deepEqual(result.different, [{ id: "one", fields: ["url"] }]);
});

test("extracts Shopify product handles and ignores non-product URLs", () => {
  assert.equal(getProductHandle("https://palaisdebeaute.de/products/hydrafacial-md?variant=1"), "hydrafacial-md");
  assert.equal(getProductHandle("https://palaisdebeaute.de/pages/contact"), null);
});

test("flags inactive, missing and price-drifted Shopify products", () => {
  const products = [{
    handle: "known",
    status: "UNLISTED",
    priceRangeV2: { minVariantPrice: { amount: "59.0", currencyCode: "EUR" } },
  }];
  const issues = auditShopifyLinks([
    { id: "inactive", url: "https://example.com/products/known", preis: "ab 49,00 EUR" },
    { id: "missing", url: "https://example.com/products/unknown" },
  ], products);

  assert.deepEqual(issues.map((issue) => issue.type), [
    "product_not_active",
    "price_mismatch",
    "missing_product",
  ]);
});
