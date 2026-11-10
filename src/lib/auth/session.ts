import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@/generated/prisma/enums";
import { homePathFor, type Actor } from "@/lib/access";
import { getDb } from "@/lib/db";
import { findActorByToken } from "@/lib/services/auth";

export const SESSION_COOKIE = "mm_session";

export function secureCookies() {
  return (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "").startsWith("https://");
}

export async function getSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? "";
}

export const getActor = cache(async (): Promise<Actor | null> => {
  const token = await getSessionToken();
  return token ? findActorByToken(getDb(), token) : null;
});

/** Page guard: redirects anonymous users to login and other roles to their own home page. */
export async function requireActor(roles?: Role[], options: { allowPasswordChange?: boolean } = {}) {
  const actor = await getActor();
  if (!actor) redirect("/dang-nhap");
  if (actor.mustChangePassword && !options.allowPasswordChange) redirect("/doi-mat-khau");
  if (roles && !roles.includes(actor.role)) redirect(homePathFor(actor.role));
  return actor;
}
