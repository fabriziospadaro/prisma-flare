import UserQuery from './UserQuery';
import PostQuery from './PostQuery';

export default class Query {
  static get user() {
    return new UserQuery();
  }

  static get post() {
    return new PostQuery();
  }
}
