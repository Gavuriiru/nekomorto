import { buildDirectRouteRegistrationDependenciesFromRoot } from "./build-direct-route-registration-dependencies-from-root.js";
import { buildServerRouteContextSourceFromRoot } from "./build-server-route-context-source-from-root.js";
import { createServerRouteDependencies } from "./create-server-route-dependencies.js";
import { registerDirectServerRoutes } from "./register-direct-server-routes.js";
import { registerServerRoutes } from "./register-server-routes.js";

export const createRootServerRouteContexts = (dependencies = {}) => {
  const directRouteDependencies = buildDirectRouteRegistrationDependenciesFromRoot(dependencies);
  const serverRouteDependencySource = buildServerRouteContextSourceFromRoot(dependencies);
  const serverRouteDependencies = createServerRouteDependencies(serverRouteDependencySource);

  return {
    directRouteDependencies,
    serverRouteDependencies,
    serverRouteDependencySource,
  };
};

export const registerRootServerRoutes = (
  dependencies = {},
  {
    registerDirectRoutes = registerDirectServerRoutes,
    registerRoutes = registerServerRoutes,
  } = {},
) => {
  const contexts = createRootServerRouteContexts(dependencies);
  registerDirectRoutes(contexts.directRouteDependencies);
  registerRoutes(contexts.serverRouteDependencies);
  return contexts;
};

export default registerRootServerRoutes;
