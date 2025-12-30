/**
 * Shared test utilities - no DB dependency.
 * Each matrix adapter imports this and adds project-specific DB/factories.
 */
import { expect } from 'vitest';

// ==================== UNIQUE ID GENERATION ====================
let emailCounter = 0;

export function resetCounter() {
  emailCounter = 0;
}

export function uniqueEmail(): string {
  emailCounter++;
  return `test${emailCounter}_${Date.now()}@test.com`;
}

// ==================== ASSERTIONS ====================
export function assertRecordCreated(
  record: { id: number; [key: string]: any } | null,
  expected: Record<string, any>
) {
  expect(record).not.toBeNull();
  expect(record).toHaveProperty('id');
  for (const [key, value] of Object.entries(expected)) {
    expect(record![key]).toEqual(value);
  }
}

export function assertArrayLength<T>(arr: T[], length: number) {
  expect(arr).toHaveLength(length);
}

export function assertSameRecord(
  record1: { id: number } | null,
  record2: { id: number } | null
) {
  expect(record1).not.toBeNull();
  expect(record2).not.toBeNull();
  expect(record1!.id).toBe(record2!.id);
}
