# FlareBuilder API Reference

Complete API documentation for prisma-flare's query builder.

## Query Building Methods

These methods build and customize your query before execution.

### `where(condition)`
Adds a WHERE condition to the query with full type safety from Prisma.

```typescript
// Single condition
const users = await DB.users.where({ isActive: true }).findMany();

// Multiple conditions (merged together)
const users = await DB.users
  .where({ isActive: true })
  .where({ role: 'ADMIN' })
  .findMany();

// Complex conditions with operators
const users = await DB.users.where({
  email: { contains: 'example.com' },
  age: { gte: 18 }
}).findMany();
```

### `andWhere(condition)`
Explicit alias for `where()` with AND logic. Useful for code readability.

```typescript
const users = await DB.users
  .where({ status: 'active' })
  .andWhere({ role: 'admin' })
  .findMany();
```

### Boolean Logic (AND/OR/NOT)

Prisma Flare provides explicit control over boolean logic.

#### How `where()` chaining works

Multiple `where()` calls are composed using **AND** logic:

```typescript
// These are equivalent:
DB.users.where({ status: 'active' }).where({ role: 'admin' })
// → { AND: [{ status: 'active' }, { role: 'admin' }] }
```

#### `orWhere(condition)`

`orWhere()` wraps the **entire accumulated where** in an OR:

```typescript
DB.users.where({ status: 'active' }).orWhere({ role: 'admin' })
// → { OR: [{ status: 'active' }, { role: 'admin' }] }
```

**Common Mistake:** Adding more conditions after `orWhere` can produce unexpected results:

```typescript
// ❌ WRONG: User thinks "active users named Alice or Bob"
const wrong = await DB.users
  .where({ status: 'active' })
  .where({ name: 'Alice' })
  .orWhere({ name: 'Bob' })  // This OR-wraps EVERYTHING before it!
  .findMany();
// Actual: (status='active' AND name='Alice') OR (name='Bob')

// ✅ CORRECT: Use whereGroup for explicit grouping
const correct = await DB.users
  .where({ status: 'active' })
  .whereGroup(qb => qb
    .where({ name: 'Alice' })
    .orWhere({ name: 'Bob' })
  )
  .findMany();
// Result: status='active' AND (name='Alice' OR name='Bob')
```

#### `whereGroup(callback)` - Recommended for complex logic

Creates an explicit group that's AND-ed with the existing where:

```typescript
// (status = 'active') AND (role = 'admin' OR role = 'moderator')
const users = await DB.users
  .where({ status: 'active' })
  .whereGroup(qb => qb
    .where({ role: 'admin' })
    .orWhere({ role: 'moderator' })
  )
  .findMany();
```

#### `orWhereGroup(callback)`

Creates an explicit group that's OR-ed with the existing where:

```typescript
// (status = 'active') OR (role = 'admin' AND verified = true)
const users = await DB.users
  .where({ status: 'active' })
  .orWhereGroup(qb => qb
    .where({ role: 'admin' })
    .where({ verified: true })
  )
  .findMany();
```

#### NOT conditions

Use Prisma's `NOT` operator inside `where()`:

```typescript
const users = await DB.users
  .where({ status: 'active' })
  .where({ NOT: { role: 'banned' } })
  .findMany();
```

#### Quick Reference

| Pattern | Result |
|---------|--------|
| `.where(A).where(B)` | `A AND B` |
| `.where(A).orWhere(B)` | `A OR B` |
| `.where(A).orWhere(B).where(C)` | `(A OR B) AND C` |
| `.where(A).whereGroup(q => q.where(B).orWhere(C))` | `A AND (B OR C)` |
| `.where(A).orWhereGroup(q => q.where(B).where(C))` | `A OR (B AND C)` |

### `withId(id)`
Filters records by ID. Throws an error if no ID is provided.

```typescript
const user = await DB.users.withId(123).findFirst();
const post = await DB.posts.withId('uuid-string').findUnique();
```

### `select(fields)`
Selects specific fields to retrieve.

