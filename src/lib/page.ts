import "server-only";
import { notFound } from "next/navigation";
import { RequestError } from "@/lib/http";

/** Hides records the actor may not see (403/404 from services) behind the standard 404 page. */
export async function orNotFound<T>(load: Promise<T>): Promise<T> {
  try {
    return await load;
  } catch (error) {
    if (error instanceof RequestError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
