// Each packages/*/src/shared/ copy must equal its canonical source under
// packages/shared/*/src/ plus the header naming it, and the canonical sources
// must hold no module state: a copy per package would split it.
import {
  auditCopies,
  statefulStatements,
  SYNC_COMMAND,
} from './shared-source.core.ts';
import { onDisk, read } from './shared-source.ts';

const CHECK = 'check-shared-source';

function main(): void {
  const audit = onDisk();

  if (audit.canonicals.size === 0) {
    console.error(`${CHECK}: no canonical sources found`);
    process.exit(1);
  }

  const stateful = [...audit.canonicals].flatMap((file) =>
    statefulStatements(file, read(file)),
  );

  for (const line of stateful) {
    console.error(`${CHECK}: module state or side effect at ${line}`);
  }

  const failures = auditCopies(audit);

  for (const failure of failures) console.error(`${CHECK}: ${failure}`);

  if (failures.length > 0) {
    console.error(`${CHECK}: rewrite the copies with \`${SYNC_COMMAND}\``);
  }

  if (stateful.length > 0 || failures.length > 0) process.exit(1);

  console.log(
    `${CHECK}: ${audit.copies.size} copies of ${audit.canonicals.size} canonical sources in sync`,
  );
}

if (import.meta.main) main();
