import { describe, expect, test } from 'vitest';
import { planProject } from './plan';

describe('planProject', () => {
  test('title, contents, then a title page in front of every notebook', () => {
    expect(planProject([3, 2])).toEqual({ contentsSheets: 1, starts: [2, 6], total: 9 });
  });

  test('a long contents pushes every notebook back', () => {
    const plan = planProject([1, 1, 1], 2);
    expect(plan.contentsSheets).toBe(2);
    expect(plan.starts).toEqual([3, 5, 7]);
    expect(plan.total).toBe(9);
  });

  test('an empty project is still a title and a contents sheet', () => {
    expect(planProject([])).toEqual({ contentsSheets: 1, starts: [], total: 2 });
  });

  test('one notebook opens right after the contents', () => {
    expect(planProject([4]).starts).toEqual([2]);
  });
});
