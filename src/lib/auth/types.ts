interface Auth {
  /**
   * Currently logged-in user information or `null` if there is no logged-in user.
   *
   * This value might be `undefined` if we don't know yet if the user is logged
   * in or not. This will happen at the beginning of the application life-cycle
   * while we are checking if the provided token via {@link AuthInitializeConfig.initialTokens}
   * is still valid.
   *
   * Note: once this value transitions from `undefined` into any other value; it will
   * never go-back into being `undefined` again
   */
  currentUser: undefined | null | UserData

  /**
   * Currently logged-in user token information or `null` if there isn't any.
   *
   * This value might be `undefined` if we don't know yet if the user is logged
   * in or not. This will happen at the beginning of the application life-cycle
   * while we are checking if the provided token via {@link AuthInitializeConfig.initialTokens}
   * is still valid.
   *
   * Note: once this value transitions from `undefined` into any other value; it will
   * never go-back into being `undefined` again
   */
  tokens: undefined | null | TokensData

  /**
   * Attempts to log in with the provided credentials. Returns a promise that resolves
   * if the credentials are valid and the user has been successfully authenticated.
   *
   * When the promise resolves; it cause an update on {@link Auth.currentUser}
   * and {@link Auth.tokens}.
   *
   * Internally; this method will call the auth endpoint `POST /v3/auth/login` with
   * the provided email and password to retrieve and store {@link Auth.tokens}. If
   * the auth call is successful, it does an extra call to `GET /v1/users/me`
   * with the received access token to load the {@link Auth.currentUser}
   *
   * @throws {Error} if there is a user already logged in
   * @throws {Error} if credentials are wrong
   */
  login(credentials: { email: string; password: string }): Promise<void>

  /**
   * Logs out the currently logged-in.
   *
   * When the promise resolves; it will cause an update on {@link Auth.currentUser}
   * and {@link Auth.tokens}; setting them to `null`.
   *
   * @throws {Error} if there is no user logged in
   */
  logout(): Promise<void>
}

interface AuthInitializeConfig {
  /**
   * Allows initializing the Auth state with a previously stored set of tokens. This allows
   * persisting a user "session" so the next time they come around they don't need to re-enter
   * their credentials.
   *
   * If `null` or `undefined` is provided here (or a Promise that resolves into any of those);
   * the auth state will be initialized as anonymous (meaning user is not logged in yet).
   */
  initialTokens?: undefined | null | TokensData | Promise<TokensData | undefined | null>

  /**
   * Allows listening for auth state changes; allowing other parts of the application to store it.
   * so it can be later used for re-initializing the auth after a refresh via
   * {@link AuthInitializeConfig.initialTokens}.
   *
   * The token might change during runtime of the application on several scenarios:
   *
   * - When the user logs in; this callback is invoked with a freshly created token-set
   * - When the user logs out; this callback is invoked with `null`
   * - While the user is using the application the access token might expire; causing the
   *   `AuthProvider` to automatically refresh its token-set set using the current
   *   `refreshToken`. That just-refreshed token-set will be passed to this callback.
   */
  onAuthChange?: (tokens: TokensData | null) => void
}

interface UserData {
  /** User Id of the currently logged-in */
  userId: string

  /** Display name for the currently logged in user. */
  name: string

  /** Email for the currently logged in user. */
  email: string
}

interface TokensData {
  /**
   * Token identifying the currently logged-in user; allowing them to do calls
   * to the API that require authorization.
   *
   * This token expires at the date specified by `accessExpiresAt`.
   */
  access: string

  /**
   * Expiration date of the `access` token. Once expired; the `access` token is no
   * longer valid and a new token needs to be issued by requesting it to the API
   * using the `refresh` token.
   *
   * [ISO DateTime](https://en.wikipedia.org/wiki/ISO_8601) format.
   */
  accessExpiresAt: string

  /**
   * Token allowing the currently logged-in user to "extend" it `access` token; by
   * issuing a new one with a new expiration.
   *
   * This token expires at the date specified by `refreshExpiresAt`.
   */
  refresh: string

  /**
   * Expiration date of the `refresh` token. Once expired; the `refresh` token is no
   * longer valid and the user needs to enter their credentials again.
   *
   * [ISO DateTime](https://en.wikipedia.org/wiki/ISO_8601) format.
   */
  refreshExpiresAt: string
}

export { type Auth, type AuthInitializeConfig, type UserData, type TokensData }
