<script setup lang="ts">
// The site footer; vite.config.ts aliases Layout's VPFooter import here, so it is inert with the rest of the page under the open nav screen.
import { useData, withBase } from 'vitepress';
import { useLayout } from 'vitepress/theme';
import { computed } from 'vue';

import {
  COPYRIGHT,
  FOOTER_BAR,
  FOOTER_GROUPS,
  FOOTER_REFERENCES,
} from '../../../catalog/footer.ts';
import { FLAMES_MARK } from '../../../catalog/mark.ts';
import type { NavLink } from '../../../catalog/navigation.ts';

const { frontmatter } = useData();

const { hasSidebar } = useLayout();

const expanded = computed(() => frontmatter.value.layout === 'home');

// A target keeps VitePress's router off the link: a new tab for another site, a full navigation for a path it has no page for.
const anchor = ({ link, target }: NavLink) =>
  link.startsWith('/')
    ? { href: withBase(link), target }
    : { href: link, target: '_blank', rel: 'noopener' };

const external = { target: '_blank', rel: 'noopener' };
</script>

<template>
  <footer
    class="site-footer"
    :class="{ expanded, 'has-sidebar': hasSidebar }"
    :data-mode="expanded ? 'expanded' : 'compact'"
  >
    <div v-if="expanded" class="edge" aria-hidden="true" />
    <div class="inner">
      <div class="top">
        <div class="brand">
          <svg
            class="mark"
            xmlns="http://www.w3.org/2000/svg"
            :viewBox="FLAMES_MARK.viewBox"
            aria-hidden="true"
            focusable="false"
          >
            <path fill="currentColor" :d="FLAMES_MARK.path" />
          </svg>
          <span v-if="expanded" class="mark gradient-mark" aria-hidden="true">
            <span class="sheen" />
          </span>
          <div class="brand-copy">
            <p class="name">Lit UI Router</p>
            <p v-if="expanded" class="tagline">
              State-based routing for Lit, built on
              <a :href="FOOTER_REFERENCES.core" v-bind="external"
                >@uirouter/core</a
              >.
            </p>
          </div>
        </div>

        <nav class="links" aria-label="Footer">
          <template v-if="expanded">
            <div v-for="group in FOOTER_GROUPS" :key="group.id" class="group">
              <p :id="`site-footer-${group.id}`" class="group-title">
                {{ group.title }}
              </p>
              <ul class="list" :aria-labelledby="`site-footer-${group.id}`">
                <li v-for="link in group.links" :key="link.link">
                  <a v-bind="anchor(link)">{{ link.text }}</a>
                </li>
              </ul>
            </div>
          </template>
          <ul v-else class="list">
            <li v-for="link in FOOTER_BAR" :key="link.link">
              <a v-bind="anchor(link)">{{ link.text }}</a>
            </li>
          </ul>
        </nav>
      </div>

      <div class="colophon">
        <p>
          <a :href="FOOTER_REFERENCES.uiRouter" v-bind="external">UI-Router</a>
          for
          <a :href="FOOTER_REFERENCES.lit" v-bind="external">Lit</a>
          web components.
        </p>
        <p>
          <a :href="FOOTER_REFERENCES.license" v-bind="external">MIT License</a>
          &middot; Copyright &copy; {{ COPYRIGHT }}.
        </p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  position: relative;
  z-index: var(--vp-z-index-footer);
  background: var(--site-color-surface);
  border-block-start: var(--site-border-width) solid var(--site-color-line);
  color: var(--site-color-text-muted);
  font-size: var(--site-text-sm);
  line-height: 1.5;
  /* The home sections' gutters and measure, so the footer's edges meet theirs. */
  padding-inline: 1.5rem;
}

.site-footer.expanded {
  background: var(--site-color-surface-soft);
}

.inner {
  display: grid;
  gap: var(--site-space-3);
  margin-inline: auto;
  max-inline-size: 72rem;
  padding-block: var(--site-space-5);
}

.expanded .inner {
  gap: var(--site-space-6);
  padding-block-start: var(--site-space-8);
}

@media (min-width: 40rem) {
  .site-footer {
    padding-inline: 3rem;
  }

  .expanded .inner {
    padding-block-start: 2.5rem;
  }
}

@media (min-width: 60rem) {
  .site-footer {
    padding-inline: 4rem;
  }
}

/* Beside a sidebar the footer starts at the sidebar's edge, as VPContent does, and its text keeps the doc column's gutters. */
.site-footer.has-sidebar {
  padding-inline: 1.5rem;
}

.has-sidebar .inner {
  margin-inline: 0;
  max-inline-size: calc(
    var(--vp-layout-max-width) - var(--vp-sidebar-width) - 8rem
  );
}

@media (min-width: 48rem) {
  .site-footer.has-sidebar {
    padding-inline: 2rem;
  }
}

@media (min-width: 60rem) {
  .site-footer.has-sidebar {
    margin-inline-start: var(--vp-sidebar-width);
    padding-inline: 4rem;
  }
}

@media (min-width: 90rem) {
  .site-footer.has-sidebar {
    margin-inline-start: calc(
      (100% - var(--vp-layout-max-width)) / 2 + var(--vp-sidebar-width)
    );
  }
}

.top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--site-space-3) var(--site-space-6);
}

.expanded .top {
  align-items: start;
  gap: var(--site-space-6) var(--site-space-8);
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--site-space-2);
}

.expanded .brand {
  gap: var(--site-space-4);
  max-inline-size: 22rem;
}

@media (min-width: 48rem) {
  .expanded .brand {
    flex-direction: column;
    align-items: start;
    gap: var(--site-space-3);
  }
}

