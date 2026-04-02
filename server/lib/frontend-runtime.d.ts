import type { HttpServer } from "vite";

export function isViteMiddlewareEnabled(isProduction: unknown): boolean;

export function resolveViteAllowedHostsFromOrigins(appOriginEnv?: string): string[];

export function resolveClientIndexPath(options?: {
  clientRootDir?: string;
  clientDistDir?: string;
  isProduction?: boolean;
  existsSync?: (path: string) => boolean;
}): string;

export function createViteDevServer(options?: {
  isProduction?: boolean;
  createServer?: (config: unknown) => Promise<unknown>;
  httpServer?: HttpServer | { on?: (...args: unknown[]) => unknown };
  appOriginEnv?: string;
}): Promise<unknown | null>;
