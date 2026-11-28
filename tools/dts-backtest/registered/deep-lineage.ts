// Ten levels that each redeclare `id`, under the oldest TypeScript: the walk stays tail-recursive.
import type {
  ParamsOf,
  ResolvedParamsOf,
  StatesOf,
  TypedStateService,
} from 'ui-router-registry';

const deepStates = [
  { name: 'deep', url: '/deep?id' },
  { name: 'deep.l1', url: '/1?id', params: { id: { array: true } } },
  { name: 'deep.l1.l2', url: '/2?id' },
  { name: 'deep.l1.l2.l3', url: '/3?id', params: { id: { array: 'auto' } } },
  { name: 'deep.l1.l2.l3.l4', url: '/4?id' },
  { name: 'deep.l1.l2.l3.l4.l5', url: '/5?id' },
  { name: 'deep.l1.l2.l3.l4.l5.l6', url: '/6?id' },
  { name: 'deep.l1.l2.l3.l4.l5.l6.l7', url: '/7?id' },
  { name: 'deep.l1.l2.l3.l4.l5.l6.l7.l8', url: '/8?id' },
  {
    name: 'deep.l1.l2.l3.l4.l5.l6.l7.l8.l9',
    url: '/9?id',
    params: { id: { array: 'auto' } },
  },
  { name: 'pass', url: '/pass?id' },
  { name: 'pass.l1', url: '/1', params: { id: { dynamic: true } } },
  { name: 'pass.l1.l2', url: '/2', params: { id: { dynamic: true } } },
  { name: 'pass.l1.l2.l3', url: '/3', params: { id: { dynamic: true } } },
  { name: 'pass.l1.l2.l3.l4', url: '/4', params: { id: { dynamic: true } } },
  { name: 'pass.l1.l2.l3.l4.l5', url: '/5', params: { id: { dynamic: true } } },
  {
    name: 'pass.l1.l2.l3.l4.l5.l6',
    url: '/6',
    params: { id: { dynamic: true } },
  },
  {
    name: 'pass.l1.l2.l3.l4.l5.l6.l7',
    url: '/7',
    params: { id: { dynamic: true } },
  },
  {
    name: 'pass.l1.l2.l3.l4.l5.l6.l7.l8',
    url: '/8',
    params: { id: { dynamic: true } },
  },
  {
    name: 'pass.l1.l2.l3.l4.l5.l6.l7.l8.l9',
    url: '/9',
    params: { id: { dynamic: true } },
  },
] as const;

declare module 'ui-router-registry' {
  interface RegisteredStates extends StatesOf<typeof deepStates> {}
}

declare const stateService: TypedStateService;

void stateService.go('deep.l1.l2.l3.l4.l5.l6.l7.l8.l9', { id: 'x' });

export const deepParams: ParamsOf<'deep.l1.l2.l3.l4.l5.l6.l7.l8.l9'> = {
  id: 'x',
};

export const deepRead: ResolvedParamsOf<'deep.l1.l2.l3.l4.l5.l6.l7.l8.l9'>['id'] =
  ['a', 'b'];

void stateService.go('pass.l1.l2.l3.l4.l5.l6.l7.l8.l9', { id: 'x' });

export const passRead: ResolvedParamsOf<'pass.l1.l2.l3.l4.l5.l6.l7.l8.l9'>['id'] =
  undefined;
