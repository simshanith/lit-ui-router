import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import './custom.css';
import StackBlitzEmbed from './components/StackBlitzEmbed.vue';
import ExampleEmbed from './components/ExampleEmbed.vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('StackBlitzEmbed', StackBlitzEmbed);
    app.component('ExampleEmbed', ExampleEmbed);
  },
} satisfies Theme;

export const isChrome =
  navigator.userAgent.includes('Chrome') &&
  navigator.vendor.includes('Google Inc');
if (isChrome) {
  document.documentElement.classList.add('chrome');
}
