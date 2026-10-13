import "server-only";
// Server-side Shopify API client.
// Uses Client Credentials Grant to exchange Client ID + Secret for an access token,
// caches it, and provides helpers to make Admin API requests.

const STORE = process.env.SHOPIFY_STORE_DOMAIN;
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2025-01";

// In-memory token cache (per server instance)
let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  // Return cached token if still valid (refresh 5 mins before expiry)
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  const response = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify auth failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  // Tokens are typically valid for 24h; cache for that, refresh as needed
  tokenExpiresAt = Date.now() + (data.expires_in || 86400) * 1000;
  return cachedToken;
}

export async function shopifyGraphQL(query, variables = {}) {
  const token = await getAccessToken();

  const response = await fetch(
    `https://${STORE}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify GraphQL error: ${response.status} ${text}`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(result.errors)}`);
  }
  return result.data;
}

export async function shopifyREST(endpoint, options = {}) {
  const token = await getAccessToken();

  const response = await fetch(
    `https://${STORE}/admin/api/${API_VERSION}/${endpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
        ...(options.headers || {}),
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify REST error: ${response.status} ${text}`);
  }

  return response.json();
}