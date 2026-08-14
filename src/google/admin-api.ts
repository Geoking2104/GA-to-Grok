import { getAdminClient } from "./client.js";
import { cacheGet, cacheSet, cacheKey, TTL } from "../cache/redis.js";

export async function listProperties() {
  const key = cacheKey("properties", { action: "list" });

  const cached = await cacheGet(key);
  if (cached) {
    return { ...cached, _cached: true };
  }

  const client = await getAdminClient();

  // First list accounts
  const accountsRes = await client.accounts.list({});
  const accounts = accountsRes.data.accounts || [];

  const allProperties: any[] = [];

  for (const account of accounts) {
    const accountId = account.name; // accounts/123456
    try {
      const propsRes = await client.properties.list({
        filter: `parent:${accountId}`,
      });

      const properties = propsRes.data.properties || [];
      for (const p of properties) {
        allProperties.push({
          propertyId: p.name?.replace("properties/", ""),
          displayName: p.displayName,
          account: account.displayName,
          accountId: accountId?.replace("accounts/", ""),
          timeZone: p.timeZone,
          currencyCode: p.currencyCode,
          industryCategory: p.industryCategory,
        });
      }
    } catch (err: any) {
      // Skip accounts we don't have access to
      console.error(`Skipping account ${accountId}: ${err.message}`);
    }
  }

  const result = {
    count: allProperties.length,
    properties: allProperties,
  };

  await cacheSet(key, result, TTL.properties);
  return result;
}

export async function getPropertyDetails(propertyId: string) {
  const id = propertyId.replace(/^properties\//, "");
  const key = cacheKey("property", { propertyId: id });

  const cached = await cacheGet(key);
  if (cached) {
    return { ...cached, _cached: true };
  }

  const client = await getAdminClient();

  const response = await client.properties.get({
    name: `properties/${id}`,
  });

  const p = response.data;
  const result = {
    propertyId: id,
    displayName: p.displayName,
    timeZone: p.timeZone,
    currencyCode: p.currencyCode,
    industryCategory: p.industryCategory,
    parent: p.parent,
  };

  await cacheSet(key, result, TTL.properties);
  return result;
}
