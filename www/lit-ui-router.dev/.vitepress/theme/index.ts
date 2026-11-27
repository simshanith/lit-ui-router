import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import NotFound from 'vitepress/dist/client/theme-default/NotFound.vue';
import { h } from 'vue';
import './tokens.css';
import './custom.css';
import StackBlitzEmbed from './components/StackBlitzEmbed.vue';
import ExampleEmbed from './components/ExampleEmbed.vue';
import FacetedIndex from './components/FacetedIndex.vue';
import DiagramEmbed from './components/DiagramEmbed.vue';
import ElementApiViewer from './components/ElementApiViewer.vue';
import LiveExample from './components/LiveExample.vue';
import LintExample from './components/LintExample.vue';
import FrameworkSpectrum from './components/FrameworkSpectrum.vue';
import FrameworkCards from './components/FrameworkCards.vue';
import HeroInstall from './components/HeroInstall.vue';
import HomePositioning from './components/HomePositioning.vue';
import HomeSeeItRun from './components/HomeSeeItRun.vue';
import ReleaseDiffPicker from './components/ReleaseDiffPicker.vue';
import VersionBanner from './components/VersionBanner.vue';
import VersionMenu from './components/VersionMenu.vue';
import { VERSION_MENU } from '../version-menu.ts';

export default {
  extends: DefaultTheme,
  // The 404 layout renders no <main>; its not-found slot wraps the stock page in one.
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'layout-top': () => h(VersionBanner),
      'not-found': () => h('main', h(NotFound)),
      'home-hero-actions-before-actions': () => h(HeroInstall),
      'home-features-before': () => h(HomePositioning),
      'home-features-after': () => h(HomeSeeItRun),
    }),
  enhanceApp({ app }) {
    app.component('StackBlitzEmbed', StackBlitzEmbed);
    app.component('ExampleEmbed', ExampleEmbed);
    app.component('FacetedIndex', FacetedIndex);
    app.component('DiagramEmbed', DiagramEmbed);
    app.component('ElementApiViewer', ElementApiViewer);
    app.component('LiveExample', LiveExample);
    app.component('LintExample', LintExample);
    app.component('FrameworkSpectrum', FrameworkSpectrum);
    app.component('FrameworkCards', FrameworkCards);
    app.component('ReleaseDiffPicker', ReleaseDiffPicker);
    app.component(VERSION_MENU, VersionMenu);
  },
} satisfies Theme;
