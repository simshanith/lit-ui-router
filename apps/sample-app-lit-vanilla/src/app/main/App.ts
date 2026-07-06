import { html, LitElement } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { customElement, property } from 'lit/decorators.js';
import {
  TransitionController,
  UIViewInjectedProps,
  RoutedLitElement,
} from 'lit-ui-router';

import AuthService from '../global/authService.js';
import './NavHeader.js';

@customElement('sample-app')
export class App extends LitElement {
  createRenderRoot() {
    return this;
  }

  static sticky = true;

  @property({ attribute: false })
  _uiViewProps!: UIViewInjectedProps;

  constructor(props: UIViewInjectedProps) {
    super();
    this._uiViewProps = props;
  }

  // Re-renders this component after every successful transition, keeping the
  // named ui-view visibility (displayActive) in sync with the active state.
  transitions = new TransitionController(this);

  get stateService() {
    return this._uiViewProps.router.stateService;
  }

  isActive(glob: string) {
    return this.transitions.includes(glob);
  }

  handleLogout = () => {
    AuthService.logout();
    this.stateService.go('welcome', {}, { reload: true });
  };

  displayActive(glob: string) {
    return styleMap({
      display: this.isActive(glob) ? 'block' : 'none',
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
          style=${this.displayActive('mymessages.**')}
        ></ui-view>
        <ui-view
          name="contacts"
          style=${this.displayActive('contacts.**')}
        ></ui-view>
      </div>
    `;
  }
}

export default App satisfies RoutedLitElement;
