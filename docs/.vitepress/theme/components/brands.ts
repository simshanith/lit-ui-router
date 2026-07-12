// per-ground official marks under docs/public/images/brands/
// height: optical size (px) inside the cards' common 40px mark box —
// tuned by rendered screenshot, not intrinsic dimensions
export const brandMarks = {
  cloudflare: {
    height: 20,
    light: '/images/brands/cloudflare-icon.svg',
    dark: '/images/brands/cloudflare-icon.svg',
  },
  nginx: {
    height: 28,
    light: '/images/brands/nginx-icon.svg',
    dark: '/images/brands/nginx-icon.svg',
  },
  'react-router': {
    height: 28,
    light: '/images/brands/react-router-color-onlight.svg',
    dark: '/images/brands/react-router-color-ondark.svg',
  },
  'vue-router': {
    height: 30,
    light: '/images/brands/vue.svg',
    dark: '/images/brands/vue.svg',
  },
  angular: {
    height: 30,
    light: '/images/brands/angular-official.svg',
    dark: '/images/brands/angular-official.svg',
  },
  nextjs: {
    height: 34,
    light: '/images/brands/nextjs-icon-light.svg',
    dark: '/images/brands/nextjs-icon-dark.svg',
  },
  svelte: {
    height: 30,
    light: '/images/brands/svelte.svg',
    dark: '/images/brands/svelte.svg',
  },
  netlify: {
    height: 30,
    light: '/images/brands/netlify-monogram-light.svg',
    dark: '/images/brands/netlify-monogram-dark.svg',
  },
} as const;

export type Brand = keyof typeof brandMarks;
