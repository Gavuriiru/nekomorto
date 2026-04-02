import { buildRootRouteRegistrationDependencies } from "./build-root-route-registration-dependencies.js";
import { createRouteRuntimeGroups } from "./create-route-runtime-groups.js";

export const buildRootServerRegistrationSource = (dependencies = {}) => {
  const routeRuntimeGroups =
    dependencies.routeRuntimeGroups ?? createRouteRuntimeGroups(dependencies);

  return buildRootRouteRegistrationDependencies({
    ...dependencies,
    routeRuntimeGroups,
  });
};

export default buildRootServerRegistrationSource;
