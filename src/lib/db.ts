import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

function createClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. See .env.example.");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

export function getDb() {
  const client = globalForPrisma.prisma ?? createClient();
  globalForPrisma.prisma = client;
  return client;
}
