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
  if (process.env.GTM_WRITE_ENABLED === "false") {
    throw new Error(
      "Write operations are disabled (GTM_WRITE_ENABLED=false). Set GTM_WRITE_ENABLED=true to allow writes."
    );
  }
  if (process.env.GA4_WRITE_ENABLED === "false") {
    throw new Error(
      "GA4 write operations are disabled (GA4_WRITE_ENABLED=false). Set GA4_WRITE_ENABLED=true to allow secret creation."
    );
  }
}