```typescript
const users = await DB.users
  .select({ id: true, name: true, email: true })
  .findMany();
```

### `include(relation)` or `include(relation, callback)`
Includes related records in the query.

```typescript
// Include all default fields from the relation
const posts = await DB.posts.include('author').findMany();

// Include with custom query on the relation
const posts = await DB.posts
  .include('author', (q) => q.select({ id: true, name: true }))
  .findMany();

// Multiple includes
const posts = await DB.posts
  .include('author')
  .include('comments', (q) => q.limit(5))
  .findMany();

// Nested includes
const posts = await DB.posts
  .include('author', (q) => q.include('profile'))
  .findMany();
```

### `order(orderBy)`
Adds ordering to the query results.

```typescript
const users = await DB.users.order({ createdAt: 'asc' }).findMany();
const posts = await DB.posts.order({ published: 'desc' }).findMany();
```

### `first(key?)` and `last(key?)`
Convenience methods to get the first or last record.

```typescript
const first = await DB.users.first().findFirst();
const latest = await DB.posts.last('publishedAt').findFirst();
```

### `limit(n)` and `skip(n)`
Limits and offsets the results.

```typescript
const page = await DB.users.skip(20).limit(10).findMany();
```

### `distinct(fields)`
Returns only distinct records. Takes an array of field names.

```typescript
const distinctEmails = await DB.users
  .distinct(['email'])
  .select({ email: true })
  .findMany();
```

### `groupBy(fields)` and `having(condition)`
Groups results and filters aggregates. Takes an array of field names.

```typescript
const postCounts = await DB.posts
  .groupBy(['authorId'])
  .having({ authorId: { _count: { gt: 5 } } })
  .findMany();
```

### `getQuery()`
Returns the current internal query object (useful for debugging).

```typescript
const query = DB.users.where({ active: true }).getQuery();
console.log(query);
// Output: { where: { active: true } }
```

---

## Execution Methods

These methods execute the query and return results.

### `findMany()`
Returns all records matching the query conditions.

```typescript
const allUsers = await DB.users.findMany();
const activeUsers = await DB.users.where({ isActive: true }).findMany();
```

### `findFirst()` / `findFirstOrThrow()`
Returns the first record matching the query.

```typescript
const user = await DB.users.where({ email: 'user@example.com' }).findFirst();
const user = await DB.users.where({ email: 'admin@example.com' }).findFirstOrThrow();
```

### `findUnique()` / `findUniqueOrThrow()`
Finds a record by a unique constraint.

```typescript
const user = await DB.users.withId(123).findUnique();
const user = await DB.users.withId(123).findUniqueOrThrow();
```

### `create(data)` / `createMany(data)`
Creates records.

```typescript
const newUser = await DB.users.create({
  email: 'new@example.com',
  name: 'New User'
});

const result = await DB.posts.createMany([
  { title: 'Post 1', authorId: 1 },
  { title: 'Post 2', authorId: 1 }
]);
```

### `update(data)` / `updateMany(data)`
Updates records.

```typescript
const updated = await DB.users.withId(123).update({ name: 'Updated Name' });

const result = await DB.users
  .where({ status: 'inactive' })
  .updateMany({ lastLogin: new Date() });
```

### `delete()` / `deleteMany()`
Deletes records.

```typescript
const deleted = await DB.posts.withId(123).delete();

const result = await DB.posts
  .where({ published: false })
  .deleteMany();
```

### `upsert(args)`
Updates a record if it exists, otherwise creates a new one.

```typescript
const result = await DB.users
  .where({ email: 'user@example.com' })
  .upsert({
    create: { email: 'user@example.com', name: 'New User' },
    update: { lastLogin: new Date() }
  });
```

---

## Aggregation Methods

### `count()`
Counts records matching the current query.

```typescript
const totalUsers = await DB.users.count();
const activeCount = await DB.users.where({ isActive: true }).count();
```

### `sum(field)` / `avg(field)` / `min(field)` / `max(field)`
Performs aggregation on numeric fields.

