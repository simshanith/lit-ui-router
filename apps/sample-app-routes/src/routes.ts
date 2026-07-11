// Bundled into docs/worker/index.ts too: keep this module dependency-free.
export const routeSegments = {
  welcome: '/welcome',
  home: '/home',
  login: '/login',
  contacts: '/contacts',
  'contacts.contact': '/:contactId',
  'contacts.contact.edit': '/edit',
  'contacts.new': '/new',
  mymessages: '/mymessages',
  'mymessages.compose': '/compose',
  'mymessages.messagelist': '/:folderId',
  'mymessages.messagelist.message': '/:messageId',
  prefs: '/prefs',
} as const satisfies Record<string, `/${string}`>;

export type AppRouteName = keyof typeof routeSegments;

// Dotted state names nest, so a name's full url pattern is its url-bearing
// ancestors' segments joined in order.
export function routePathPattern(name: AppRouteName): string {
  const segments: Record<string, string | undefined> = routeSegments;
  const parts = name.split('.');
  return parts
    .map((_, index) => segments[parts.slice(0, index + 1).join('.')])
    .filter((segment) => segment !== undefined)
    .join('');
}

export const routePathPatterns: string[] = (
  Object.keys(routeSegments) as AppRouteName[]
).map(routePathPattern);

// The app root ('' or '/') has no state url; router.config.ts routes it to
// 'welcome' with a urlService.rules.when(/^\/?$/) rule.
export const rootRedirectTarget: AppRouteName = 'welcome';
