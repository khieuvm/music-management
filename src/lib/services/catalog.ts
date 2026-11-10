import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { assertManager, type Actor } from "@/lib/access";
import { audit } from "@/lib/services/audit";
import { requiredText } from "@/lib/validation";

const optionalFee = z.string().trim().refine((value) => value === "" || /^\d{1,10}$/.test(value), "Học phí tham khảo không hợp lệ.")
  .transform((value) => (value === "" ? null : Number(value)));

export const OFFERING_KEYS = [
  ["OFFLINE", "GROUP"], ["OFFLINE", "INDIVIDUAL"], ["ONLINE", "GROUP"], ["ONLINE", "INDIVIDUAL"],
] as const;

export const courseSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang.").max(100),
  title: requiredText(150, "Tên khóa học", 2),
  category: z.enum(["TALENT", "SKILL"], "Chọn nhóm khóa học."),
  subject: requiredText(50, "Môn học"),
  summary: requiredText(300, "Mô tả ngắn"),
  description: requiredText(5000, "Nội dung chi tiết"),
  audience: requiredText(300, "Đối tượng phù hợp"),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});
export type CourseInput = Record<string, string | undefined>;

function parseOfferings(raw: CourseInput) {
  return OFFERING_KEYS.map(([deliveryMode, format]) => ({
    deliveryMode,
    format,
    enabled: raw[`offer_${deliveryMode}_${format}`] === "on",
    referenceFeeVnd: optionalFee.parse(raw[`fee_${deliveryMode}_${format}`] ?? ""),
  }));
}

export async function saveCourse(db: PrismaClient, actor: Actor, courseId: string | null, raw: CourseInput) {
  assertManager(actor);
  const data = courseSchema.parse(raw);
  const offerings = parseOfferings(raw);
  return db.$transaction(async (tx) => {
    const course = courseId
      ? await tx.course.update({ where: { id: courseId }, data })
      : await tx.course.create({ data });
    for (const { deliveryMode, format, enabled, referenceFeeVnd } of offerings) {
      const where = { courseId_deliveryMode_format: { courseId: course.id, deliveryMode, format } };
      if (enabled) {
        await tx.courseOffering.upsert({
          where, create: { courseId: course.id, deliveryMode, format, referenceFeeVnd }, update: { referenceFeeVnd },
        });
      } else {
        await tx.courseOffering.deleteMany({ where: { courseId: course.id, deliveryMode, format } });
      }
    }
    await audit(tx, actor, courseId ? "course.updated" : "course.created", "Course", course.id, { status: data.status });
    return course;
  });
}
