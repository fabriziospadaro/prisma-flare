import { db } from '../db.js';
import { FlareBuilder } from 'prisma-flare';

export default class User extends FlareBuilder<'user'> {
  constructor() {
    super(db.user);
  }

  withName(name: string) {
    this.query.where = { ...this.query.where, name: { contains: name } };
    return this;
  }

  withEmail(email: string) {
    this.query.where = { ...this.query.where, email };
    return this;
  }

  createdAfter(date: Date) {
    this.query.where = { ...this.query.where, createdAt: { gt: date } };
    return this;
  }
}
