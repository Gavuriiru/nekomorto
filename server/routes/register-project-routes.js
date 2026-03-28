import { registerProjectCatalogRoutes } from "./project/register-project-catalog-routes.js";
import { registerProjectEpubRoutes } from "./project/register-project-epub-routes.js";
import { registerProjectMangaRoutes } from "./project/register-project-manga-routes.js";
import { registerProjectWriteRoutes } from "./project/register-project-write-routes.js";

export const registerProjectRoutes = (dependencies = {}) => {
  registerProjectCatalogRoutes(dependencies);
  registerProjectEpubRoutes(dependencies);
  registerProjectMangaRoutes(dependencies);
  registerProjectWriteRoutes(dependencies);
};

export default registerProjectRoutes;
