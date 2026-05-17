/// <reference types="astro/client" />

import type { SiteSettings } from "../src/types/site-settings";

declare global {
  namespace App {
    interface Locals {
      nekomata?: {
        pages: Record<string, unknown> | null;
        primaryAppOrigin: string;
        siteSettings: SiteSettings;
      };
    }
  }
}

export {};
