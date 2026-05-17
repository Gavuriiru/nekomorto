/// <reference types="astro/client" />

import type { PublicPagesConfig } from "../src/types/public-pages";
import type { PublicRoutePayload } from "../src/types/public-bootstrap";
import type { SiteSettings } from "../src/types/site-settings";

declare global {
  namespace App {
    interface Locals {
      nekomata?: {
        pages: PublicPagesConfig | Record<string, unknown> | null;
        primaryAppOrigin: string;
        routePayload?: PublicRoutePayload | null;
        siteSettings: SiteSettings;
      };
    }
  }
}

export {};
