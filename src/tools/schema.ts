import { z } from "zod";

/** Reusable id/string fragments shared across tool schemas. */
export const id = z.string();
export const accountId = id;
export const containerId = id;
export const workspaceId = id;
export const propertyId = id;
export const eventName = id;
export const url = id;

/** Build a strict object schema (rejects unknown keys to catch typos). */
export function strict<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).strict();
}
