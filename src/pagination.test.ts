import {
  describe,
  expect,
  it
} from 'vitest';

import {
  clampPage,
  getPageCount,
  getPageItems,
  getVisiblePageNumbers,
  parsePageSizes
} from './pagination.ts';

describe('getPageCount', () => {
  it('rounds up', () => {
    expect(getPageCount(101, 50)).toBe(3);
  });

  it('gives an empty list one page', () => {
    expect(getPageCount(0, 50)).toBe(1);
  });
});

describe('clampPage', () => {
  it('moves a page past the end back to the last page', () => {
    expect(clampPage(9, 3)).toBe(3);
  });

  it('moves a page before the start to the first page', () => {
    expect(clampPage(0, 3)).toBe(1);
  });
});

describe('getPageItems', () => {
  it('returns the items of the requested page', () => {
    expect(getPageItems([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
  });
});

describe('getVisiblePageNumbers', () => {
  it('shows two pages each side of the current page', () => {
    expect(getVisiblePageNumbers(5, 9)).toEqual([3, 4, 5, 6, 7]);
  });

  it('stops at the ends', () => {
    expect(getVisiblePageNumbers(1, 2)).toEqual([1, 2]);
  });
});

describe('parsePageSizes', () => {
  it('reads comma-separated numbers and drops invalid and repeated ones', () => {
    expect(parsePageSizes('25, x, 50,-1, 25, 1.5')).toEqual([25, 50]);
  });
});
