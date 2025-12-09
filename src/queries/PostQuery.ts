import { db } from '../core/db';
import QueryBuilder from '../core/queryBuilder';

export default class PostQuery extends QueryBuilder<'post'> {
  constructor() {
    super(db.post);
  }

  published(): this {
    this.where({ published: true });
    return this;
  }

  drafts(): this {
    this.where({ published: false });
    return this;
  }

  withTitle(title: string): this {
    this.where({ title: { contains: title } });
    return this;
  }

  withAuthorId(authorId: number): this {
    this.where({ authorId });
    return this;
  }

  recent(days: number): this {
    const date = new Date();
    date.setDate(date.getDate() - days);
    this.where({ createdAt: { gte: date } });
    return this;
  }
}
