import { describe, expect, it } from 'vitest';
import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';
import { redactSession } from '@repo/router-events/redaction';

import { record, viewTree, type ViewInfo, type ViewsEvent } from '../index.ts';
import { readSession } from '../session-schema.ts';
import { fold } from '../fold.ts';
import { targetText, viewPath } from '../views.ts';
import type { Session, ViewFill } from '../schema.ts';

const fill = (state: string, view = '$default', anchor = ''): ViewFill => ({
  state,
  view,
  target: { name: view, anchor },
});

let ids = 0;

const view = (
  fqn: string,
  context: string,
  filled: ViewFill | null,
): ViewInfo => ({
  id: ++ids,
  name: fqn.slice(fqn.lastIndexOf('.') + 1),
  fqn,
  type: 'lit',
  context,
  fill: filled,
});

// The sample app's shape: one root view, two named views sticky states fill, and the message views inside one of them.
const app = (): ViewInfo[] => {
  const root = view('$default', '', fill('app'));

  const messages = view(
    '$default.mymessages',
    'app',
    fill('mymessages', 'mymessages'),
  );

  const contacts = view(
    '$default.contacts',
    'app',
    fill('contacts', 'contacts'),
  );

  const list = view(
    '$default.mymessages.messagelist',
    'mymessages',
    fill('mymessages.messagelist', 'messagelist', 'mymessages'),
  );

  const content = view(
    '$default.mymessages.messagecontent',
    'mymessages',
    null,
  );

  return [root, messages, contacts, list, content];
};

const fqns = (nodes: ReturnType<typeof viewTree>): unknown[] =>
  nodes.map((node) =>
    node.children.length ? [node.view.fqn, fqns(node.children)] : node.view.fqn,
  );

describe('viewTree', () => {
  it('nests each view inside the view its fqn names, keeping the given order', () => {
    const tree = viewTree(app());

    expect(fqns(tree)).toEqual([
      [
        '$default',
        [
          [
            '$default.mymessages',
            [
              '$default.mymessages.messagelist',
              '$default.mymessages.messagecontent',
            ],
          ],
          '$default.contacts',
        ],
      ],
    ]);
    expect(tree[0]?.children[0]?.children[1]).toMatchObject({
      depth: 3,
      parent: tree[0]?.children[0]?.view.id,
      view: { name: 'messagecontent', fill: null },
    });
  });

  it('draws a view at the top when the view around it is not registered', () => {
    const orphan = view('$default.gone.inner', 'gone', fill('gone.inner'));

    expect(viewTree([orphan])).toEqual([
      { view: orphan, parent: null, depth: 1, children: [] },
    ]);
  });

  it('puts a view inside the one its creating state fills when two share an fqn', () => {
    const first = view('$default', '', fill('a'));
    const second = view('$default', '', fill('b'));
    const inner = view('$default.inner', 'b', fill('b.inner'));

    const tree = viewTree([first, second, inner]);

    expect(tree.map((node) => node.children.map((c) => c.view.id))).toEqual([
      [],
      [inner.id],
    ]);
  });

  it('writes a target as a state declares it', () => {
    expect(
      targetText(fill('mymessages.messagelist', 'messagelist', 'mymessages')),
    ).toBe('messagelist@mymessages');
    expect(targetText(fill('home'))).toBe('$default@');
  });
});

