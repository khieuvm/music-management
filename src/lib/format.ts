export function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export const deliveryLabels = {
  OFFLINE: "Tại trung tâm",
  ONLINE: "Học online",
};

export const categoryLabels = {
  TALENT: "Năng khiếu",
  SKILL: "Kỹ năng",
};

export const categorySlugs = { "nang-khieu": "TALENT", "ky-nang": "SKILL" } as const;

export function subjectIcon(subject: string) {
  return /cờ|chess/i.test(subject) ? "♞" : "♪";
}

export const classFormatLabels = {
  GROUP: "Học nhóm",
  INDIVIDUAL: "Kèm 1–1",
};
