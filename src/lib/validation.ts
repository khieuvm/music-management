import { z } from "zod";
import { isDateString, isTimeString } from "@/lib/time";

export const text = (max: number, label: string) =>
  z.string().trim().max(max, `${label} tối đa ${max} ký tự.`).default("");
export const requiredText = (max: number, label: string, min = 1) =>
  z.string({ error: `Vui lòng nhập ${label.toLowerCase()}.` }).trim()
    .min(min, `Vui lòng nhập ${label.toLowerCase()}.`).max(max, `${label} tối đa ${max} ký tự.`);
export const uuid = (label = "Mã") => z.uuid(`${label} không hợp lệ.`);
export const dateString = (label: string) =>
  z.string().trim().refine(isDateString, `${label} không hợp lệ.`);
export const optionalDate = (label: string) =>
  z.string().trim().refine((value) => value === "" || isDateString(value), `${label} không hợp lệ.`).default("");
export const timeString = (label: string) =>
  z.string().trim().refine(isTimeString, `${label} không hợp lệ.`);
export const vnd = (label: string) =>
  z.coerce.number({ error: `${label} không hợp lệ.` }).int(`${label} phải là số nguyên.`)
    .min(0, `${label} không được âm.`).max(2_000_000_000, `${label} quá lớn.`);
export const positiveInt = (label: string, max: number) =>
  z.coerce.number({ error: `${label} không hợp lệ.` }).int(`${label} phải là số nguyên.`)
    .min(1, `${label} phải lớn hơn 0.`).max(max, `${label} tối đa ${max}.`);
export const checkbox = z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean());
export const phone = z.string().trim().max(20, "Số điện thoại quá dài.")
  .refine((value) => value === "" || /^\+?[0-9 .-]{8,20}$/.test(value), "Số điện thoại không hợp lệ.").default("");
export const email = z.string().trim().max(254)
  .refine((value) => value === "" || z.email().safeParse(value).success, "Email không hợp lệ.").default("");
export const url = z.string().trim().max(500)
  .refine((value) => value === "" || /^https:\/\/[^\s]+$/.test(value), "Link phải bắt đầu bằng https://").default("");
