import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import NotFound from 'vitepress/dist/client/theme-default/NotFound.vue';
import { h } from 'vue';
import './custom.css';
import StackBlitzEmbed from './components/StackBlitzEmbed.vue';
import ExampleEmbed from './components/ExampleEmbed.vue';
import LiveExample from './components/LiveExample.vue';
import FrameworkSpectrum from './components/FrameworkSpectrum.vue';
import FrameworkCards from './components/FrameworkCards.vue';

export default {
  extends: DefaultTheme,
  // The 404 layout renders no <main>; its not-found slot wraps the stock page in one.
  Layout: () =>
    h(DefaultTheme.Layout, null, { 'not-found': () => h('main', h(NotFound)) }),
  enhanceApp({ app }) {
    app.component('StackBlitzEmbed', StackBlitzEmbed);
    app.component('ExampleEmbed', ExampleEmbed);
    app.component('LiveExample', LiveExample);
    app.component('FrameworkSpectrum', FrameworkSpectrum);
    app.component('FrameworkCards', FrameworkCards);
  },
} satisfies Theme;

export const isChrome =
  navigator.userAgent.includes('Chrome') &&
  navigator.vendor.includes('Google Inc');
if (isChrome) {
  document.documentElement.classList.add('chrome');
}
