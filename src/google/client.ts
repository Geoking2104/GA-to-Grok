import { google } from "googleapis";
import { getAuthClient } from "../auth/service-account.js";

let dataClient: ReturnType<typeof google.analyticsdata> | null = null;
let adminClient: ReturnType<typeof google.analyticsadmin> | null = null;

// Global retry/backoff for transient Google API failures (429 / 5xx).
google.options({
  retryConfig: {
    statusCodesToRetry: [[429, 429], [500, 599]],
    retry: 4,
    retryDelay: 1000,
    httpMethodsToRetry: ["GET", "POST"],
  },
});

export async function getDataClient() {
  if (dataClient) return dataClient;

  const auth = await getAuthClient();
  dataClient = google.analyticsdata({
    version: "v1beta",
    auth,
  });
  return dataClient;
}

export async function getAdminClient() {
  if (adminClient) return adminClient;

  const auth = await getAuthClient();
  adminClient = google.analyticsadmin({
    version: "v1beta",
    auth,
  });
  return adminClient;
}
