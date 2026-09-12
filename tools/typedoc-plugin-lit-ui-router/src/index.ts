/**
 * TypeDoc plugin for lit-ui-router.
 *
 * Aggregates custom-elements-manifest tags into rendered Slots/Events lists and
 * reorganizes the category-router output (index pages, sidebar titles/links).
 *
 * @packageDocumentation
 */

import {
  Application,
  Converter,
  Context,
  DeclarationReflection,
  Reflection,
  Comment,
  CommentTag,
  RendererEvent,
} from 'typedoc';
import * as fs from 'fs';
import * as path from 'path';

/** Shape of the entries in typedoc-plugin-markdown's typedoc-sidebar.json. */
interface SidebarItem {
  text: string;
  link?: string;
  collapsed?: boolean;
}

/** Categories the `router: "category"` output is organized into. */
type Category =
  | 'core'
  | 'components'
  | 'directives'
  | 'controllers'
  | 'hooks'
  | 'types'
  | 'other';

/** Titles and blurbs for the generated category index pages. */
const CATEGORY_META: Record<Category, { title: string; description: string }> =
  {
    core: {
      title: 'Core',
      description: 'The main router class for Lit applications.',
    },
    components: {
      title: 'Components',
      description: 'Web components for routing integration.',
    },
    directives: {
      title: 'Directives',
      description: 'Lit directives for navigation and active state styling.',
    },
    controllers: {
      title: 'Controllers',
      description: 'Reactive controllers binding hosts to router transitions.',
    },
    hooks: {
      title: 'Hooks',
      description: 'Lifecycle hooks for routed components.',
    },
    types: {
      title: 'Types',
      description: 'TypeScript interfaces and type definitions.',
    },
    other: {
      title: 'Other',
      description: '',
    },
  };

/** Load the lit-ui-router TypeDoc plugin. */
export function load(app: Application): void {
  app.logger.info('[lit-ui-router] Plugin loaded');

  // Aggregate custom-elements-manifest tags into rendered Slots/Events lists
  app.converter.on(Converter.EVENT_RESOLVE_END, (context: Context) => {
    handleCemTags(context);
  });

  // Post-process output to reorganize by category
  app.renderer.on(RendererEvent.END, (event: RendererEvent) => {
    generateCategoryIndexFiles(event.outputDirectory, app);
    updateSidebarJson(event.outputDirectory, app);
  });
}

/** Generate an index.md for each category folder. */
function generateCategoryIndexFiles(outDir: string, app: Application): void {
  for (const category of Object.keys(CATEGORY_META) as Category[]) {
    const categoryDir = path.join(outDir, category);
    if (!fs.existsSync(categoryDir)) continue;

    const files = fs
      .readdirSync(categoryDir)
      .filter((f: string) => f.endsWith('.md') && f !== 'index.md')
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    if (files.length === 0) continue;

    const meta = CATEGORY_META[category];
    const items = files
      .map((f: string) => {
        const name = path.basename(f, '.md');
        return `- [\`${name}\`](./${name})`;
      })
      .join('\n');

    const next = path.basename(files[0], '.md');
    const indexContent = `---
next:
  text: ${next}
  link: ./${next}
prev:
  text: API Reference
  link: /api/reference
---
# ${meta.title}

${meta.description}

## API

${items}
`;

    fs.writeFileSync(path.join(categoryDir, 'index.md'), indexContent);
    app.logger.verbose(`[lit-ui-router] Generated ${category}/index.md`);
  }
}

/**
 * Custom-elements-manifest doc tags and the aggregate tags they render as.
 *
 * `@slot` / `@fires` use the analyzer's `{Type} name - description` syntax,
 * which TypeDoc has no renderer for (and `@event` is reserved by TypeDoc as
 * group-assignment sugar, so element events are documented with the `@fires`
 * alias instead). The tags are declared as block tags in the package's
 * tsdoc.json; each group is then rewritten here into a single aggregate tag
 * (`@slots` / `@events`) whose content is a markdown list, so class pages
 * get one "Slots" / "Events" section.
 */
const CEM_TAG_GROUPS: { tag: `@${string}`; groupTag: `@${string}` }[] = [
  { tag: '@slot', groupTag: '@slots' },
  { tag: '@fires', groupTag: '@events' },
];

/**
 * Format one CEM tag's raw content (`{Type} name - description`) as a
 * markdown list item. The type and name are both optional; a leading `-`
 * with no name means the default slot.
 */
function formatCemTagContent(text: string): string {
  let rest = text.trim();

  let type = '';
  const typeMatch = /^\{([^}]+)\}\s*/.exec(rest);
  if (typeMatch) {
    type = typeMatch[1];
    rest = rest.slice(typeMatch[0].length).trim();
  }

  let name = '';
  if (rest.startsWith('-')) {
    rest = rest.replace(/^-\s*/, '');
  } else {
    const nameMatch = /^(\S+)\s*(?:-\s*)?/.exec(rest);
    if (nameMatch) {
      name = nameMatch[1];
      rest = rest.slice(nameMatch[0].length);
    }
  }

  const description = rest.replace(/\s+/g, ' ').trim();
  const label = name ? `<code>${name}</code>` : '<em>default</em>';
  const typeSuffix = type ? ` (<code>${type}</code>)` : '';
  return `- ${label}${typeSuffix} — ${description}`;
}

/**
 * Rewrite CEM tags on every reflection comment into aggregate list tags.
 */
function handleCemTags(context: Context): void {
  const visitReflection = (reflection: Reflection): void => {
    if (reflection instanceof DeclarationReflection && reflection.comment) {
      aggregateCemTags(reflection.comment);
    }

    if ('children' in reflection) {
      const withChildren = reflection as { children?: Reflection[] };
      if (withChildren.children) {
        for (const child of withChildren.children) {
          visitReflection(child);
        }
      }
    }
  };

  visitReflection(context.project);
}

/**
 * Replace a comment's `@slot` / `@event` tags with one aggregate tag each.
 */
function aggregateCemTags(comment: Comment): void {
  for (const { tag, groupTag } of CEM_TAG_GROUPS) {
    const matches = comment.blockTags.filter((t) => t.tag === tag);
    if (matches.length === 0) continue;

    const items = matches.map((t) =>
      formatCemTagContent(Comment.combineDisplayParts(t.content)),
    );

    comment.blockTags = comment.blockTags.filter((t) => t.tag !== tag);
    comment.blockTags.push(
      new CommentTag(groupTag, [{ kind: 'text', text: items.join('\n') }]),
    );
  }
}

/** Retitle and relink the sidebar's category entries. */
function updateSidebarJson(outDir: string, app: Application): void {
  const sidebarPath = path.join(outDir, 'typedoc-sidebar.json');
  if (!fs.existsSync(sidebarPath)) return;
  const sidebar = JSON.parse(
    fs.readFileSync(sidebarPath, 'utf-8'),
  ) as SidebarItem[];
  for (const item of sidebar) {
    const category = item.text as Category;
    // Fall back to title-casing so an uncharted @category tag renders
    // instead of crashing the docs build.
    item.text =
      CATEGORY_META[category]?.title ??
      category.charAt(0).toUpperCase() + category.slice(1);
    item.link = `/api/reference/${category}`;
    delete item.collapsed;
    if (category === 'types') {
      item.collapsed = true;
    }
  }

  fs.writeFileSync(sidebarPath, JSON.stringify(sidebar, null, 2));
  app.logger.verbose('[lit-ui-router] Updated typedoc-sidebar.json');
}
