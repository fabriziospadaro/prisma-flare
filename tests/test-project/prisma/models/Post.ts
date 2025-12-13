import { db } from '../db';
import { QueryBuilder } from 'prisma-flare';

export default class Post extends QueryBuilder<'post'> {
  constructor() {
    super(db.post);
  }

  published() {
    this.query.where = { ...this.query.where, published: true };
    return this;
  }

  recent(count: number) {
    this.query.orderBy = { createdAt: 'desc' };
    this.query.take = count;
    return this;
  }

  withTitle(title: string) {
    this.query.where = { ...this.query.where, title: { contains: title } };
    return this;
  }

  drafts() {
    this.query.where = { ...this.query.where, published: false };
    return this;
  }

  withAuthorId(authorId: number) {
    this.query.where = { ...this.query.where, authorId };
    return this;
  }
}
