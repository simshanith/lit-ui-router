import { defineConfig, HeadConfig } from 'vitepress';

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
  vue: {
    template: {
      compilerOptions: {
        isCustomElement(tag: string) {
          return tag.startsWith('sp-');
        },
      },
    },
  },
  themeConfig: {
    logo: '/images/lit-ui-router.svg',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Tutorial', link: '/tutorial/helloworld' },
      { text: 'API', link: '/api/reference/' },
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
        text: 'API Reference',
        collapsed: false,
        items: [
          {
            text: 'Core',
            items: [
              {
                text: 'UIRouterLit',
                link: '/api/reference/classes/UIRouterLit',
              },
            ],
          },
          {
            text: 'Components',
            items: [{ text: 'UIView', link: '/api/reference/classes/UiView' }],
          },
          {
            text: 'Directives',
            items: [
              { text: 'uiSref', link: '/api/reference/variables/uiSref' },
              {
                text: 'uiSrefActive',
                link: '/api/reference/variables/uiSrefActive',
              },
              {
                text: 'UiSrefDirective',
                link: '/api/reference/classes/UiSrefDirective',
              },
              {
                text: 'UiSrefActiveDirective',
                link: '/api/reference/classes/UiSrefActiveDirective',
              },
            ],
          },
          {
            text: 'Hooks',
            items: [
              { text: 'UiOnExit', link: '/api/reference/interfaces/UiOnExit' },
              {
                text: 'UiOnParamsChanged',
                link: '/api/reference/interfaces/UiOnParamsChanged',
              },
            ],
          },
          {
            text: 'Interfaces',
            items: [
              {
                text: 'LitStateDeclaration',
                link: '/api/reference/interfaces/LitStateDeclaration',
              },
              {
                text: 'RoutedLitElement',
                link: '/api/reference/interfaces/RoutedLitElement',
              },
              {
                text: 'SrefStatus',
                link: '/api/reference/interfaces/SrefStatus',
              },
              {
                text: 'UiSrefActiveParams',
                link: '/api/reference/interfaces/UiSrefActiveParams',
              },
              {
                text: 'UIViewInjectedProps',
                link: '/api/reference/interfaces/UIViewInjectedProps',
              },
            ],
          },
          {
            text: 'Types',
            items: [
              {
                text: 'RoutedLitComponent',
                link: '/api/reference/types/RoutedLitComponent',
              },
              {
                text: 'RoutedLitTemplate',
                link: '/api/reference/types/RoutedLitTemplate',
              },
              {
                text: 'UIViewResolves',
                link: '/api/reference/types/UIViewResolves',
              },
            ],
          },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/simshanith/lit-ui-router' },
    ],
  },
};

export default defineConfig({
  ...config,
  transformHead({ pageData }) {
    const head: HeadConfig[] = [];
    const imageUrl = `${baseUrl}/images/lit-ui-router.png`;
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
      title = pageData.frontmatter.title || pageData.title;
      title = title ? `${config.title} - ${title}` : config.title;

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
});
