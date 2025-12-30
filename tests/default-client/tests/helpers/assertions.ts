/**
 * Custom Test Assertions
 * Domain-specific assertions for clearer, more expressive tests
 */

import { expect } from 'vitest';

/**
 * Assert that an array is sorted by a field in the specified direction
 */
export function assertSortedBy<T>(
  items: T[],
  field: keyof T,
  direction: 'asc' | 'desc' = 'asc'
): void {
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1][field];
    const curr = items[i][field];

    if (direction === 'asc') {
      expect(prev <= curr).toBe(true);
    } else {
      expect(prev >= curr).toBe(true);
    }
  }
}

/**
 * Assert that all items in an array match a condition
 */
export function assertAllMatch<T>(
  items: T[],
  predicate: (item: T) => boolean,
  message = 'All items should match the predicate'
): void {
  const allMatch = items.every(predicate);
  expect(allMatch, message).toBe(true);
}

/**
 * Assert that an array contains only unique values for a field
 */
export function assertUniqueBy<T>(items: T[], field: keyof T): void {
  const values = items.map((item) => item[field]);
  const uniqueValues = new Set(values);
  expect(uniqueValues.size).toBe(values.length);
}

/**
 * Assert pagination metadata is correct
 */
export function assertPaginationMeta(
  meta: {
    total: number;
    currentPage: number;
    perPage: number;
    lastPage: number;
    prev: number | null;
    next: number | null;
  },
  expected: {
    total: number;
    currentPage: number;
    perPage: number;
  }
): void {
  expect(meta.total).toBe(expected.total);
  expect(meta.currentPage).toBe(expected.currentPage);
  expect(meta.perPage).toBe(expected.perPage);

  const expectedLastPage = Math.ceil(expected.total / expected.perPage);
  expect(meta.lastPage).toBe(expectedLastPage);

  expect(meta.prev).toBe(expected.currentPage > 1 ? expected.currentPage - 1 : null);
  expect(meta.next).toBe(
    expected.currentPage < expectedLastPage ? expected.currentPage + 1 : null
  );
}

/**
 * Assert that a record has the expected fields (and no extra fields)
 */
export function assertHasOnlyFields<T extends object>(
  record: T,
  expectedFields: (keyof T)[]
): void {
  const actualFields = Object.keys(record) as (keyof T)[];
  expect(actualFields.sort()).toEqual([...expectedFields].sort());
}

/**
 * Assert that a query result contains specific records by ID
 */
export function assertContainsIds<T extends { id: number }>(
  items: T[],
  expectedIds: number[]
): void {
  const actualIds = items.map((item) => item.id);
  expect(actualIds.sort((a, b) => a - b)).toEqual(expectedIds.sort((a, b) => a - b));
}

/**
 * Assert that a record was created within the last N seconds
 */
export function assertRecentlyCreated<T extends { createdAt: Date }>(
  record: T,
  withinSeconds = 5
): void {
  const now = Date.now();
  const createdAt = new Date(record.createdAt).getTime();
  const diff = now - createdAt;
  expect(diff).toBeLessThan(withinSeconds * 1000);
}

/**
 * Assert that a date is after another date
 */
export function assertDateAfter(actual: Date, expected: Date): void {
  expect(new Date(actual).getTime()).toBeGreaterThan(new Date(expected).getTime());
}

/**
 * Assert that a date is before another date
 */
export function assertDateBefore(actual: Date, expected: Date): void {
  expect(new Date(actual).getTime()).toBeLessThan(new Date(expected).getTime());
}

/**
 * Assert that the count result is correct
 */
export function assertCount(actual: number, expected: number): void {
  expect(actual).toBe(expected);
}

/**
 * Assert that an operation was rolled back (no records exist)
 */
export async function assertNoRecords(
  findFn: () => Promise<any[]>
): Promise<void> {
  const results = await findFn();
  expect(results).toHaveLength(0);
}

/**
 * Assert hook was called with expected arguments
 */
export function assertHookCalledWith(
  mockFn: ReturnType<typeof import('vitest').vi.fn>,
  expectedArgs: Record<string, any>
): void {
  expect(mockFn).toHaveBeenCalled();
  const callArgs = mockFn.mock.calls[0][0];
  expect(callArgs).toMatchObject(expectedArgs);
}
