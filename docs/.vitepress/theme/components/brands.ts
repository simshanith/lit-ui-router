// per-ground official marks under docs/public/images/brands/
export const brandMarks = {
  cloudflare: {
    light: '/images/brands/cloudflare-official.png',
    dark: '/images/brands/cloudflare-singlecolor-white.svg',
  },
  nginx: {
    light: '/images/brands/nginx-logo-light.svg',
    dark: '/images/brands/nginx-logo-dark.svg',
  },
  'react-router': {
    light: '/images/brands/react-router-color-onlight.svg',
    dark: '/images/brands/react-router-color-ondark.svg',
  },
  'vue-router': {
    light: '/images/brands/vue.svg',
    dark: '/images/brands/vue.svg',
  },
  angular: {
    light: '/images/brands/angular-official.svg',
    dark: '/images/brands/angular-official.svg',
  },
  nextjs: {
    light: '/images/brands/nextjs-icon-light.svg',
    dark: '/images/brands/nextjs-icon-dark.svg',
  },
  svelte: {
    light: '/images/brands/svelte.svg',
    dark: '/images/brands/svelte.svg',
  },
  netlify: {
    light: '/images/brands/netlify-monogram-light.svg',
    dark: '/images/brands/netlify-monogram-dark.svg',
  },
} as const;

export type Brand = keyof typeof brandMarks;
