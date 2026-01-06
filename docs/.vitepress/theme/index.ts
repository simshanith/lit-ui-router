import DefaultTheme from 'vitepress/theme';
import './custom.css';

export default DefaultTheme;

export const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
if (isChrome) {
  document.documentElement.classList.add('chrome')
}
