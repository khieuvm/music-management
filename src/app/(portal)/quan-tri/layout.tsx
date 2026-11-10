import { requireActor } from "@/lib/auth/session";

export default async function ManagerLayout({ children }: LayoutProps<"/quan-tri">) {
  await requireActor(["ADMIN", "STAFF"]);
  return children;
}
