/** The tab routes, in bar order. Every one must draw a filled icon when active (see TabIcon). */
export const TAB_ROUTES = ['index', 'log', 'calc', 'trends', 'profile'] as const;
export type TabRoute = (typeof TAB_ROUTES)[number];
