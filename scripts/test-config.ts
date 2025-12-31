/**
 * Shared configuration for test scripts.
 */

import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, '..');
export const TESTS_DIR = path.join(ROOT_DIR, 'tests');

export interface ProjectConfig {
  folder: string;
  needsDbPush: boolean;
}

export const TEST_PROJECTS = {
  suite: { folder: 'suite', needsDbPush: false },
  default: { folder: 'default-client', needsDbPush: false },
  custom: { folder: 'custom-output', needsDbPush: true },
  new: { folder: 'new-provider', needsDbPush: true },
  prisma6: { folder: 'prisma-6', needsDbPush: true },
} as const;

export type ProjectKey = keyof typeof TEST_PROJECTS;

/** Projects that run tests (excludes suite which is types-only) */
export const RUNNABLE_PROJECTS: ProjectKey[] = ['default', 'custom', 'new', 'prisma6'];

/** Projects that need setup (excludes suite) */
export const SETUP_PROJECTS: ProjectKey[] = ['default', 'custom', 'new', 'prisma6'];

/** All projects for type checking */
export const ALL_PROJECTS: ProjectKey[] = ['suite', 'default', 'custom', 'new', 'prisma6'];

export function getProjectDir(key: ProjectKey): string {
  return path.join(TESTS_DIR, TEST_PROJECTS[key].folder);
}

export function parseProjectArg(validKeys: ProjectKey[]): ProjectKey | 'all' {
  const arg = process.argv[2] as ProjectKey;
  if (validKeys.includes(arg)) return arg;
  return 'all';
}
