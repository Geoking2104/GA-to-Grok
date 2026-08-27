import { GoogleAuth, JWT } from "google-auth-library";

const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  // Required to create Measurement Protocol API secrets
  "https://www.googleapis.com/auth/analytics.edit",
  "https://www.googleapis.com/auth/tagmanager.readonly",
  "https://www.googleapis.com/auth/tagmanager.edit.containers",
];

export async function getAuthClient(): Promise<JWT | GoogleAuth> {
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      const client = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: SCOPES,
      });
      await client.authorize();
      return client;
    } catch (err: any) {
      throw new Error(`Invalid GOOGLE_CREDENTIALS_JSON: ${err.message}`);
    }
  }

  const auth = new GoogleAuth({
    scopes: SCOPES,
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });

  return auth;
}

export function resolvePropertyId(propertyId?: string): string {
  const id = propertyId || process.env.GA4_PROPERTY_ID;
  if (!id) {
    throw new Error(
      "No propertyId provided and GA4_PROPERTY_ID environment variable is not set."
    );
  }
  return id.replace(/^properties\//, "");
}

export function assertWriteEnabled() {
  // Writes are disabled by default and must be explicitly enabled via
  // GTM_WRITE_ENABLED=true / GA4_WRITE_ENABLED=true. Any other value
  // (including unset) keeps writes blocked.
  if (process.env.GTM_WRITE_ENABLED !== "true") {
    throw new Error(
      "Write operations are disabled by default. Set GTM_WRITE_ENABLED=true to allow GTM writes."
    );
  }
  if (process.env.GA4_WRITE_ENABLED !== "true") {
    throw new Error(
      "GA4 write operations are disabled by default. Set GA4_WRITE_ENABLED=true to allow secret creation."
    );
  }
}
