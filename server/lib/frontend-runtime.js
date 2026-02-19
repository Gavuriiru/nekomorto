import fs from "fs";
import path from "path";

export const isViteMiddlewareEnabled = (isProduction) => !Boolean(isProduction);

export const resolveClientIndexPath = ({
  clientRootDir,
  clientDistDir = path.join(clientRootDir, "dist"),
  isProduction,
  existsSync = fs.existsSync,
} = {}) => {
  const distIndexPath = path.join(clientDistDir, "index.html");
  if (isProduction) {
    if (!existsSync(distIndexPath)) {
      throw new Error(
        `Missing production build at ${distIndexPath}. Run "npm run build" before "npm run start".`,
      );
    }
    return distIndexPath;
  }
  return path.join(clientRootDir, "index.html");
};

export const createViteDevServer = async ({
  isProduction,
  createServer,
} = {}) => {
  if (!isViteMiddlewareEnabled(isProduction)) {
    return null;
  }
  const createViteServer =
    createServer || (await import("vite")).createServer;
  return createViteServer({
    server: {
      middlewareMode: true,
      hmr: {
        overlay: false,
      },
    },
    appType: "custom",
  });
};
