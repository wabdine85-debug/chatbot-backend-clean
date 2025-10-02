import fetch from "node-fetch";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const { SHOPIFY_SHOP_NAME, SHOPIFY_API_PASSWORD } = process.env;

// Basis-URL – nur der Shopname, keine Zugangsdaten in der URL!
const BASE_URL = 
`https://${SHOPIFY_SHOP_NAME}.myshopify.com/admin/api/2024-10/products.json`;

async function fetchAllProducts() {
  const limit = 250;

  const headers = {
    "X-Shopify-Access-Token": SHOPIFY_API_PASSWORD,
    "Content-Type": "application/json"
  };

  // nur eine Seite abrufen – reicht bei <250 Produkten
  const url = `${BASE_URL}?limit=${limit}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Fehler beim Laden: ${res.statusText}`);
  }
  const data = await res.json();
  return data.products;
}

function mapToTreatments(products) {
  return products.map(p => ({
    treatment: p.title,
    description: p.body_html?.replace(/<[^>]*>/g, "").trim(),
    areas: p.variants.map(v => ({
      name: v.title,
      price: parseFloat(v.price)
    }))
  }));
}

(async () => {
  try {
    const products = await fetchAllProducts();
    const treatments = mapToTreatments(products);
    fs.writeFileSync("treatments.json", JSON.stringify(treatments, null, 
2));
    console.log(`✅ Fertig! ${treatments.length} Behandlungen in 
treatments.json gespeichert.`);
  } catch (err) {
    console.error("❌ Fehler:", err);
  }
})();

