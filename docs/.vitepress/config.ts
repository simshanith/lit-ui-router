import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  outDir: 'dist',
  title: 'Lit UI Router',
  description: 'A @uirouter implementation for Lit',
  cleanUrls: true,
  ignoreDeadLinks: ['/app'],
  vite: {
    configFile: './.vitepress/vite.config.ts',
  },
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/images/lit-ui-router.svg',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Tutorial', link: '/tutorial/helloworld' },
      { text: 'API', link: '/api/' },
      { text: 'Sample App', link: '/app', target: '_self' },
    ],
    sidebar: [
      {
        text: 'Tutorial',
        items: [
          { text: 'Hello World', link: '/tutorial/helloworld' },
          { text: 'Hello Solar System', link: '/tutorial/hellosolarsystem' },
          { text: 'Hello Galaxy', link: '/tutorial/hellogalaxy' },
        ],
      },
      {
        text: 'Reference',
        items: [{ text: 'API', link: '/api/' }],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/simshanith/lit-ui-router' },
    ],
  },
});
