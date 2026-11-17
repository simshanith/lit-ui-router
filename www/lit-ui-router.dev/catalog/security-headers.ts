// Data only: public/_headers carries the same set for static assets (a test holds the two together) and the worker adds it to its own responses.

/** Features no page, sample app or embedded example uses; all default to `self`, so no cross-origin frame loses one. */
export const DENIED_FEATURES = [
  'accelerometer',
  'bluetooth',
  'camera',
  'display-capture',
  'geolocation',
  'gyroscope',
  'hid',
  'magnetometer',
  'microphone',
  'midi',
  'payment',
  'publickey-credentials-get',
  'screen-wake-lock',
  'serial',
  'usb',
  'xr-spatial-tracking',
] as const;

/** The security headers every response carries, by name. */
export const SECURITY_HEADERS = {
  // One day, apex only: sibling sites live on subdomains.
  'Strict-Transport-Security': 'max-age=86400',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': DENIED_FEATURES.map((name) => `${name}=()`).join(', '),
  // The docs pages frame the site's own /examples/.
  'Content-Security-Policy': "frame-ancestors 'self'",
} as const satisfies Record<string, string>;
