import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { UIViewInjectedProps } from 'lit-ui-router';

import { AppConfig, AuthService } from '../global/appModules.js';

@customElement('sample-login')
export class Login extends LitElement {
  createRenderRoot() {
    return this;
  }

  constructor(public _uiViewProps: UIViewInjectedProps) {
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
    const { router, resolves } = this._uiViewProps;

    const returnTo = resolves?.returnTo as {
      state: () => string;
      params: () => object;
    };

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
      .catch((cause: unknown) => {
        done();
        showError(cause instanceof Error ? cause.message : String(cause));
      });
  };

  handleSubmit(e: Event) {
    e.preventDefault();
    this.login();
  }

  render() {
    return html` <div class="container">
      <div class="col-md-6 col-md-offset-3 col-sm-8 col-sm-offset-2">
        <h1 class="h3" tabindex="-1">Log In</h1>
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
              @change=${(e: Event) => {
                this.username = (e.target as HTMLSelectElement).value;
              }}
            >
              <option value="" disabled selected></option>
              ${this.usernames.map((option: string) => html`<option value=${option}>${option}</option>`)}
            </select>
            ${!this.username ? html`<i aria-hidden="true" style="display: block; position: relative; inset-block-end: 1.8em; margin-inline-start: 10em; height: 0" class="fa fa-arrow-left bounce-horizontal"> Choose </i>` : null}
          </div>
          <br />
          <div>
            <label for="password">Password:</label>
            <input
              class="form-control"
              type="password"
              name="password"
              id="password"
              value=${this.password}
              @change=${(e: Event) => (this.password = (e.target as HTMLInputElement).value)}
            />
            ${
              this.username && this.password !== 'password'
                ? html`<i
                    style="position: relative; inset-block-end: 1.8em; margin-inline-start: 5em; height: 0"
                    class="fa fa-arrow-left bounce-horizontal"
                    >Enter '<b>password</b>' here</i
                  >`
                : null
            }
          </div>
          ${this.errorMessage ? html`<div class="well error">${this.errorMessage}</div>` : null}
          <hr />
          <div>
            <button
              class="btn btn-primary"
              type="submit"
              ?disabled=${this.authenticating}
            >
              ${this.authenticating ? html`<i class="fa fa-spin fa-spinner"></i>` : null}
              <span>Log in</span>
            </button>
            ${this.username && this.password === 'password' ? html`<i style="position: relative" class="fa fa-arrow-left bounce-horizontal"> Click Me!</i>` : null}
          </div>
        </form>
      </div>
    </div>`;
  }
}

export default Login;
