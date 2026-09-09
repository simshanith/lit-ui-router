import type { HeadConfig } from 'vitepress';

/** The gtag loader pair for a measurement id, or nothing without one. */
export function analyticsHead(trackingId: string | undefined): HeadConfig[] {
  if (!trackingId) return [];
  return [
    [
      'script',
      {
        async: '',
        src: `https://www.googletagmanager.com/gtag/js?id=${trackingId}`,
      },
    ],
    [
      'script',
      {},
      `window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${trackingId}');`,
    ],
  ];
}
