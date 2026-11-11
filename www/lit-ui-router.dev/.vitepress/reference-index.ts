import { API_REFERENCES } from '../catalog/navigation.ts';
import { PACKAGES, ROLES } from '../catalog/packages.ts';

/** One section per role, each package linking its API reference, or its package page when it has none. */
export function referenceIndex(): string {
  return ROLES.flatMap(({ id, label }) => [
    `## ${label}`,
    '',
    ...PACKAGES.filter(({ role }) => role === id).map(({ name }) => {
      const reference = API_REFERENCES[name];
      const page = `[package page](/packages/${name})`;

      return reference
        ? `- [${name}](${reference}) — ${page}`
        : `- ${name} — no runtime API; see its ${page}`;
    }),
    '',
  ]).join('\n');
}
