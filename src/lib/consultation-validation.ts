import { z } from "zod";

export const PRIVACY_VERSION = "local-preview-v1";

export const consultationSchema = z.object({
  contactName: z.string().trim().min(2, "Vui lòng nhập ít nhất 2 ký tự.").max(100, "Tên không quá 100 ký tự."),
  phone: z.string().trim().max(30, "Số điện thoại quá dài.")
    .transform((value) => value.replace(/[\s().-]/g, ""))
    .refine((value) => /^(?:0|\+84)[35789]\d{8}$/.test(value), "Nhập số di động Việt Nam hợp lệ, ví dụ 0901234567.")
    .transform((value) => value.replace(/^\+84/, "0")),
  courseId: z.union([z.uuid(), z.literal("")]).optional(),
  note: z.string().trim().max(1000, "Ghi chú không quá 1.000 ký tự.").default(""),
  consent: z.literal(true, { error: "Bạn cần đồng ý để chúng tôi liên hệ tư vấn." }),
  website: z.string().max(0, "Không thể gửi biểu mẫu này.").default(""),
}).strict();

export type ConsultationInput = z.infer<typeof consultationSchema>;
export type ConsultationField = keyof ConsultationInput;
export type ConsultationFieldErrors = Partial<Record<ConsultationField, string[]>>;
export type ConsultationResponse = {
  ok: boolean;
  message: string;
  fieldErrors?: ConsultationFieldErrors;
};
