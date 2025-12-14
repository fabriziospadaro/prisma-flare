#!/usr/bin/env node
import { generateQueries } from './generate-queries';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Handle both ESM and CJS environments
const getDirname = () => {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return __dirname;
  }
};

const __dirname_ = getDirname();

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.log('Usage: prisma-flare <command>');
  console.log('Commands:');
  console.log('  generate    Generate query classes based on schema.prisma');
  console.log('  create      Create the database');
  console.log('  drop        Drop the database');
  console.log('  migrate     Migrate the database');
  console.log('  reset       Reset the database');
  console.log('  seed        Seed the database');
  process.exit(1);
}

switch (command) {
  case 'generate':
    generateQueries();
    break;
  case 'create':
  case 'drop':
  case 'migrate':
  case 'reset':
  case 'seed':
    runScript(command);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}

function runScript(scriptName: string) {
  // Map command to file
  const scriptMap: Record<string, string> = {
    'create': 'db-create.ts',
    'drop': 'db-drop.ts',
    'migrate': 'db-migrate.ts',
    'reset': 'db-reset.ts',
    'seed': 'db-seed.ts',
  };

  const file = scriptMap[scriptName];
  if (!file) {
    console.error(`No script found for ${scriptName}`);
    return;
  }

  let scriptPath = path.join(__dirname_, file.replace('.ts', '.js'));

  if (!fs.existsSync(scriptPath)) {
    const cliScriptPath = path.join(__dirname_, 'cli', file.replace('.ts', '.js'));
    if (fs.existsSync(cliScriptPath)) {
      scriptPath = cliScriptPath;
    }
  }

  const child = spawn('node', [scriptPath], { stdio: 'inherit' });

  child.on('close', (code) => {
    process.exit(code || 0);
  });
}
