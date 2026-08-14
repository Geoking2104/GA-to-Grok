import { getAdminClient } from "./client.js";

export async function listProperties() {
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

  return {
    count: allProperties.length,
    properties: allProperties,
  };
}

export async function getPropertyDetails(propertyId: string) {
  const client = await getAdminClient();
  const id = propertyId.replace(/^properties\//, "");

  const response = await client.properties.get({
    name: `properties/${id}`,
  });

  const p = response.data;
  return {
    propertyId: id,
    displayName: p.displayName,
    timeZone: p.timeZone,
    currencyCode: p.currencyCode,
    industryCategory: p.industryCategory,
    parent: p.parent,
  };
}
