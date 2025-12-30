import { db } from '../db';
import { FlareBuilder } from 'prisma-flare/client';

export default class User extends FlareBuilder<'user'> {
  constructor() {
    super(db.user);
  }
}
