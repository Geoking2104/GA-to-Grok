import { GoogleAuth, JWT } from "google-auth-library";

const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/tagmanager.readonly",
  // Phase 3 — required for creating tags / triggers in workspaces
  "https://www.googleapis.com/auth/tagmanager.edit.containers",
];

/**
 * Creates an authenticated Google Auth client using Service Account.
 * Supports both file path (GOOGLE_APPLICATION_CREDENTIALS) and inline JSON (GOOGLE_CREDENTIALS_JSON).
 */
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

/** Hard safety switch for write operations */
export function assertWriteEnabled() {
  // Default: writes enabled if edit scope is present, unless explicitly disabled
  if (process.env.GTM_WRITE_ENABLED === "false") {
    throw new Error(
      "GTM write operations are disabled (GTM_WRITE_ENABLED=false). Set GTM_WRITE_ENABLED=true to allow tag/trigger creation."
    );
  }
}
