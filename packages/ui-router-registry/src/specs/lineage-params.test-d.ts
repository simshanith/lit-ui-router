// A param a child redeclares from an ancestor. `tsc --noEmit` is the assertion;
// `test/lineage-params.test.ts` runs the same shapes through core.
import type {
  ParamsOf,
  ResolvedParamsOf,
  StatesOf,
  TypedRouteSnapshot,
  TypedStateService,
} from '../index.js';

const lineageStates = [
  { name: 'lplain', url: '/lplain?id' },
  { name: 'lplain.auto', url: '/c?id', params: { id: { array: 'auto' } } },
  { name: 'lplain.int', url: '/i?{id:int}' },
  { name: 'lplain.path', url: '/a/:id' },
  { name: 'lplain.req', url: '/r/:id', params: { id: 'cd' } },
  { name: 'lauto', url: '/lauto?id', params: { id: { array: 'auto' } } },
  { name: 'lauto.plain', url: '/c?id' },
  { name: 'lauto.true', url: '/t?id', params: { id: { array: true } } },
  { name: 'lauto.config', url: '/cfg', params: { id: 'childDefault' } },
  { name: 'lauto.config.deep', url: '/d', params: { id: 'deep' } },
  { name: 'lfalse', url: '/lfalse?id', params: { id: { array: false } } },
  { name: 'lfalse.auto', url: '/c?id', params: { id: { array: 'auto' } } },
  { name: 'ltrue', url: '/ltrue?id', params: { id: { array: true } } },
  { name: 'ltrue.auto', url: '/c?id', params: { id: { array: 'auto' } } },
  { name: 'lpath', url: '/lpath/:id' },
  { name: 'lpath.auto', url: '/c?id', params: { id: { array: 'auto' } } },
  { name: 'lpath.path', url: '/c/:id' },
  { name: 'lpath.default', url: '/d?id', params: { id: 'cd' } },
  { name: 'lpath.config', url: '/f', params: { id: { value: 'cd' } } },
  { name: 'lint', url: '/lint?{id:int}' },
  { name: 'lint.plain', url: '/c?id' },
  { name: 'lint.config', url: '/f', params: { id: 'd' } },
  { name: 'lauto.typed', url: '/typed', params: { id: { type: 'int' } } },
  { name: 'ldefault', url: '/ldefault?id', params: { id: 'pd' } },
  { name: 'ldefault.plain', url: '/c?id' },
  { name: 'ldefault.path', url: '/a/:id' },
  {
    name: 'ldynamic',
    url: '/ldynamic?id',
    params: { id: { value: 'pd', dynamic: true } },
  },
  { name: 'ldynamic.plain', url: '/c?id' },
  {
    name: 'lsquash',
    url: '/lsquash/:id',
    params: { id: { value: 'pd', squash: true } },
  },
  {
    name: 'lsquash.child',
    url: '/c?id',
    params: { id: { array: 'auto', squash: '~' } },
  },
  { name: 'lcfg', url: '/lcfg', params: { id: 5 } },
  { name: 'lcfg.url', url: '/c?id' },
  { name: 'lcfg.config', url: '/f', params: { id: 'cd' } },
  { name: 'lg', url: '/lg?{id:int}' },
  { name: 'lg.p', url: '/p?id', params: { id: { array: true } } },
  { name: 'lg.p.c', url: '/c?id', params: { id: { array: 'auto' } } },
  { name: 'lg.mid', url: '/m' },
  { name: 'lg.mid.c', url: '/c?id' },
  { name: 'lprop', url: '/lprop?{id:int}' },
  {
    name: 'lpropchild',
    parent: 'lprop',
    url: '/c?id',
    params: { id: { array: 'auto' } },
  },
  { name: 'l6', url: '/l6?id&a' },
  { name: 'l6.b', url: '/2?id&b', params: { id: { array: true } } },
  { name: 'l6.b.c', url: '/3?id&c', params: { id: { array: false } } },
  { name: 'l6.b.c.d', url: '/4?id&d', params: { id: { array: 'auto' } } },
  { name: 'l6.b.c.d.e', url: '/5?{id:any}&e' },
  { name: 'l6.b.c.d.e.f', url: '/6?id&f', params: { id: { value: 'six' } } },
  { name: 'passq', url: '/passq?id' },
  { name: 'passq.dyn', url: '/c', params: { id: { dynamic: true } } },
  { name: 'passq.sq', url: '/sq', params: { id: { squash: true } } },
  { name: 'passq.vu', url: '/vu', params: { id: { value: undefined } } },
  { name: 'passq.vf', url: '/vf', params: { id: { value: () => undefined } } },
  { name: 'passq.vd', url: '/vd', params: { id: { value: 'd' } } },
  { name: 'passq.vn', url: '/vn', params: { id: { value: null } } },
  { name: 'passq.sh', url: '/sh', params: { id: 'd' } },
  { name: 'passp', url: '/passp/:id' },
  { name: 'passp.dyn', url: '/c', params: { id: { dynamic: true } } },
  { name: 'passp.vu', url: '/vu', params: { id: { value: undefined } } },
  { name: 'passp.vd', url: '/vd', params: { id: { value: 'd' } } },
  { name: 'passp.vd.q', url: '/q?id' },
  { name: 'passp.vn', url: '/vn', params: { id: { value: null } } },
  { name: 'passp.sh', url: '/sh', params: { id: 'd' } },
  { name: 'passp.qu', url: '/qu?id', params: { id: { value: undefined } } },
  { name: 'passa', url: '/passa?id', params: { id: { array: 'auto' } } },
  { name: 'passa.dyn', url: '/c', params: { id: { dynamic: true } } },
  { name: 'passa.vd', url: '/vd', params: { id: { value: 'd' } } },
  { name: 'passt', url: '/passt?id', params: { id: { array: true } } },
  { name: 'passt.dyn', url: '/c', params: { id: { dynamic: true } } },
  { name: 'passt.sh', url: '/sh', params: { id: 'd' } },
  { name: 'passi', url: '/passi?{id:int}' },
  { name: 'passi.dyn', url: '/c', params: { id: { dynamic: true } } },
  { name: 'passi.vd', url: '/vd', params: { id: { value: 'd' } } },
  { name: 'passi.vn', url: '/vn', params: { id: { value: null } } },
  { name: 'passi.qd', url: '/qd?id', params: { id: 'd' } },
  { name: 'passe', url: '/passe/:id', params: { id: { array: true } } },
  { name: 'passe.dyn', url: '/c', params: { id: { dynamic: true } } },
  { name: 'passe.vd', url: '/vd', params: { id: { value: 'd' } } },
  { name: 'passe.vn', url: '/vn', params: { id: { value: null } } },
  { name: 'passg', url: '/passg?id' },
  { name: 'passg.p', url: '/p', params: { id: { dynamic: true } } },
  { name: 'passg.p.c', url: '/c', params: { id: { dynamic: true } } },
  { name: 'passm', url: '/passm?{id:int}' },
  { name: 'passm.p', url: '/p', params: { id: { dynamic: true } } },
  { name: 'passm.p.c', url: '/c?id' },
  { name: 'passn', url: '/passn', params: { id: { dynamic: true } } },
  { name: 'passn.c', url: '/c', params: { id: { dynamic: true } } },
  { name: 'passn5', url: '/passn5', params: { id: 5 } },
  { name: 'passn5.c', url: '/c', params: { id: { dynamic: true } } },
  { name: 'b1u', url: '/b1u', params: { id: { value: undefined } } },
  { name: 'b1u.dyn', url: '/dyn', params: { id: { dynamic: true } } },
  { name: 'b1u.str', url: '/str', params: { id: 'cd' } },
  { name: 'b1f', url: '/b1f', params: { id: { value: () => undefined } } },
  { name: 'b1f.dyn', url: '/dyn', params: { id: { dynamic: true } } },
  { name: 'b1f.str', url: '/str', params: { id: 'cd' } },
  { name: 'b1a', url: '/b1a', params: { id: { array: true } } },
  { name: 'b1a.dyn', url: '/dyn', params: { id: { dynamic: true } } },
  { name: 'b1a.str', url: '/str', params: { id: 'cd' } },
  { name: 'b1as', url: '/b1as', params: { id: { array: true, value: 'd' } } },
  { name: 'b1as.dyn', url: '/dyn', params: { id: { dynamic: true } } },
  { name: 'b2c', url: '/b2c', params: { id: 'pd' } },
  {
    name: 'b2c.fn',
    url: '/fn',
    params: { id: { value: (): number | undefined => 5 } },
  },
  { name: 'b2d', url: '/b2d', params: { id: { dynamic: true } } },
  {
    name: 'b2d.fn',
    url: '/fn',
    params: { id: { value: (): string | undefined => 'd' } },
  },
  { name: 'b2q', url: '/b2q?{id:int}' },
  {
    name: 'b2q.fn',
    url: '/fn',
    params: { id: { value: (): string | undefined => 'd' } },
  },
  { name: 'b2n', url: '/b2n?id' },
  {
    name: 'b2n.fn',
    url: '/fn',
    params: { id: { value: (): string | null => 'd' } },
  },
  { name: 'b3', url: '/b3?id', params: { id: { array: true } } },
  { name: 'b3.m', url: '/m', params: { id: { type: 'int' } } },
  { name: 'b3.m.c', url: '/c', params: { id: { dynamic: true } } },
  { name: 'b3p', url: '/b3p/:id', params: { id: { array: true } } },
  { name: 'b3p.m', url: '/m', params: { id: { type: 'int' } } },
  { name: 'b3p.m.c', url: '/c', params: { id: { dynamic: true } } },
  { name: 'r1q', url: '/r1q?id' },
  { name: 'r1q.n', url: '/n/{id:int}' },
  { name: 'r1q.n.c', url: '/c', params: { id: { dynamic: true } } },
  { name: 'r1t', url: '/r1t?id', params: { id: { array: true } } },
  { name: 'r1t.n', url: '/n/{id:int}' },
  { name: 'r1t.n.c', url: '/c', params: { id: { dynamic: true } } },
  { name: 'r1i', url: '/r1i?{id:int}' },
  { name: 'r1i.s', url: '/s/:id' },
  { name: 'r1i.s.c', url: '/c', params: { id: { dynamic: true } } },
  { name: 'r1i.s.d', url: '/d', params: { id: 'd' } },
  { name: 'r1i.s.m', url: '/m' },
  { name: 'r1i.s.m.c', url: '/c', params: { id: { dynamic: true } } },
  { name: 'r2b', url: '/r2b?{id:bool}' },
  { name: 'r2b.b', url: '/b/{id:bool}' },
  { name: 'r2q', url: '/r2q?id' },
  { name: 'r2q.b', url: '/b/{id:bool}' },
  { name: 'r2q.n', url: '/n/{id:int}' },
  { name: 'r2q.bad', url: '/bad/{id:int}', params: { id: 'bad' } },
  { name: 'r4q', url: '/r4q?{id:int}' },
  { name: 'r4q.u', url: '/u', params: { id: { value: undefined } } },
  { name: 'r4q.u.c', url: '/c', params: { id: { dynamic: true } } },
  { name: 'r4p', url: '/r4p/{id:int}' },
  { name: 'r4p.f', url: '/f', params: { id: { value: () => undefined } } },
  { name: 'r4p.f.c', url: '/c', params: { id: { dynamic: true } } },
  { name: 'r4s', url: '/r4s/:id' },
  { name: 'r4s.u', url: '/u', params: { id: { value: undefined } } },
  { name: 'r4s.u.d', url: '/d', params: { id: 'd' } },
  { name: 'r4a', url: '/r4a?id', params: { id: { array: 'auto' } } },
  { name: 'r4a.f', url: '/f', params: { id: { value: () => undefined } } },
  { name: 'r4a.f.c', url: '/c', params: { id: { dynamic: true } } },
] as const;

