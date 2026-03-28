import { createServerRouteContext } from "./create-server-route-context.js";

export const createServerRouteDependencies = (dependencies = {}) =>
  createServerRouteContext(dependencies);

export default createServerRouteDependencies;
