import { sanitizeAnnouncement, isEmptyHtml } from "./sanitize";
import type { Globals } from "./config";

export interface AnnouncementRender {
  shouldRender: boolean;
  safeHtml: string;
  style: string;
}

export function getAnnouncementRender(banner: Globals["banner"]): AnnouncementRender {
  const shouldRender = banner.enabled && !isEmptyHtml(banner.contentHtml);
  return {
    shouldRender,
    safeHtml: shouldRender ? sanitizeAnnouncement(banner.contentHtml) : "",
    style: `background:${banner.bgHex};color:${banner.textHex}`,
  };
}
