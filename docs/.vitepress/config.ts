import { defineConfig, HeadConfig, SiteConfig } from 'vitepress';

const baseUrl = 'https://lit-ui-router.dev';

const config = {
  outDir: 'dist',
  title: 'Lit UI Router',
  description: 'A @uirouter implementation for Lit',
  cleanUrls: true,
  ignoreDeadLinks: ['/app'],
  vite: {
    configFile: './.vitepress/vite.config.ts',
  },
};

// https://vitepress.dev/reference/site-config
export default defineConfig({
  ...config,
  transformHead({ pageData }) {
    const head: HeadConfig[] = [];
    const imageUrl = `${baseUrl}/images/lit-ui-router.svg`;
    const imageAlt = 'Lit UI Router logo';
    const twitterCreator = '@simloovoo';
    const twitterCard = 'summary_large_image';
    const ogType = 'website';

    let title: string;
    let description: string;
    let pageUrl: string;

    if (pageData.relativePath === 'index.md') {
      title = config.title;
      description = config.description;
      pageUrl = baseUrl;
    } else {
      title = pageData.frontmatter.title || pageData.title || config.title;
      description =
        pageData.frontmatter.description ||
        pageData.description ||
        config.description;

      const pagePath = pageData.relativePath
        .replace(/^\.\//, '')
        .replace(/\/index\.md$/, '/')
        .replace(/\.md$/, '');
      pageUrl = `${baseUrl}/${pagePath}`;
    }

    head.push(
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:image', content: imageUrl }],
      ['meta', { property: 'og:image:alt', content: imageAlt }],
      ['meta', { property: 'og:url', content: pageUrl }],
      ['meta', { property: 'og:type', content: ogType }],
      ['meta', { property: 'og:site_name', content: config.title }],
      ['meta', { name: 'twitter:card', content: twitterCard }],
      ['meta', { name: 'twitter:creator', content: twitterCreator }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
      ['meta', { name: 'twitter:image', content: imageUrl }],
      ['meta', { name: 'twitter:image:alt', content: imageAlt }],
    );
    return head;
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
