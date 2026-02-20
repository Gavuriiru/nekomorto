import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis;
const PRISMA_CLIENT_KEY = "__nekomataPrismaClient";

const createPrismaClient = () => {
  const connectionString = String(process.env.DATABASE_URL || "").trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize PrismaClient");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
};

const getOrCreatePrismaClient = () => {
  if (!globalForPrisma[PRISMA_CLIENT_KEY]) {
    globalForPrisma[PRISMA_CLIENT_KEY] = createPrismaClient();
  }
  return globalForPrisma[PRISMA_CLIENT_KEY];
};

export const getPrismaClient = () => getOrCreatePrismaClient();

export const prisma = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getOrCreatePrismaClient();
      const value = client[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  },
);
