# Quick Start Guide

## Installation

```bash
npm install prismaroids @prisma/client
npx prisma init
```

## Setup Your Schema

Edit `prisma/schema.prisma` with your models:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Generate Prisma Client

```bash
npx prisma migrate dev --name init
npx prisma generate
```

## Basic Usage

Create a file `app.js`:

```javascript
import { db } from 'prismaroids';

async function main() {
  // Create a user
  const user = await db.query('user').create({
    data: {
      email: 'john@example.com',
      name: 'John Doe'
    }
  });

  console.log('Created user:', user);

  // Use query builder
  const users = await db.query('user')
    .where({ name: { contains: 'John' } })
    .order({ createdAt: 'desc' })
    .findMany();

  console.log('Found users:', users);

  // Create a post
  const post = await db.query('post').create({
    data: {
      title: 'My First Post',
      content: 'Hello World!',
      authorId: user.id
    }
  });

  console.log('Created post:', post);
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
  });
```

## Adding Callbacks

Create a file `callbacks.js`:

```javascript
import { afterCreate, afterChange } from 'prismaroids';

// Hook into user creation
afterCreate('User', async (args, result) => {
  console.log(`New user created: ${result.email}`);
  // Send welcome email, etc.
});

// Track email changes
afterChange('User', 'email', async (oldValue, newValue, record) => {
  console.log(`User ${record.id} changed email from ${oldValue} to ${newValue}`);
  // Send verification email
});

// Track post publication
afterChange('Post', 'published', async (oldValue, newValue, record) => {
  if (!oldValue && newValue) {
    console.log(`Post "${record.title}" was published!`);
    // Notify subscribers, index in search, etc.
  }
});
```

Then import it in your main file:

```javascript
import './callbacks.js';
import { db } from 'prismaroids';

// Rest of your code...
```

## Custom Query Classes

Create domain-specific query methods:

```javascript
import QueryBuilder from 'prismaroids/queryBuilder';
import { db } from 'prismaroids';

class PostQueries extends QueryBuilder {
  constructor() {
    super(db.post);
  }

  published() {
    return this.where({ published: true });
  }

  recent(days = 7) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return this.where({ createdAt: { gte: date } });
  }
}

// Usage
const recentPosts = await new PostQueries()
  .published()
  .recent(7)
  .order({ createdAt: 'desc' })
  .limit(10)
  .findMany();
```

## Next Steps

- Check the `examples/` directory for more usage patterns
- Read the full README.md for complete API documentation
- Customize your callbacks for your specific business logic
- Create custom query classes for domain-specific operations

## Common Patterns

### Soft Deletes

```javascript
import { beforeDelete } from 'prismaroids';

beforeDelete('User', async (args) => {
  // Prevent actual deletion, mark as deleted instead
  throw new Error('Use soft delete');
});

// Implement soft delete
async function softDeleteUser(id) {
  return db.query('user').update({
    where: { id },
    data: { deletedAt: new Date() }
  });
}
```

### Audit Logs

```javascript
import { afterCreate, afterUpdate, afterDelete } from 'prismaroids';

const logAction = async (model, action, data) => {
  await db.query('auditLog').create({
    data: {
      model,
      action,
      data: JSON.stringify(data),
      timestamp: new Date()
    }
  });
};

afterCreate('User', async (args, result) => {
  await logAction('User', 'CREATE', result);
});

afterUpdate('User', async (args, result) => {
  await logAction('User', 'UPDATE', result);
});
```

### Validation

```javascript
import { beforeCreate, beforeUpdate } from 'prismaroids';

beforeCreate('User', async (args) => {
  if (!args.data.email.includes('@')) {
    throw new Error('Invalid email format');
  }
});
```

Enjoy using Prismaroids! 🚀
