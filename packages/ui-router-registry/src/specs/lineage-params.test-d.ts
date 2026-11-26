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

accepts<
  Same<ResolvedParamsOf<'lcfg.config'>, { id: string; '#'?: string | null }>
>(true);

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
