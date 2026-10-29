// The provisional #904 API, named once: each piece is read off the entry it ships from, and stands in as today's behaviour while that entry lacks it.
import type { RenderInfo } from '@lit-labs/ssr';
import type { LitElement } from 'lit';
import * as client from '../client.js';
import * as server from '../index.js';

/** The name `lit-ui-router-ssr/client` exports the mixin under. */
const mixinName = 'LightDomHydrating';

/** The name `lit-ui-router-ssr` exports the light-DOM element renderer under. */
const rendererName = 'LightElementRenderer';

/** A `LitElement` class, in the shape TypeScript requires of a mixin's base. */
// oxlint-disable-next-line typescript/no-explicit-any -- a mixin's base constructor must take `any[]`
export type LitElementClass = new (...args: any[]) => LitElement;

/** The provisional signature: one class opts in, and keeps its own type. */
export type ProvisionalMixin = <Base extends LitElementClass>(
  base: Base,
) => Base;

/** The shipped mixin's type once `client.ts` exports it, the provisional one until then. */
export type LightDomHydratingMixin = typeof client extends {
  [mixinName]: infer Shipped;
}
  ? Shipped
  : ProvisionalMixin;

/** An `elementRenderers` entry. */
export type ElementRendererClass = RenderInfo['elementRenderers'][number];

/** The client entry, with the mixin it will export. */
const clientExports: typeof client & {
  readonly [mixinName]?: LightDomHydratingMixin;
} = client;

/** The server entry, with the renderer it will export. */
const serverExports: typeof server & {
  readonly [rendererName]?: ElementRendererClass;
} = server;

/** Whether the client entry exports the mixin yet. */
export const hasMixin: boolean = clientExports[mixinName] !== undefined;

/** Whether the server entry exports the light-DOM renderer yet. */
export const hasLightRenderer: boolean =
  serverExports[rendererName] !== undefined;

/** Today's behaviour: the class unchanged. Once the mixin ships this stops compiling against the shipped type; drop it then. */
const identity: LightDomHydratingMixin = (base) => base;

/**
 * The mixin under test. Until it ships this is the identity, so an opted-in
 * class behaves as an unopted one does today and the specs fail on behaviour,
 * not on a missing import.
 */
export const LightDomHydrating: LightDomHydratingMixin =
  clientExports[mixinName] ?? identity;

const lightRenderer = serverExports[rendererName];

/**
 * The renderers a page draws an opted-in element with: `UiViewRenderer` plus
 * the light-DOM renderer once it ships. Until then the server writes an
 * opted-in element as it writes any element no renderer claims: tag and
 * attributes, nothing inside.
 */
export const lightRenderers: ElementRendererClass[] = [
  server.UiViewRenderer,
  ...(lightRenderer ? [lightRenderer] : []),
];
