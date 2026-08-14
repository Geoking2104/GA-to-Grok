import { google } from "googleapis";
import { getAuthClient } from "../auth/service-account.js";

let dataClient: ReturnType<typeof google.analyticsdata> | null = null;
let adminClient: ReturnType<typeof google.analyticsadmin> | null = null;

export async function getDataClient() {
  if (dataClient) return dataClient;

  const auth = await getAuthClient();
  dataClient = google.analyticsdata({
    version: "v1beta",
    auth: auth as any,
  });
  return dataClient;
}

export async function getAdminClient() {
  if (adminClient) return adminClient;

  const auth = await getAuthClient();
  adminClient = google.analyticsadmin({
    version: "v1beta",
    auth: auth as any,
  });
  return adminClient;
}
