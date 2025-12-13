import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { generateQueries } from '../src/cli/generate-queries';

describe('generateQueries', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-flare-test-'));
    
    // Create necessary structure
    fs.mkdirSync(path.join(tempDir, 'prisma'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test-project' }));
    
    // Mock process.cwd to return tempDir
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should generate query classes based on schema.prisma', () => {
    const schemaContent = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
}

model Post {
  id        Int     @id @default(autoincrement())
  title     String
  content   String?
  published Boolean @default(false)
  authorId  Int
  author    User    @relation(fields: [authorId], references: [id])
}
`;
    fs.writeFileSync(path.join(tempDir, 'prisma', 'schema.prisma'), schemaContent);

    generateQueries();

    const queriesDir = path.join(tempDir, 'src/queries');
    expect(fs.existsSync(queriesDir)).toBe(true);
    expect(fs.existsSync(path.join(queriesDir, 'UserQuery.ts'))).toBe(true);
    expect(fs.existsSync(path.join(queriesDir, 'PostQuery.ts'))).toBe(true);
    expect(fs.existsSync(path.join(queriesDir, 'index.ts'))).toBe(true);

    const userQueryContent = fs.readFileSync(path.join(queriesDir, 'UserQuery.ts'), 'utf-8');
    expect(userQueryContent).toContain("import { QueryBuilder } from 'prisma-flare';");
    expect(userQueryContent).toContain("export default class UserQuery extends QueryBuilder<'user'> {");
    
    const indexContent = fs.readFileSync(path.join(queriesDir, 'index.ts'), 'utf-8');
    expect(indexContent).toContain("import UserQuery from './UserQuery';");
    expect(indexContent).toContain("static get user() {");
  });

  it('should respect prisma-flare.config.json', () => {
     const schemaContent = `
model TestModel {
  id Int @id
}
`;
    fs.writeFileSync(path.join(tempDir, 'prisma', 'schema.prisma'), schemaContent);
    
    const config = {
      queriesPath: 'lib/generated/queries',
      dbPath: 'src/database'
    };
    fs.writeFileSync(path.join(tempDir, 'prisma-flare.config.json'), JSON.stringify(config));

    generateQueries();

    const queriesDir = path.join(tempDir, 'lib/generated/queries');
    expect(fs.existsSync(queriesDir)).toBe(true);
    expect(fs.existsSync(path.join(queriesDir, 'TestModelQuery.ts'))).toBe(true);
    
    const queryContent = fs.readFileSync(path.join(queriesDir, 'TestModelQuery.ts'), 'utf-8');
    // Check relative path to db
    // queriesDir is lib/generated/queries (depth 3)
    // dbPath is src/database (depth 2)
    // relative path should be ../../../src/database
    expect(queryContent).toContain("import { db } from '../../../src/database';");
  });
});