declare module '../index.js' {
  interface RegisteredStates extends StatesOf<typeof lineageStates> {}
}

declare const stateService: TypedStateService;

declare const snapshot: TypedRouteSnapshot;

declare function accepts<T>(value: T): T;

// Mutual assignability: a required key and an optional one differ.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// -- the nearest declaration of a key is the one read back -------------------

accepts<
  Same<
    ResolvedParamsOf<'lplain.auto'>,
    { id?: string | string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<ResolvedParamsOf<'lauto.plain'>, { id?: string; '#'?: string | null }>
>(true);

accepts<
  Same<
    ResolvedParamsOf<'lfalse.auto'>,
    { id?: string | string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ResolvedParamsOf<'ltrue.auto'>,
    { id?: string | string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<ResolvedParamsOf<'lauto.true'>, { id?: string[]; '#'?: string | null }>
>(true);

accepts<
  Same<
    ResolvedParamsOf<'lpath.auto'>,
    { id?: string | string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<ResolvedParamsOf<'lplain.path'>, { id: string; '#'?: string | null }>
>(true);

accepts<
  Same<ResolvedParamsOf<'lpath.path'>, { id: string; '#'?: string | null }>
>(true);

accepts<
  Same<ResolvedParamsOf<'lint.plain'>, { id?: string; '#'?: string | null }>
>(true);

accepts<
  Same<ResolvedParamsOf<'lplain.int'>, { id?: number; '#'?: string | null }>
>(true);

accepts<
  Same<ResolvedParamsOf<'lauto.typed'>, { id: number; '#'?: string | null }>
>(true);

// An ancestor's default doesn't fill a key the child redeclares without one.
accepts<
  Same<ResolvedParamsOf<'ldefault.plain'>, { id?: string; '#'?: string | null }>
>(true);

accepts<
  Same<ResolvedParamsOf<'ldynamic.plain'>, { id?: string; '#'?: string | null }>
>(true);

accepts<
  Same<ResolvedParamsOf<'lpath.default'>, { id: string; '#'?: string | null }>
>(true);

accepts<
  Same<
    ResolvedParamsOf<'lsquash.child'>,
    { id?: string | string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<ResolvedParamsOf<'lcfg.url'>, { id?: string; '#'?: string | null }>
>(true);

// The config-only parent is core's `any` too, so the child takes and reads back its type.
accepts<
  Same<
    ResolvedParamsOf<'lcfg.config'>,
    { id: string | number; '#'?: string | null }
  >
>(true);

accepts<Same<ParamsOf<'lcfg.config'>, { id?: number; '#'?: string | null }>>(
  true,
);

// -- an untyped non-url child is core's `any`, so it passes an ancestor's url value through

accepts<
  Same<
    ResolvedParamsOf<'lauto.config'>,
    { id: string | string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ResolvedParamsOf<'lauto.config.deep'>,
    { id: string | string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ResolvedParamsOf<'lint.config'>,
    { id: string | number; '#'?: string | null }
  >
>(true);

// -- three levels, and a `parent:` lineage ------------------------------------

accepts<
  Same<
    ResolvedParamsOf<'lg.p.c'>,
    { id?: string | string[]; '#'?: string | null }
  >
>(true);

accepts<Same<ResolvedParamsOf<'lg.p'>, { id?: string[]; '#'?: string | null }>>(
  true,
);

accepts<
  Same<ResolvedParamsOf<'lg.mid.c'>, { id?: string; '#'?: string | null }>
>(true);

accepts<
  Same<
    ResolvedParamsOf<'lpropchild'>,
    { id?: string | string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ResolvedParamsOf<'l6.b.c.d.e.f'>,
    {
      id: string;
      a?: string;
      b?: string;
      c?: string;
      d?: string;
      e?: string;
      f?: string;
      '#'?: string | null;
    }
  >
>(true);

accepts<Same<ResolvedParamsOf<'l6.b.c.d.e'>['id'], unknown>>(true);

accepts<
  Same<ResolvedParamsOf<'l6.b.c.d'>['id'], string | string[] | undefined>
>(true);

accepts<Same<ResolvedParamsOf<'l6.b.c'>['id'], string | undefined>>(true);

accepts<Same<ResolvedParamsOf<'l6.b'>['id'], string[] | undefined>>(true);

// -- a state's own params don't depend on its children ------------------------

accepts<Same<ResolvedParamsOf<'lint'>, { id?: number; '#'?: string | null }>>(
  true,
);

accepts<
  Same<
    ParamsOf<'lint'>,
    { id?: number | readonly number[]; '#'?: string | null }
  >
>(true);

accepts<Same<ResolvedParamsOf<'lauto'>['id'], string | string[] | undefined>>(
  true,
);

accepts<Same<ResolvedParamsOf<'lpath'>, { id: string; '#'?: string | null }>>(
  true,
);

// -- core checks the value it takes against every declaration ----------------

accepts<
  Same<
    ParamsOf<'lplain.auto'>,
    { id?: string | readonly string[]; '#'?: string | null }
  >
>(true);

accepts<Same<ParamsOf<'lpath.auto'>, { id: string; '#'?: string | null }>>(
  true,
);

accepts<Same<ParamsOf<'lfalse.auto'>, { id?: string; '#'?: string | null }>>(
  true,
);

// @ts-expect-error the `array: false` parent takes one value
void stateService.go('lfalse.auto', { id: ['a', 'b'] });

// @ts-expect-error the `int` parent rejects a string
void stateService.go('lpropchild', { id: ['a', 'b'] });

// @ts-expect-error the `int` grandparent rejects a string
void stateService.go('lg.mid.c', { id: 'x' });

// @ts-expect-error the path parent requires it
void stateService.go('lpath.auto', {});

// @ts-expect-error the child path param requires it, whatever the parent's default
void stateService.go('ldefault.path', {});

void stateService.go('ldefault.plain', {});

// A child default fills an ancestor's required key before core checks it.
accepts<Same<ParamsOf<'lpath.default'>, { id?: string; '#'?: string | null }>>(
  true,
);

void stateService.go('lpath.default', {});

void stateService.go('lpath.config', {});

void stateService.href('lplain.req', {});

void stateService.transitionTo('lpath.default', { id: 'x' });

// -- the narrowed snapshot reads the active state's declaration ---------------

if (snapshot.includes('lauto.plain')) {
  accepts<Same<typeof snapshot.params.id, string | undefined>>(true);
}

if (snapshot.includes('lpath')) {
  accepts<Same<typeof snapshot.params.id, string | string[] | undefined>>(true);
}

// -- a pass-through without a default reads what its ancestors leave it -------

accepts<
  Same<ResolvedParamsOf<'passq.dyn'>, { id?: string; '#'?: string | null }>
>(true);

accepts<
  Same<
    ParamsOf<'passq.dyn'>,
    { id?: string | readonly string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<ResolvedParamsOf<'passq.sq'>, { id?: string; '#'?: string | null }>
>(true);

accepts<
  Same<
    ParamsOf<'passq.sq'>,
    { id?: string | readonly string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<ResolvedParamsOf<'passq.vu'>, { id?: string; '#'?: string | null }>
>(true);

accepts<
  Same<
    ParamsOf<'passq.vu'>,
    { id?: string | readonly string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<ResolvedParamsOf<'passq.vf'>, { id?: string; '#'?: string | null }>
>(true);

accepts<
  Same<
    ParamsOf<'passq.vf'>,
    { id?: string | readonly string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<ResolvedParamsOf<'passq.vd'>, { id: string; '#'?: string | null }>
>(true);

accepts<
  Same<
    ParamsOf<'passq.vd'>,
    { id?: string | readonly string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<ResolvedParamsOf<'passq.sh'>, { id: string; '#'?: string | null }>
>(true);

accepts<
  Same<
    ParamsOf<'passq.sh'>,
    { id?: string | readonly string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<ResolvedParamsOf<'passq.vn'>, { id: string | null; '#'?: string | null }>
>(true);

accepts<
  Same<
    ParamsOf<'passq.vn'>,
    { id?: string | readonly string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<ResolvedParamsOf<'passp.dyn'>, { id: string; '#'?: string | null }>
>(true);

accepts<Same<ParamsOf<'passp.dyn'>, { id: string; '#'?: string | null }>>(true);

accepts<
  Same<ResolvedParamsOf<'passp.vu'>, { id: string; '#'?: string | null }>
>(true);

accepts<Same<ParamsOf<'passp.vu'>, { id: string; '#'?: string | null }>>(true);

accepts<
  Same<ResolvedParamsOf<'passp.vd'>, { id: string; '#'?: string | null }>
>(true);

accepts<Same<ParamsOf<'passp.vd'>, { id?: string; '#'?: string | null }>>(true);

accepts<
  Same<ResolvedParamsOf<'passp.sh'>, { id: string; '#'?: string | null }>
>(true);

accepts<Same<ParamsOf<'passp.sh'>, { id?: string; '#'?: string | null }>>(true);

accepts<
  Same<ResolvedParamsOf<'passp.vn'>, { id: string | null; '#'?: string | null }>
>(true);

accepts<Same<ParamsOf<'passp.vn'>, { id: string; '#'?: string | null }>>(true);

accepts<
  Same<
    ResolvedParamsOf<'passa.dyn'>,
    { id?: string | string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ParamsOf<'passa.dyn'>,
    { id?: string | readonly string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ResolvedParamsOf<'passa.vd'>,
    { id: string | string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ParamsOf<'passa.vd'>,
    { id?: string | readonly string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ResolvedParamsOf<'passt.dyn'>,
    { id?: string | string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ParamsOf<'passt.dyn'>,
    { id?: string | readonly string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ResolvedParamsOf<'passt.sh'>,
    { id: string | string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ParamsOf<'passt.sh'>,
    { id?: string | readonly string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<ResolvedParamsOf<'passi.dyn'>, { id?: number; '#'?: string | null }>
>(true);

accepts<
  Same<
    ParamsOf<'passi.dyn'>,
    { id?: number | readonly number[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ResolvedParamsOf<'passi.vd'>,
    { id: string | number; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ParamsOf<'passi.vd'>,
    { id: number | readonly number[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<ResolvedParamsOf<'passi.vn'>, { id: number | null; '#'?: string | null }>
>(true);

accepts<
  Same<
    ParamsOf<'passi.vn'>,
    { id?: number | readonly number[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ResolvedParamsOf<'passe.dyn'>,
    { id?: string | string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ParamsOf<'passe.dyn'>,
    { id: string | readonly string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ResolvedParamsOf<'passe.vd'>,
    { id: string | string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ParamsOf<'passe.vd'>,
    { id?: string | readonly string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ResolvedParamsOf<'passe.vn'>,
    { id: string | string[] | null; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ParamsOf<'passe.vn'>,
    { id: string | readonly string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<ResolvedParamsOf<'passg.p.c'>, { id?: string; '#'?: string | null }>
>(true);

accepts<
  Same<
    ParamsOf<'passg.p.c'>,
    { id?: string | readonly string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<ResolvedParamsOf<'passg.p'>, { id?: string; '#'?: string | null }>
>(true);

accepts<
  Same<
    ParamsOf<'passg.p'>,
    { id?: string | readonly string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<ResolvedParamsOf<'passm.p.c'>, { id?: string; '#'?: string | null }>
>(true);

accepts<Same<ParamsOf<'passm.p.c'>, { id?: never; '#'?: string | null }>>(true);

accepts<
  Same<ResolvedParamsOf<'passm.p'>, { id?: number; '#'?: string | null }>
>(true);

accepts<
  Same<
    ParamsOf<'passm.p'>,
    { id?: number | readonly number[]; '#'?: string | null }
  >
>(true);

accepts<Same<ResolvedParamsOf<'passn.c'>, { id?: never; '#'?: string | null }>>(
  true,
);

accepts<Same<ParamsOf<'passn.c'>, { id?: never; '#'?: string | null }>>(true);

accepts<
  Same<ResolvedParamsOf<'passn5.c'>, { id?: number; '#'?: string | null }>
>(true);

accepts<Same<ParamsOf<'passn5.c'>, { id?: number; '#'?: string | null }>>(true);

// -- only the nearest default fills the key, and every declaration checks it --

accepts<Same<ParamsOf<'passp.vd.q'>, { id: string; '#'?: string | null }>>(
  true,
);

accepts<Same<ParamsOf<'passp.qu'>, { id: string; '#'?: string | null }>>(true);

accepts<Same<ParamsOf<'passi.qd'>, { id: never; '#'?: string | null }>>(true);

declare const passed: ResolvedParamsOf<'passq.dyn'>;

// @ts-expect-error core reads `undefined` for `go('passq.dyn', {})`
void passed.id.length;

void stateService.go('passq.dyn', {});

void stateService.go('passq.dyn', { id: 'x' });

void stateService.go('passi.vd', { id: 5 });

// @ts-expect-error the `int` parent rejects the child's `'d'` default
void stateService.go('passi.vd', {});

// @ts-expect-error the path parent rejects the child's `null` default
void stateService.go('passp.vn', {});

// -- an `any` ancestor, a typed non-url one, or a union default --------------

accepts<
  Same<ResolvedParamsOf<'b1u.dyn'>, { id?: unknown; '#'?: string | null }>
>(true);

accepts<Same<ResolvedParamsOf<'b1u.str'>['id'], unknown>>(true);

accepts<
  Same<ResolvedParamsOf<'b1f.dyn'>, { id?: unknown; '#'?: string | null }>
>(true);

accepts<Same<ResolvedParamsOf<'b1f.str'>['id'], unknown>>(true);

accepts<
  Same<ResolvedParamsOf<'b1a.dyn'>, { id?: unknown; '#'?: string | null }>
>(true);

accepts<Same<ResolvedParamsOf<'b1a.str'>['id'], unknown>>(true);

declare const fromAny: ResolvedParamsOf<'b1u.str'>;

// @ts-expect-error core reads `42` for `go('b1u.str', { id: 42 })`
void (fromAny.id satisfies string);

accepts<
  Same<
    ResolvedParamsOf<'b1as.dyn'>,
    { id?: string | string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ResolvedParamsOf<'b2c.fn'>,
    { id?: string | number; '#'?: string | null }
  >
>(true);

accepts<Same<ResolvedParamsOf<'b2d.fn'>, { id?: string; '#'?: string | null }>>(
  true,
);

accepts<
  Same<
    ResolvedParamsOf<'b3.m.c'>,
    { id?: string | string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ResolvedParamsOf<'b3p.m.c'>,
    { id?: string | string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<
    ParamsOf<'b2q.fn'>,
    { id: number | readonly number[]; '#'?: string | null }
  >
>(true);

// @ts-expect-error the `int` parent rejects the `'d'` the child's default returns
void stateService.go('b2q.fn', {});

accepts<
  Same<
    ParamsOf<'b2n.fn'>,
    { id?: string | readonly string[]; '#'?: string | null }
  >
>(true);

void stateService.go('b2n.fn');

// -- a url's query decoding overwrites a path one, and `go` takes what every declaration takes --

accepts<
  Same<ResolvedParamsOf<'r1q.n.c'>, { id?: string; '#'?: string | null }>
>(true);

accepts<
  Same<
    ResolvedParamsOf<'r1t.n.c'>,
    { id?: string | string[]; '#'?: string | null }
  >
>(true);

accepts<
  Same<ResolvedParamsOf<'r1i.s.c'>, { id?: number; '#'?: string | null }>
>(true);

accepts<
  Same<
    ResolvedParamsOf<'r1i.s.d'>,
    { id: string | number; '#'?: string | null }
  >
>(true);

accepts<
  Same<ResolvedParamsOf<'r1i.s.m.c'>, { id?: number; '#'?: string | null }>
>(true);

accepts<Same<ResolvedParamsOf<'r2b.b'>, { id?: boolean; '#'?: string | null }>>(
  true,
);

accepts<Same<ResolvedParamsOf<'r2q.b'>, { id?: boolean; '#'?: string | null }>>(
  true,
);

accepts<Same<ResolvedParamsOf<'r2q.n'>, { id: number; '#'?: string | null }>>(
  true,
);

accepts<Same<ParamsOf<'r2q.bad'>, { id: never; '#'?: string | null }>>(true);

// @ts-expect-error core throws: the `'bad'` default is not an `int`
void stateService.go('r2q.bad', {});

// -- an untyped middle state passes only what the declarations above it take --

accepts<
  Same<ResolvedParamsOf<'r4q.u.c'>, { id?: number; '#'?: string | null }>
>(true);

accepts<Same<ResolvedParamsOf<'r4p.f.c'>, { id: number; '#'?: string | null }>>(
  true,
);

accepts<Same<ResolvedParamsOf<'r4s.u.d'>, { id: string; '#'?: string | null }>>(
  true,
);

accepts<
  Same<
    ResolvedParamsOf<'r4a.f.c'>,
    { id?: string | string[]; '#'?: string | null }
  >
>(true);
