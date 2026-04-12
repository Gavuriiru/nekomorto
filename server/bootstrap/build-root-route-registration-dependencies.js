import { createRouteRuntimeGroups } from "./create-route-runtime-groups.js";

export const buildRootRouteRegistrationDependencies = (dependencies = {}) => {
  const routeRuntimeGroups =
    dependencies.routeRuntimeGroups ?? createRouteRuntimeGroups(dependencies);
  const {
    adminExports,
    authzLib,
    dataRepositoryAdaptersRuntime,
    userRuntime,
    publicMediaRuntime,
    adminExportRuntime,
    projectRuntime,
    publicRuntime,
    webhookRuntime,
    routeRuntimeGroups: _ignoredRouteRuntimeGroups,
    ...rest
  } = dependencies;

  return Object.assign(
    {},
    adminExports,
    authzLib,
    dataRepositoryAdaptersRuntime,
    userRuntime,
    publicMediaRuntime,
    adminExportRuntime,
    projectRuntime,
    publicRuntime,
    webhookRuntime,
    routeRuntimeGroups,
    { routeRuntimeGroups },
    rest,
  );
};

export default buildRootRouteRegistrationDependencies;
