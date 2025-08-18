import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { UIViewInjectedProps } from '@uirouter/lit';

import AuthService from '../global/authService.js';
import AppConfig from '../global/appConfig.js';

@customElement('sample-login')
export class Login extends LitElement {
  createRenderRoot() {
    return this;
  }

  // TODO: This is not typesafe
  constructor(public _uiViewProps?: UIViewInjectedProps) {
    super();
  }

  usernames = AuthService.usernames;

  @state()
  username = AppConfig.emailAddress || '';

  @state()
  password = 'password';

  @state()
  authenticating = false;

  @state()
  errorMessage = '';

  login = () => {
    const {
      router,
      resolves: { returnTo },
    } = this._uiViewProps;
    const done = () => (this.authenticating = false);
    const showError = (errorMessage: string) =>
      (this.errorMessage = errorMessage);
    const returnToOriginalState = () =>
      router.stateService.go(returnTo.state(), returnTo.params(), {
        reload: true,
      });

    this.authenticating = true;
    AuthService.authenticate(this.username, this.password)
      .then(returnToOriginalState)
      .catch((error: string) => {
        done();
        showError(error);
      });
  };

  handleSubmit(e: Event) {
    e.preventDefault();
    this.login();
  }

  render() {
    return html` <div class="container">
      <div class="col-md-6 col-md-offset-3 col-sm-8 col-sm-offset-2">
        <h3>Log In</h3>
        <p>
          (This login screen is for demonstration only... just pick a username,
          enter 'password' and click <b>"Log in"</b>)
        </p>
        <hr />
        <form
          class="login-form"
          method="post"
          action="/login"
          @submit=${this.handleSubmit}
        >
          <div>
            <label for="username">Username:</label>
            <select
              class="form-control"
              name="username"
              id="username"
              value=${this.username}
              @change=${(e: Event) => {
                this.username = (e.target as HTMLSelectElement).value;
              }}
            >
              <option value="" disabled selected></option>
              ${this.usernames.map(
                (option: string) =>
                  html`<option key=${option} value=${option}>
                    ${option}
                  </option>`,
              )}
            </select>
            ${!this.username
              ? html`<label for="username">
                  <i
                    style="display: block; position: relative; bottom: 1.8em; margin-left: 10em; height: 0"
                    class="fa fa-arrow-left bounce-horizontal"
                  >
                    Choose
                  </i>
                </label>`
              : null}
          </div>
          <br />
          <div>
            <label for="password">Password:</label>
            <input
              class="form-control"
              type="password"
              name="password"
              value=${this.password}
              @change=${(e: Event) =>
                (this.password = (e.target as HTMLInputElement).value)}
            />
            ${this.username && this.password !== 'password'
              ? html`<i
                  style="position: relative; bottom: 1.8em; margin-left: 5em; height: 0"
                  class="fa fa-arrow-left bounce-horizontal"
                >
                  Enter '<b>password</b>' here
                </i>`
              : null}
          </div>
          ${this.errorMessage
            ? html`<div class="well error">${this.errorMessage}</div>`
            : null}
          <hr />
          <div>
            <button
              class="btn btn-primary"
              type="submit"
              ?disabled=${this.authenticating}
            >
              ${this.authenticating
                ? html`<i class="fa fa-spin fa-spinner"></i>`
                : null} <span>Log in</span>
            </button>
            ${this.username && this.password === 'password'
              ? html`<i
                  style="position: relative"
                  class="fa fa-arrow-left bounce-horizontal"
                >
                  Click Me!</i
                >`
              : null}
          </div>
        </form>
      </div>
    </div>`;
  }
}

export default Login;
