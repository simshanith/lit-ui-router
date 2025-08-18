import { describe, it, expect } from 'vitest';
import {
  spreadToSubPaths,
  mergeSrefStatus,
} from '../directives/ui-sref-active.js';

describe('ui-sref-active', () => {
  it('should be true', () => {
    expect(true).toBe(true);
  });

  describe('spreadToSubPaths', () => {
    it('should return the correct subpaths', () => {
      expect(spreadToSubPaths([], [])).toEqual([]);
    });
  });

  describe('mergeSrefStatus', () => {
    it('should return the merged status', () => {
      expect(
        mergeSrefStatus(
          {
            active: false,
            exact: false,
            entering: false,
            exiting: false,
            targetStates: [],
          },
          {
            active: false,
            exact: false,
            entering: false,
            exiting: false,
            targetStates: [],
          },
        ),
      ).toEqual({
        active: false,
        exact: false,
        entering: false,
        exiting: false,
        targetStates: [],
      });
    });
  });
});
