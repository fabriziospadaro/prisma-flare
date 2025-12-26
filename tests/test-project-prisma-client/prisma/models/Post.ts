import { db } from '../db';
import { FlareBuilder } from '.prisma-flare';

export default class Post extends FlareBuilder<'post'> {
  constructor() {
    super(db.post);
  }
}
