import { reaction, type IReactionDisposer } from 'mobx';
import { UIRouter, type RawParams, type Transition } from '@uirouter/core';
import { RouterStore } from 'ui-router-mobx';

const router = new UIRouter();

const store: RouterStore = RouterStore.for(router);

export const inAdmin: boolean = store.includes('admin.**', { id: '1' });

export const params: RawParams = store.params;

export const transition: Transition | undefined = store.transition;

const detach: () => void = new RouterStore().attach(router);

export const dispose: IReactionDisposer = reaction(
  () => store.current?.name,
  () => detach(),
);
