import { html, LitElement } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { customElement, property } from 'lit/decorators.js';
import { isEqual } from 'lodash-es';
import { UIViewInjectedProps, RoutedLitElement } from 'lit-ui-router';

import { RouterSignalController } from 'lit-ui-router-signals';

import AuthService from '../global/authService.js';
import './NavHeader.js';

@customElement('sample-app')
export class App extends LitElement {
  createRenderRoot() {
    return this;
  }

  static sticky = true;

  /** @public — router-assigned; the `_` prefix is convention, not privacy. */
  @property({ attribute: false })
  _uiViewProps!: UIViewInjectedProps;

  constructor(props: UIViewInjectedProps) {
    super();
    this._uiViewProps = props;
  }

  // Watches the RouterSignals of the enclosing <ui-router> and re-renders
  // only when a section's visibility actually flips — not on every
  // transition.
  private readonly activeSections = new RouterSignalController(
    this,
    (route) => ({
      mymessages: route.includes('mymessages.**'),
      contacts: route.includes('contacts.**'),
    }),
    { equals: isEqual },
  );

  get stateService() {
    return this._uiViewProps.router.stateService;
  }

  handleLogout = () => {
    AuthService.logout();
    void this.stateService.go('welcome', {}, { reload: true });
  };

  displayActive(section: 'mymessages' | 'contacts') {
    return styleMap({
      display: this.activeSections.value[section] ? 'block' : 'none',
    });
  }

  render() {
    return html`
      <div>
        <div class="navheader">
          <sample-nav-header @logout=${this.handleLogout}></sample-nav-header>
        </div>
        <ui-view></ui-view>
        <ui-view
          name="mymessages"
          style=${this.displayActive('mymessages')}
        ></ui-view>
        <ui-view
          name="contacts"
          style=${this.displayActive('contacts')}
        ></ui-view>
      </div>
    `;
  }
}

export default App satisfies RoutedLitElement;
