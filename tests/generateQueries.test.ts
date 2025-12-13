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

    // Mock node_modules/prisma-flare/dist
    const pfDistDir = path.join(tempDir, 'node_modules', 'prisma-flare', 'dist');
    fs.mkdirSync(pfDistDir, { recursive: true });
    fs.writeFileSync(path.join(pfDistDir, 'index.js'), "export const version = '1.0.0';\n");
    fs.writeFileSync(path.join(pfDistDir, 'index.cjs'), "exports.version = '1.0.0';\n");
    fs.writeFileSync(path.join(pfDistDir, 'index.d.ts'), "export declare const version: string;\n");
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

    const queriesDir = path.join(tempDir, 'src/models');
    expect(fs.existsSync(queriesDir)).toBe(true);
    expect(fs.existsSync(path.join(queriesDir, 'User.ts'))).toBe(true);
    expect(fs.existsSync(path.join(queriesDir, 'Post.ts'))).toBe(true);
    
    const userQueryContent = fs.readFileSync(path.join(queriesDir, 'User.ts'), 'utf-8');
    expect(userQueryContent).toContain("import { QueryBuilder } from 'prisma-flare';");
    expect(userQueryContent).toContain("export default class User extends QueryBuilder<'user'> {");
    
    // Check injection in node_modules/prisma-flare/dist/index.js
    const indexJsPath = path.join(tempDir, 'node_modules/prisma-flare/dist/index.js');
    const indexContent = fs.readFileSync(indexJsPath, 'utf-8');
    
    // Check relative import from node_modules/prisma-flare/dist to src/models
    // node_modules/prisma-flare/dist -> ../../../src/models/User
    expect(indexContent).toContain("import User from '../../../src/models/User';");
    expect(indexContent).toContain("export class DB {");
    expect(indexContent).toContain("static get instance() {");
    expect(indexContent).toContain("return db;");
    expect(indexContent).toContain("static get users() {");
  });

  it('should respect prisma-flare.config.json', () => {
     const schemaContent = `
model TestModel {
  id Int @id
}
`;
    fs.writeFileSync(path.join(tempDir, 'prisma', 'schema.prisma'), schemaContent);
    
    const config = {
      modelsPath: 'lib/generated/queries',
      dbPath: 'src/database'
    };
    fs.writeFileSync(path.join(tempDir, 'prisma-flare.config.json'), JSON.stringify(config));

    generateQueries();

    const queriesDir = path.join(tempDir, 'lib/generated/queries');
    expect(fs.existsSync(queriesDir)).toBe(true);
    expect(fs.existsSync(path.join(queriesDir, 'TestModel.ts'))).toBe(true);
    
    const queryContent = fs.readFileSync(path.join(queriesDir, 'TestModel.ts'), 'utf-8');
    // Check relative path to db
    // queriesDir is lib/generated/queries (depth 3)
    // dbPath is src/database (depth 2)
    // relative path should be ../../../src/database
    expect(queryContent).toContain("import { db } from '../../../src/database';");
  });

  it('should support custom plurals from config', () => {
    const schemaContent = `
model Person {
 id Int @id
}
`;
   fs.writeFileSync(path.join(tempDir, 'prisma', 'schema.prisma'), schemaContent);
   
   const config = {
     modelsPath: 'src/models',
     dbPath: 'src/db',
     plurals: {
       Person: 'people'
     }
   };
   fs.writeFileSync(path.join(tempDir, 'prisma-flare.config.json'), JSON.stringify(config));

   generateQueries();

   // Check injection in node_modules/prisma-flare/dist/index.js
   const indexJsPath = path.join(tempDir, 'node_modules/prisma-flare/dist/index.js');
   const indexContent = fs.readFileSync(indexJsPath, 'utf-8');
   
   expect(indexContent).toContain("static get people() {");
   expect(indexContent).not.toContain("static get persons() {");
 });
});
