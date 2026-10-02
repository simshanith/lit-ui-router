import { Message } from './interface.js';

/**
 * A frozen deep clone of a folder's messages.
 *
 * The fake REST store hands out live instances and `sample-message` marks a
 * message read by mutating the one it resolved (the idiom the angularjs and
 * angular sample apps use), so a list holding those instances cannot tell
 * "same array, mutated row" from "nothing happened". A snapshot is a new array
 * of new frozen rows every time, which makes Lit's default `!==` gate correct.
 */
export const snapshot = (rows: readonly Message[]): readonly Message[] =>
  Object.freeze(structuredClone(rows).map((row) => Object.freeze(row)));
