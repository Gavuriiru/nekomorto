import { createServerRouteSections } from "./server-route-section-keys.js";

export const createServerRouteContext = (dependencies = {}) => ({
  app: dependencies.app,
  ...createServerRouteSections(dependencies),
});

export default createServerRouteContext;
