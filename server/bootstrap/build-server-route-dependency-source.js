import {
  assertRequiredDependencies,
  mergeDependencySources,
  pickDependencyKeys,
} from "./assert-required-dependencies.js";
import { SERVER_ROUTE_SECTION_KEYS } from "./server-route-section-keys.js";

export const SERVER_ROUTE_DEPENDENCY_KEYS = [
  ...new Set(Object.values(SERVER_ROUTE_SECTION_KEYS).flat()),
];

export const buildServerRouteDependencySource = (...sources) => {
  const merged = mergeDependencySources(...sources);
  const dependencySource = {
    app: merged.app,
    ...pickDependencyKeys(merged, SERVER_ROUTE_DEPENDENCY_KEYS),
  };
  return assertRequiredDependencies("registerServerRoutes", dependencySource, [
    "app",
    ...SERVER_ROUTE_DEPENDENCY_KEYS,
  ], {
    allowUndefined: true,
  });
};

export default buildServerRouteDependencySource;
