import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;
const PRISMA_CLIENT_KEY = "__nekomataPrismaClient";
const DEFAULT_PRISMA_TX_TIMEOUT_MS = 30_000;
const DEFAULT_PRISMA_TX_MAX_WAIT_MS = 5_000;

const clampPositiveInt = (value, fallback, { min = 1, max = 600_000 } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const normalized = Math.floor(parsed);
  if (normalized < min) {
    return min;
  }
  if (normalized > max) {
    return max;
  }
  return normalized;
};

const createPrismaClient = () => {
  const connectionString = String(process.env.DATABASE_URL || "").trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize PrismaClient");
  }
  const transactionTimeoutMs = clampPositiveInt(
    process.env.PRISMA_TX_TIMEOUT_MS,
    DEFAULT_PRISMA_TX_TIMEOUT_MS,
  );
  const transactionMaxWaitMs = clampPositiveInt(
    process.env.PRISMA_TX_MAX_WAIT_MS,
    DEFAULT_PRISMA_TX_MAX_WAIT_MS,
  );
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    transactionOptions: {
      timeout: transactionTimeoutMs,
      maxWait: transactionMaxWaitMs,
    },
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