.mark {
  flex: none;
  block-size: var(--site-icon-md);
  color: var(--site-color-identity-ink);
}

.expanded .mark {
  block-size: 56px;
}

@media (min-width: 48rem) {
  .expanded .mark {
    block-size: 80px;
  }
}

.brand-copy {
  min-inline-size: 0;
}

.name {
  margin: 0;
  font-weight: 600;
  color: var(--site-color-text);
}

.expanded .name {
  font-size: var(--site-text-md);
  line-height: 1.35;
  letter-spacing: -0.01em;
}

.tagline {
  margin: var(--site-space-1) 0 0;
  line-height: 1.6;
  text-wrap: pretty;
}

.expanded .links {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--site-space-6) var(--site-space-4);
  min-inline-size: min(100%, 16rem);
}

/* Two groups sit at the band's far edge, as the licence line does below them. */
@media (min-width: 48rem) {
  .expanded .links {
    flex: none;
    grid-template-columns: repeat(2, minmax(10rem, max-content));
    gap: var(--site-space-8);
    min-inline-size: 0;
  }
}

.group {
  min-inline-size: 0;
}

.group-title {
  margin: 0 0 var(--site-space-2);
  font-size: var(--site-text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--site-color-text);
}

.list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.site-footer:not(.expanded) .list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--site-space-1) var(--site-space-4);
}

.list a {
  display: inline-flex;
  align-items: center;
  min-block-size: 28px;
  color: inherit;
  text-decoration: none;
  touch-action: manipulation;
  transition: color var(--site-duration-fast) var(--ease-out);
}

.colophon {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--site-space-1) var(--site-space-6);
  font-size: var(--site-text-xs);
}

.expanded .colophon {
  padding-block-start: var(--site-space-4);
  border-block-start: var(--site-border-width) solid var(--site-color-line);
}

.colophon p {
  margin: 0;
  line-height: 1.8;
}

/* A link in a sentence: underlined, and padded to a 24px target without moving its line. */
:is(.colophon, .tagline) a {
  display: inline-block;
  padding-block: 3px;
  margin-block: -3px;
  color: inherit;
  text-decoration: underline;
  text-decoration-color: color-mix(in oklch, currentColor 40%, transparent);
  text-underline-offset: 0.2em;
  touch-action: manipulation;
  transition:
    color var(--site-duration-fast) var(--ease-out),
    text-decoration-color var(--site-duration-fast) var(--ease-out);
}

@media (hover: hover) and (pointer: fine) {
  .site-footer a:hover {
    color: var(--site-color-interaction);
    text-decoration-color: currentColor;
  }
}

.site-footer a:focus-visible {
  outline: var(--site-focus-ring-width) solid var(--site-color-interaction);
  outline-offset: var(--site-focus-ring-offset);
  border-radius: var(--site-radius-control-inner);
}

/* The home footer's mark: the same flames cut from a gradient. The mask sits on a box that never moves or animates. */
.gradient-mark {
  position: relative;
  overflow: clip;
  aspect-ratio: 551 / 587;
  background: var(--site-footer-mark-gradient);
  /* A longhand with no var(), as HomeSeeItRun's tile is: the highlight inside moves every frame. */
  mask-image: url(/images/lit-ui-router-flames.svg);
  mask-size: contain;
  mask-repeat: no-repeat;
}

@media (forced-colors: none) {
  .expanded svg.mark {
    display: none;
  }
}

.sheen {
  position: absolute;
  inset: 0;
}

.edge {
  display: none;
  position: absolute;
  inset-block-start: calc(-1 * var(--site-border-width));
  inset-inline: 0;
  block-size: 2px;
  overflow: clip;
  pointer-events: none;
}

/* Registered so the view timeline can interpolate it; a number, as HomeSeeItRun's drift is. */
@property --site-footer-entry {
  syntax: '<number>';
  inherits: true;
  initial-value: 0;
}

/* As the home footer enters the viewport, a highlight crosses the mark and a glint runs along the top edge, once each: the timeline moves the number on each wrapper, and the transition on its layer eases to rest. */
@media (prefers-reduced-motion: no-preference) and (forced-colors: none) {
  @supports (animation-timeline: view()) and (animation-range: entry) {
    .site-footer.expanded {
      view-timeline: --site-footer block;
    }

    .sheen,
    .edge {
      animation: site-footer-entry linear both;
      animation-timeline: --site-footer;
      animation-range: entry;
    }

    .edge {
      display: block;
    }

    :is(.sheen, .edge)::before {
      content: '';
      position: absolute;
      will-change: translate;
    }

    .sheen::before {
      inset: -20%;
      background: var(--site-footer-mark-sheen);
      translate: calc((var(--site-footer-entry) * 2.2 - 1.1) * 100%) 0;
      transition: translate 520ms var(--ease-out);
    }

    .edge::before {
      inset-block: 0;
      inset-inline-start: 0;
      inline-size: 56%;
      background: var(--site-footer-edge-glint);
      translate: calc((var(--site-footer-entry) * 1.5 - 0.35) * 100%) 0;
      transition: translate 550ms var(--ease-out);
    }
  }
}

@keyframes site-footer-entry {
  from {
    --site-footer-entry: 0;
  }

  to {
    --site-footer-entry: 1;
  }
}

@media (forced-colors: active) {
  .gradient-mark {
    display: none;
  }

  .site-footer,
  .expanded .colophon {
    border-color: CanvasText;
  }

  .mark {
    color: CanvasText;
  }
}
</style>