```typescript
const totalSales = await DB.orders.where({ status: 'completed' }).sum('amount');
const avgPrice = await DB.products.avg('price');
const oldest = await DB.users.min('createdAt');
const latest = await DB.posts.max('publishedAt');
```

### `aggregate(args)`
Performs multiple aggregations in a single query.

```typescript
const result = await DB.orders
  .where({ status: 'completed' })
  .aggregate({
    _sum: { amount: true },
    _avg: { amount: true },
    _count: true,
  });

console.log(result._sum.amount);   // Total amount
console.log(result._avg.amount);   // Average amount
console.log(result._count);        // Number of orders
```

---

## Utility Methods

### `only(field)`
Returns a specific field value from the first matching record.

```typescript
const email = await DB.users.withId(123).only('email');
// Returns: 'user@example.com' or null
```

### `pluck(field)`
Extracts a specific field from all matching records as an array.

```typescript
const emails = await DB.users.where({ isActive: true }).pluck('email');
// Returns: ['user1@example.com', 'user2@example.com', ...]
```

### `exists(key?)`
Checks if any record exists matching the current query.

```typescript
const hasAdmins = await DB.users.where({ role: 'ADMIN' }).exists();
```

### `paginate(page, perPage)`
Returns paginated results with metadata.

```typescript
const result = await DB.users.where({ isActive: true }).paginate(1, 15);

console.log(result.data);  // Array of users
console.log(result.meta);  // { total, lastPage, currentPage, perPage, prev, next }
```

### `when(condition, callback)`
Conditionally applies query operations.

```typescript
const search = req.query.search;
const users = await DB.users
  .when(!!search, (q) => q.where({ name: { contains: search } }))
  .findMany();
```

### `chunk(size, callback)`
Processes large datasets in chunks.

```typescript
await DB.posts.chunk(100, async (posts) => {
  for (const post of posts) {
    await processPost(post);
  }
});
```

### `clone()`
Creates an independent copy of the current query builder. The copy keeps the
original's class, so custom model scopes remain available on it.

```typescript
const baseQuery = DB.posts.where({ published: true });
const recent = baseQuery.clone().order({ createdAt: 'desc' }).findMany();
const popular = baseQuery.clone().order({ likes: 'desc' }).findMany();
```

### `defer(resolver)` / `defer(field, resolver)`
Queues async work to run right before the query executes. This keeps a scope
backed by raw SQL (or any other `await`) synchronously chainable, so callers
never see a promise in the middle of a chain.

**Field shorthand.** Pass a field name and the resolved rows are plucked and
filtered for you, which covers the common "raw SQL returns ids" case:

```typescript
class User extends FlareBuilder<'user'> {
  constructor() { super(db.user); }

  active() { return this.where({ status: 'active' }); }

  // Prisma has no random ordering, so drop to SQL without breaking the chain
  random(n = 1) {
    return this.defer('id', () => db.$queryRaw`
      SELECT id FROM "User" ORDER BY RANDOM() LIMIT ${n}`);
  }
}
```

```typescript
// Reads like any other scope, in any order
const picked = await DB.users.random(4).active().order({ name: 'asc' }).findMany();
```

Rows may be objects containing the field, or the bare values themselves, so
`[{ id: 1 }]` and `[1]` both work.

**Filter form.** Return a where filter and it gets merged into the query:

