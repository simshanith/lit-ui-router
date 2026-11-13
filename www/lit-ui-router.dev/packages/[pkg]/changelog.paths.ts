import { defineRoutes } from 'vitepress';

import {
  CHANGELOG_GLOB,
  changelogRoutes,
  changelogTransform,
} from '../../.vitepress/changelog.ts';

export default defineRoutes({
  watch: CHANGELOG_GLOB,
  paths: () => changelogRoutes(),
  transformPageData: changelogTransform,
});
