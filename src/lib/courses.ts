import "server-only";
import { getDb } from "@/lib/db";

const publicCourseSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  description: true,
  audience: true,
  category: true,
  subject: true,
  offerings: {
    select: {
      deliveryMode: true,
      format: true,
      referenceFeeVnd: true,
    },
    orderBy: [{ deliveryMode: "asc" as const }, { format: "asc" as const }],
  },
};

export function getPublishedCourses(category?: "TALENT" | "SKILL") {
  return getDb().course.findMany({
    where: { status: "PUBLISHED", ...(category ? { category } : {}) },
    select: publicCourseSelect,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

export function getPublishedCourse(slug: string) {
  return getDb().course.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: publicCourseSelect,
  });
}

export type PublicCourse = Awaited<ReturnType<typeof getPublishedCourses>>[number];
