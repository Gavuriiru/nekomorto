import { assertRequiredDependencies } from "./assert-required-dependencies.js";

export const ROOT_ROUTE_RUNTIME_GROUP_KEYS = Object.freeze([
  "adminExports",
  "authzLib",
  "dataRepositoryAdaptersRuntime",
  "userRuntime",
  "publicMediaRuntime",
  "adminExportRuntime",
  "projectRuntime",
  "publicRuntime",
  "webhookRuntime",
]);

export const createRouteRuntimeGroups = (dependencies = {}) =>
  assertRequiredDependencies(
    "createRouteRuntimeGroups",
    {
      adminExports: dependencies.adminExports,
      authzLib: dependencies.authzLib,
      dataRepositoryAdaptersRuntime: dependencies.dataRepositoryAdaptersRuntime,
      userRuntime: dependencies.userRuntime,
      publicMediaRuntime: dependencies.publicMediaRuntime,
      adminExportRuntime: dependencies.adminExportRuntime,
      projectRuntime: dependencies.projectRuntime,
      publicRuntime: dependencies.publicRuntime,
      webhookRuntime: dependencies.webhookRuntime,
    },
    [...ROOT_ROUTE_RUNTIME_GROUP_KEYS],
  );

export default createRouteRuntimeGroups;
