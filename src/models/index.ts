import { db } from '../core/db';
import User from './User';
import Post from './Post';

export default class DB {
  static get instance() {
    return db;
  }

  static get users() {
    return new User();
  }

  static get posts() {
    return new Post();
  }
}
