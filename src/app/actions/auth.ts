"use server";

import { isIP } from "node:net";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { homePathFor } from "@/lib/access";
import { formObject, requireActionActor, runAction } from "@/lib/action";
import { getSessionToken, secureCookies, SESSION_COOKIE } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { changeOwnPassword, login, logout } from "@/lib/services/auth";

async function callerKey() {
  if (process.env.TRUST_PROXY === "true") {
    const ip = (await headers()).get("x-real-ip");
    if (ip && isIP(ip)) return ip;
  }
  return "unproxied";
}

export async function loginAction(formData: FormData) {
  let destination = "/";
  const result = await runAction(async () => {
    const { username = "", password = "" } = formObject(formData);
    const session = await login(getDb(), username, password, await callerKey());
    (await cookies()).set(SESSION_COOKIE, session.token, {
      httpOnly: true, sameSite: "lax", secure: secureCookies(), path: "/", expires: session.expiresAt,
    });
    destination = homePathFor(session.role);
  });
  if (result?.ok) redirect(destination);
  return result;
}

export async function logoutAction() {
  const token = await getSessionToken();
  if (token) await logout(getDb(), token);
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/dang-nhap");
}

export async function changePasswordAction(formData: FormData) {
  let destination = "/";
  const result = await runAction(async () => {
    const actor = await requireActionActor(undefined, { allowPasswordChange: true });
    const { currentPassword = "", newPassword = "", confirmPassword = "" } = formObject(formData);
    if (newPassword !== confirmPassword) throw new RangeError("Mật khẩu nhập lại không khớp.");
    await changeOwnPassword(getDb(), actor, currentPassword, newPassword, await getSessionToken());
    destination = homePathFor(actor.role);
  });
  if (result?.ok) redirect(destination);
  return result;
}
