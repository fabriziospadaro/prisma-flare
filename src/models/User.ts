import { db } from '../core/db';
import QueryBuilder from '../core/queryBuilder';

export default class User extends QueryBuilder<'user'> {
  constructor() {
    super(db.user);
  }

  hasName(): this {
    this.where({ name: { not: null } });
    return this;
  }

  withName(name: string): this {
    this.where({ name: { contains: name } });
    return this;
  }

  withEmail(email: string): this {
    this.where({ email });
    return this;
  }

  createdAfter(date: Date): this {
    this.where({ createdAt: { gt: date } });
    return this;
  }
}
