import { db } from '../db';
import { FlareBuilder } from '.prisma-flare';

export default class User extends FlareBuilder<'user'> {
  constructor() {
    super(db.user);
  }
}
