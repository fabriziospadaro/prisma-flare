import { db } from '../db';
import { FlareBuilder } from 'prisma-flare/client';

export default class Post extends FlareBuilder<'post'> {
  constructor() {
    super(db.post);
  }
}
