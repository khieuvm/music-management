/**
 * Creates the first ADMIN account on a fresh installation.
 *   npm run user:create-admin -- <username> "<Tên hiển thị>"
 * The password is read from the terminal without echo. Refuses if an admin already exists.
 */
import { createInterface } from "node:readline";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { hashPassword } from "../src/lib/auth/password.ts";

const [username = "", displayName = ""] = process.argv.slice(2);
if (!/^[a-z0-9._-]{3,50}$/.test(username) || displayName.trim().length < 2) {
  console.error('Cách dùng: npm run user:create-admin -- <ten-dang-nhap> "<Tên hiển thị>"');
  console.error("Tên đăng nhập: 3–50 ký tự chữ thường không dấu, số, dấu chấm, gạch dưới, gạch ngang.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

function askHidden(question: string) {
  return new Promise<string>((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const output = rl as unknown as { _writeToOutput: (text: string) => void };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    output._writeToOutput = () => undefined;
  });
}

const password = await askHidden("Mật khẩu (ít nhất 12 ký tự): ");
if (password.length < 12 || password.length > 128) {
  console.error("Mật khẩu phải từ 12 đến 128 ký tự.");
  process.exit(1);
}
if ((await askHidden("Nhập lại mật khẩu: ")) !== password) {
  console.error("Mật khẩu nhập lại không khớp.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('active-admins'))`;
    if (await tx.user.count({ where: { role: "ADMIN" } })) throw new Error("Đã có tài khoản quản lý; hãy dùng giao diện web để tạo thêm.");
    const user = await tx.user.create({
      data: { username, displayName: displayName.trim().slice(0, 100), passwordHash, role: "ADMIN", mustChangePassword: false },
    });
    await tx.auditLog.create({ data: { actorId: null, action: "user.bootstrap_admin", entityType: "User", entityId: user.id } });
  });
  console.info(`Đã tạo tài khoản quản lý "${username}". Đăng nhập tại /dang-nhap.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