describe('viewPath', () => {
  it('keeps the views a state fills and the views they sit inside, and counts the rest', () => {
    const path = viewPath(app(), 'mymessages.messagelist');

    expect(path?.state).toBe('mymessages.messagelist');
    expect(fqns(path!.nodes)).toEqual([
      [
        '$default',
        [['$default.mymessages', ['$default.mymessages.messagelist']]],
      ],
    ]);
    expect(path?.others).toBe(2);
  });

  it('keeps every view a state fills, under the views they share', () => {
    const views = app();
    const [root] = views;

    const second = view(
      '$default.sidebar',
      'app',
      fill('mymessages', 'sidebar'),
    );

    const path = viewPath([...views, second], 'mymessages');

    expect(fqns(path!.nodes)).toEqual([
      ['$default', ['$default.mymessages', '$default.sidebar']],
    ]);
    expect(path!.nodes[0]?.view).toBe(root);
    expect(path?.others).toBe(3);
  });

  it('takes the nearest ancestor that fills a view for a state that fills none', () => {
    const path = viewPath(app(), 'mymessages.messagelist.message', [
      'mymessages.messagelist',
      'mymessages',
      'app',
    ]);

    expect(path?.state).toBe('mymessages.messagelist');
  });

  it('gives no path when neither the state nor an ancestor fills a view', () => {
    expect(viewPath(app(), 'home')).toBeNull();
    expect(viewPath([], 'app')).toBeNull();
  });

  it('goes as deep as the views do', () => {
    const deep = Array.from({ length: 8 }, (_, depth) =>
      view(
        ['$default', ...Array.from({ length: depth }, (__, n) => `v${n}`)].join(
          '.',
        ),
        depth ? `s${depth - 1}` : '',
        fill(`s${depth}`),
      ),
    );

    const path = viewPath(deep, 's7');
    const depths: number[] = [];

    for (let nodes = path!.nodes; nodes.length; nodes = nodes[0].children)
      depths.push(nodes[0].depth);

    expect(depths).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(path?.others).toBe(0);
  });
});

const makeRouter = () => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  router.stateRegistry.register({ name: 'a', url: '/a/:id' });

  return router;
};

const viewsEvent = (seq: number): ViewsEvent => ({
  v: 1,
  seq,
  t: 1,
  type: 'views',
  views: app(),
  unmatched: [fill('mymessages', 'side')],
});

const withViews = (session: Session): Session => ({
  ...session,
  events: [
    ...session.events.filter((e) => e.type !== 'views'),
    viewsEvent(9000),
  ],
});

const exported = async (views?: boolean): Promise<Session> => {
  const router = makeRouter();
  const recorder = record(router, views === undefined ? {} : { views });
  await router.stateService.go('a', { id: 'secret' });
  const session = recorder.session({ params: 'all' });
  recorder.stop();
  router.dispose();

  // SAFETY: the parse of a stringified session
  return JSON.parse(JSON.stringify(session)) as Session;
};

describe('views in a session', () => {
  it('records a views snapshot by default, kept with the other snapshots', async () => {
    const session = await exported();

    expect(session.events.slice(0, 4).map((event) => event.type)).toEqual([
      'config',
      'states',
      'current',
      'views',
    ]);
    expect(fold(session.events).views).toEqual({ views: [], unmatched: [] });
  });

  it('records none when views are turned off', async () => {
    const session = await exported(false);

    expect(session.events.some((event) => event.type === 'views')).toBe(false);
    expect(fold(session.events).views).toBeNull();
  });

  it('reads views back to the same model', async () => {
    const session = withViews(await exported());
    const read = readSession(session);

    expect(read).toMatchObject({ ok: true, skipped: 0 });
    expect(read.ok && fold(read.session.events).views).toEqual({
      views: app().map((each) => ({ ...each, id: expect.any(Number) })),
      unmatched: [fill('mymessages', 'side')],
    });
  });

  it('imports a session recorded without views', async () => {
    const session = await exported(false);
    const read = readSession(session);

    expect(read).toMatchObject({ ok: true, skipped: 0 });
    expect(read.ok && fold(read.session.events).views).toBeNull();
  });

  it('skips and counts a views snapshot that does not read', async () => {
    const session = await exported();

    const read = readSession({
      ...session,
      events: session.events.map((event) =>
        event.type === 'views' ? { ...event, views: [{ fqn: 3 }] } : event,
      ),
    });

    expect(read).toMatchObject({ ok: true, skipped: 1 });
  });

  it('keeps views as they are under the strictest redaction, since they name states and views only', async () => {
    const session = withViews(await exported());
    const redacted = redactSession(session, { params: [], messages: false });

    expect(redacted.events.find((event) => event.type === 'views')).toEqual(
      session.events.find((event) => event.type === 'views'),
    );
    expect(
      redacted.events.find((event) => event.type === 'current'),
    ).toMatchObject({ params: { id: '[redacted]' } });
  });
});
