// Type-level spec for the app's registry wiring: `npm run typecheck` is the assertion.
import type { CollisionsOf, ParamsOf, ResolvedParamsOf, StateName, TypedStateService } from 'ui-router-registry';
import type { TypedRouteSnapshot } from 'ui-router-effect';
import type { routes } from './routes.ts';

declare const stateService: TypedStateService;

declare const snapshot: TypedRouteSnapshot;

/** Assignability probe: the call typechecks iff the argument satisfies T. */
declare function accepts<T>(value: T): T;

// -- names: the route table's states, the bare plate included --------------------

accepts<StateName>('atlas.gallery');

accepts<StateName>('plate');

// @ts-expect-error a misspelled state name
accepts<StateName>('atlas.sheets');

// @ts-expect-error a misspelled state name
void stateService.go('atlas.offce');

// @ts-expect-error a relative ref whose tail names no state
void stateService.go('.gallry');

// -- the sheet: its number is required, its in-place params optional and null when absent

void stateService.go('atlas.sheet', { num: '7' });

void stateService.go('atlas.sheet', { num: '7', focus: '12', enlarge: null });

// @ts-expect-error a missing required param
void stateService.go('atlas.sheet');

// @ts-expect-error a url placeholder is a string
void stateService.go('atlas.sheet', { num: 7 });

// @ts-expect-error an undeclared param
void stateService.go('atlas.about', { num: '7' });

accepts<ResolvedParamsOf<'atlas.sheet'>['focus']>(null);

accepts<ResolvedParamsOf<'atlas.sheet'>['focus']>('12');

// @ts-expect-error a resolved default is present, so never undefined
accepts<ResolvedParamsOf<'atlas.sheet'>['focus']>(undefined);

// -- the gallery: a filter key clears with null, the unfiltered index passes nothing

void stateService.go('atlas.gallery');

void stateService.go('atlas.gallery', { subject: 'city', kv: null });

accepts<ParamsOf<'atlas.gallery'>>({});

// @ts-expect-error a filter value is a string
void stateService.go('atlas.gallery', { subject: 1 });

// -- the state itself: a pick or an enlarge moves a dynamic param in place ---------

void stateService.go('.', { focus: '12', enlarge: null }, { location: 'replace' });

stateService.href('.', {}, { absolute: true });

void stateService.target('atlas.notFound', undefined, { location: false });

accepts<boolean>(stateService.includes('atlas.sheet'));

// -- the route ref's snapshot, typed by ui-router-registry/effect ----------------

// @ts-expect-error a misspelled state name
snapshot.includes('atlas.sheets');

// @ts-expect-error params aren't readable until the snapshot is narrowed
accepts<keyof typeof snapshot.params>('num');

if (snapshot.includes('atlas.sheet')) {
  accepts<string>(snapshot.params.num);
  accepts<string | null>(snapshot.params.focus);
  accepts<'atlas.sheet'>(snapshot.current.name);
  // @ts-expect-error a url placeholder is a string
  accepts<number>(snapshot.params.num);
}

// The pin's three states share the focus param, so the union narrows to it.
if (snapshot.includes('atlas.city') || snapshot.includes('atlas.bricks')) {
  accepts<string | null>(snapshot.params.focus);
  // @ts-expect-error neither state declares a sheet number
  accepts<keyof typeof snapshot.params>('num');
}

// -- the table is the one registered under each of its names --------------------

type IsNever<T> = [T] extends [never] ? true : false;

accepts<IsNever<CollisionsOf<typeof routes>>>(true);
