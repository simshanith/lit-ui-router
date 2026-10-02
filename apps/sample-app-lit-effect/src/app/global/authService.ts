import { Data, Effect, Either } from 'effect';

import { runtime } from '../effect/runtime.js';
import AppConfig from './appConfig.js';

/** The typed failure of {@link AuthService.authenticate}. */
class InvalidCredentials extends Data.TaggedError('InvalidCredentials')<{
  readonly username: string;
}> {}

/**
 * This service emulates an Authentication Service.
 */
class AuthService {
  usernames: string[];

  constructor() {
    this.usernames = [
      'myself@angular.dev',
      'devgal@angular.dev',
      'devguy@angular.dev',
    ];
  }

  isAuthenticated() {
    return !!AppConfig.emailAddress;
  }

  /**
   * Fake authentication function that returns a promise that is either resolved or rejected.
   *
   * Given a username and password, checks that the username matches one of the known
   * usernames (this.usernames), and that the password matches 'password'.
   *
   * Delays 800ms to simulate an async REST API delay.
   */
  authenticate(username: string, password: string) {
    const checkCredentials = Effect.gen(this, function* () {
      yield* Effect.sleep('800 millis');
      const validUsername = this.usernames.includes(username);
      const validPassword = password === 'password';
      if (!validUsername || !validPassword) {
        return yield* new InvalidCredentials({ username });
      }
      return username;
    });

    // Either, not a bare runPromise: the shared Login component reads
    // `error.message`, and a rejected Effect hands back a Cause, not the error.
    return runtime
      .runPromise(Effect.either(checkCredentials))
      .then((result) => {
        if (Either.isLeft(result)) {
          throw new Error('Invalid username or password');
        }
        AppConfig.emailAddress = result.right;
        AppConfig.save();
      });
  }

  /** Logs the current user out */
  logout() {
    AppConfig.emailAddress = undefined;
    AppConfig.save();
  }
}

const instance = new AuthService();
export default instance;
