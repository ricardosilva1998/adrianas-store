export type IconName = "truck" | "lock" | "return" | "flag" | "heart" | "star" | "shield" | "sparkle";

export const ICON_PATHS: Record<IconName, string> = {
  truck: "M3 7h11v6H3zM14 9h4l3 3v1h-7zM5 17a2 2 0 100-4 2 2 0 000 4zm13 0a2 2 0 100-4 2 2 0 000 4z",
  lock: "M7 10V7a5 5 0 0110 0v3h1a1 1 0 011 1v9a1 1 0 01-1 1H6a1 1 0 01-1-1v-9a1 1 0 011-1h1zm2 0h6V7a3 3 0 10-6 0v3z",
  return: "M8 5L3 10l5 5v-3h6a3 3 0 013 3v3h2v-3a5 5 0 00-5-5H8V5z",
  flag: "M5 3v18M5 4h11l-2 4 2 4H5",
  heart: "M12 21s-7-4.35-7-10a4 4 0 017-2.65A4 4 0 0119 11c0 5.65-7 10-7 10z",
  star: "M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L1.9 9.2l7.1-.6L12 2z",
  shield: "M12 2l8 3v7c0 5-4 8-8 10-4-2-8-5-8-10V5l8-3z",
  sparkle: "M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z",
};
