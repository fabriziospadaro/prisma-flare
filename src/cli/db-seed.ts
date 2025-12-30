#!/usr/bin/env node

import { execSync } from 'child_process';

function seedDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    console.log('🔄 Seeding database...');

    execSync('npx prisma db seed', {
      stdio: 'inherit',
      env: process.env,
    });

    console.log('✓ Database seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
