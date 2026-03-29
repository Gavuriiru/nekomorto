import { registerAdminRoutes } from "../routes/register-admin-routes.js";
import { registerAppRoutes } from "../routes/register-app-routes.js";
import { registerContentRoutes } from "../routes/register-content-routes.js";
import { registerIntegrationRoutes } from "../routes/register-integration-routes.js";
import { registerOgRoutes } from "../routes/register-og-routes.js";
import { registerProjectRoutes } from "../routes/register-project-routes.js";
import { registerPublicRoutes } from "../routes/register-public-routes.js";
import { registerSiteConfigRoutes } from "../routes/register-site-config-routes.js";
import { registerSiteRoutes } from "../routes/register-site-routes.js";
import { registerUploadRoutes } from "../routes/register-upload-routes.js";
import { registerUserRoutes } from "../routes/register-user-routes.js";
import { assertRequiredDependencies } from "./assert-required-dependencies.js";
import { SERVER_ROUTE_SECTION_KEYS } from "./server-route-section-keys.js";

const SECTION_REGISTRARS = {
  admin: registerAdminRoutes,
  user: registerUserRoutes,
  content: registerContentRoutes,
  project: registerProjectRoutes,
  upload: registerUploadRoutes,
  siteConfig: registerSiteConfigRoutes,
  integration: registerIntegrationRoutes,
  publicRoutes: registerPublicRoutes,
  og: registerOgRoutes,
  site: registerSiteRoutes,
  application: registerAppRoutes,
};

const toScopeName = (sectionName) =>
  `register${sectionName.charAt(0).toUpperCase()}${sectionName.slice(1)}Routes`;

const buildSectionDependencies = (sectionName, app, section = {}) =>
  assertRequiredDependencies(
    toScopeName(sectionName),
    { app, ...section },
    ["app", ...(SERVER_ROUTE_SECTION_KEYS[sectionName] || [])],
  );

export const registerServerRoutes = (context = {}) => {
  const {
    app,
    admin = {},
    application = {},
    content = {},
    integration = {},
    og = {},
    project = {},
    publicRoutes = {},
    site = {},
    siteConfig = {},
    upload = {},
    user = {},
  } = context;

  const sections = {
    admin,
    user,
    content,
    project,
    upload,
    siteConfig,
    integration,
    publicRoutes,
    og,
    site,
    application,
  };

  Object.entries(sections).forEach(([sectionName, sectionDependencies]) => {
    SECTION_REGISTRARS[sectionName](
      buildSectionDependencies(sectionName, app, sectionDependencies),
    );
  });
};

export default registerServerRoutes;
