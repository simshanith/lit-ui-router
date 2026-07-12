import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import './custom.css';
import StackBlitzEmbed from './components/StackBlitzEmbed.vue';
import ExampleEmbed from './components/ExampleEmbed.vue';
import BrandLink from './components/BrandLink.vue';
import FrameworkCard from './components/FrameworkCard.vue';
import FrameworkCards from './components/FrameworkCards.vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('StackBlitzEmbed', StackBlitzEmbed);
    app.component('ExampleEmbed', ExampleEmbed);
    app.component('BrandLink', BrandLink);
    app.component('FrameworkCard', FrameworkCard);
    app.component('FrameworkCards', FrameworkCards);
  },
} satisfies Theme;

export const isChrome =
  navigator.userAgent.includes('Chrome') &&
  navigator.vendor.includes('Google Inc');
if (isChrome) {
  document.documentElement.classList.add('chrome');
}
