import { GoogleAuth, JWT } from "google-auth-library";
import { readFileSync } from "fs";

const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
];

/**
 * Creates an authenticated Google Auth client using Service Account.
 * Supports both file path (GOOGLE_APPLICATION_CREDENTIALS) and inline JSON (GOOGLE_CREDENTIALS_JSON).
 */
export async function getAuthClient(): Promise<JWT | GoogleAuth> {
  // Prefer explicit JSON content if provided
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

  // Fallback to Application Default Credentials / file path
  const auth = new GoogleAuth({
    scopes: SCOPES,
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });

  return auth;
}

/**
 * Returns the resolved Property ID (from args or env).
 */
export function resolvePropertyId(propertyId?: string): string {
  const id = propertyId || process.env.GA4_PROPERTY_ID;
  if (!id) {
    throw new Error(
      "No propertyId provided and GA4_PROPERTY_ID environment variable is not set."
    );
  }
  // Accept both "123456789" and "properties/123456789"
  return id.replace(/^properties\//, "");
}
