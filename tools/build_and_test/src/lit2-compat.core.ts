// Pure pnpm-workspace.yaml transforms for the lit2-compat lane; the
// executable wrapper owns the reinstall and suite spawning.

// The catalog pin the lane installs: the one lit 2.x line CI exercises.
export const compatRange = (workspaceYaml: string): string => {
  const match = /^ {2}lit2-compat:\n {4}lit: (\S+)$/m.exec(workspaceYaml);
  if (!match) {
    throw new Error(
      'lit2-compat: no lit2-compat catalog in pnpm-workspace.yaml',
    );
  }
  const range = match[1];
  if (!range.startsWith('^2.')) {
    throw new Error(
      `lit2-compat: catalog pin "${range}" is not a lit 2.x range`,
    );
  }
  return range;
};

// The lane only means something while the published peer range still admits
// lit 2; fail loudly if the peer narrows so the lane is removed with it.
export const assertPeerRangeCoversMajor2 = (workspaceYaml: string): string => {
  const match = /publishedPeer:[\s\S]*?^ {4}lit: (.+)$/m.exec(workspaceYaml);
  if (!match) {
    throw new Error(
      'lit2-compat: no publishedPeer lit range in pnpm-workspace.yaml',
    );
  }
  const range = match[1].replaceAll("'", '');
  if (!/(^|\|\|)\s*\^2\./.test(range)) {
    throw new Error(
      `lit2-compat: publishedPeer lit range "${range}" no longer covers ` +
        'major 2; drop this lane or re-widen the peer range',
    );
  }
  return range;
};

// Repoints the DEFAULT catalog's lit entry (2-space indent — named catalog
// entries sit at 4) so the whole workspace resolves the compat line.
export const applyCompatRange = (
  workspaceYaml: string,
  range: string,
): string => {
  const entry = /^ {2}lit: \S+$/m;
  if (!entry.test(workspaceYaml)) {
    throw new Error(
      'lit2-compat: no default-catalog lit entry in pnpm-workspace.yaml',
    );
  }
  return workspaceYaml.replace(entry, `  lit: ${range}`);
};