```typescript
recentlyActive(days: number) {
  return this.defer(async () => {
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT "userId" AS id FROM "Session"
      WHERE "createdAt" > NOW() - ${days} * INTERVAL '1 day'`;
    return { id: { in: rows.map((r) => r.id) } };
  });
}
```

**Generic form.** Return nothing and refine the builder directly. A resolver can
set anything a scope can, not just filters:

```typescript
costliestFirst(n: number) {
  return this.defer(async (qb) => {
    const rows = await db.$queryRaw<{ id: string }[]>`...`;
    qb.where({ id: { in: rows.map((r) => r.id) } }).order({ total: 'desc' }).limit(n);
  });
}
```

**Semantics**

- Resolvers run in registration order, immediately before the query executes.
- Every terminal method resolves pending work, including `paginate`, `chunk`,
  `pluck`, `only`, `exists`, the aggregates, and the write methods.
- Because resolvers run at execution time, they observe conditions added after
  `defer()` was called, and `select`/`include` result typing is unaffected.
- Each resolver runs at most once per builder. Repeated or concurrent terminals
  on the same builder await one shared resolution instead of re-issuing the SQL.
- A failed resolver stays failed: the rejection is replayed to later terminals
  rather than silently retrying the query.
- `clone()` copies unresolved work, and each clone resolves against its own
  query, so branching a deferred base query is safe.
- A resolver must not run a terminal on the builder it is resolving. That query
  is still being assembled, so it throws with a descriptive error instead of
  deadlocking. Use a separate builder or the raw client inside a resolver.
- Deferred scopes work inside `include()` callbacks. The relation's query is
  settled before the parent query runs, so a deferred relation filter applies
  as written.
- `null` and `undefined` values are dropped from the field shorthand's `in`
  filter, since SQL `IN` never matches NULL. A NULL from an outer join or a
  nullable foreign key therefore narrows the set rather than erroring. To match
  null rows, write the filter yourself with the filter form.
- `getQuery()` reflects deferred work only after a terminal has run, because
  resolvers execute at query time.

**Type safety**

The field form is checked at compile time. If your resolver returns typed rows,
TypeScript rejects a field that doesn't exist on the model, rows whose columns
don't include that field, and values of the wrong type:

```typescript
DB.users.defer('nope', async () => []);              // error: no such field
DB.users.defer('id', async () => [{ email: 'a@b' }]) // error: rows have no 'id'
DB.users.defer('id', async () => ['not-a-number']);  // error: id is a number
```

`$queryRaw` returns `any` unless you annotate it, so annotate the row type and
the compiler does the work:

```typescript
this.defer('authorId', () =>
  db.$queryRaw<{ authorId: number }[]>`SELECT "authorId" FROM "Post"`);
```

A single-column row is accepted under any alias, since there's no ambiguity
about which value was meant. For unannotated multi-column rows the mismatch
surfaces at runtime with a message naming the columns it did find.

**Beyond raw SQL**

Nothing about `defer()` is SQL-specific. It resolves any async source of query
constraints:

```typescript
// Search engine or vector store returning ids
matching(term: string) {
  return this.defer('id', () => searchIndex.query(term));
}

// Feature flag deciding a filter, no database involved
visible() {
  return this.defer(async () =>
    (await flags.enabled('drafts')) ? {} : { published: true });
}

// Cached id set, so repeat calls skip the work
cachedHot() {
  return this.defer('id', () => cache.getOrCompute('hot', fetchHotIds));
}

// Permission service deciding what this viewer may see
visibleTo(viewerId: string) {
  return this.defer('workspaceId', () => acl.workspacesFor(viewerId));
}
```

Common SQL shapes that become named scopes:

```typescript
// Recursive CTE: everyone under a manager
underManager(id: string) {
  return this.defer('authorId', () => db.$queryRaw<{ authorId: string }[]>`
    WITH RECURSIVE subtree AS (
      SELECT id FROM "User" WHERE "managerId" = ${id}
      UNION ALL
      SELECT u.id FROM "User" u JOIN subtree s ON u."managerId" = s.id
    ) SELECT id AS "authorId" FROM subtree`);
}

// Window function: top row per group
topPerAuthor() {
  return this.defer('id', () => db.$queryRaw<{ id: string }[]>`
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY "authorId" ORDER BY likes DESC) rn
      FROM "Post"
    ) t WHERE rn = 1`);
}

// Aggregate threshold that Prisma's where cannot express
fromProlificAuthors(min: number) {
  return this.defer('authorId', () => db.$queryRaw<{ authorId: string }[]>`
    SELECT "authorId" FROM "Post" GROUP BY "authorId" HAVING COUNT(*) >= ${min}`);
}
```
