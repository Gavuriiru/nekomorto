import { buildServerRouteLocalDependencies } from "./build-server-route-local-dependencies.js";
import { buildServerRouteContextSource } from "./build-server-route-source.js";

export const buildServerRouteContextSourceFromRoot = (dependencies = {}) => {
  const {
    adminExportRuntime = {},
    adminExports = {},
    authzLib = {},
    dataRepositoryAdaptersRuntime = {},
    projectRuntime = {},
    publicMediaRuntime = {},
    publicRuntime = {},
    userRuntime = {},
    webhookRuntime = {},
    ...rest
  } = dependencies;

  return buildServerRouteContextSource(
    buildServerRouteLocalDependencies({
      ...rest,
      ...adminExports,
      ...authzLib,
      ...dataRepositoryAdaptersRuntime,
      ...userRuntime,
      ...publicMediaRuntime,
      ...adminExportRuntime,
      ...projectRuntime,
      ...publicRuntime,
      ...webhookRuntime,
    }),
    { publicMediaRuntime },
    adminExports,
    authzLib,
    dataRepositoryAdaptersRuntime,
    userRuntime,
    publicMediaRuntime,
    adminExportRuntime,
    projectRuntime,
    publicRuntime,
    webhookRuntime,
  );
};

export default buildServerRouteContextSourceFromRoot;
