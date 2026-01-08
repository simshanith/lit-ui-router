import DefaultTheme from 'vitepress/theme';
import './custom.css';
import StackBlitzEmbed from './components/StackBlitzEmbed.vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('StackBlitzEmbed', StackBlitzEmbed);
  },
};

export const isChrome =
  /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
if (isChrome) {
  document.documentElement.classList.add('chrome');
}
