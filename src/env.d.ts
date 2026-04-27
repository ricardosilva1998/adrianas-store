/// <reference path="../.astro/types.d.ts" />

import type { SessionUser } from "./lib/auth";
import type { CustomerSession } from "./lib/customer-auth";
import type { SiteConfig } from "./lib/config";
import type { PagePreviewValue } from "./lib/preview-store";

declare global {
  namespace App {
    interface Locals {
      user?: SessionUser;
      customer?: CustomerSession;
      previewConfig?: SiteConfig;
      pagePreview?: PagePreviewValue;
    }
  }
}

export {};
