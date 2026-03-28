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

  registerAdminRoutes({ app, ...admin });
  registerUserRoutes({ app, ...user });
  registerContentRoutes({ app, ...content });
  registerProjectRoutes({ app, ...project });
  registerUploadRoutes({ app, ...upload });
  registerSiteConfigRoutes({ app, ...siteConfig });
  registerIntegrationRoutes({ app, ...integration });
  registerPublicRoutes({ app, ...publicRoutes });
  registerOgRoutes({ app, ...og });
  registerSiteRoutes({ app, ...site });
  registerAppRoutes({ app, ...application });
};

export default registerServerRoutes;
