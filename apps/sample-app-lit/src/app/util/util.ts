/** Some utility functions used by the application */

export const setProp = <T extends object, K extends keyof T>(
  obj: T,
  key: K,
  val: T[K],
): T => {
  obj[key] = val;
  return obj;
};
export const pushToArr = <T>(array: T[], item: T): T[] => {
  array.push(item);
  return array;
};
export const uniqReduce = <T>(arr: T[], item: T): T[] =>
  arr.indexOf(item) !== -1 ? arr : pushToArr(arr, item);
export const flattenReduce = <T>(arr: T[], item: T | T[]): T[] =>
  arr.concat(item);
const guidChar = (c: string): string =>
  c !== 'x' && c !== 'y'
    ? '-'
    : Math.floor(Math.random() * 16)
        .toString(16)
        .toUpperCase();
export const guid = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.split('').map(guidChar).join('');
