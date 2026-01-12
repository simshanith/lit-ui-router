import { html, LitElement, PropertyValues } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { customElement, property } from 'lit/decorators.js';
import { UIViewInjectedProps, RoutedLitElement } from 'lit-ui-router';

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

  shouldUpdate(changedProperties: PropertyValues) {
    const viewPropsChanged = changedProperties.has('_uiViewProps');
    return viewPropsChanged || super.shouldUpdate(changedProperties);
  }

  override requestUpdate(
    name?: PropertyKey,
    oldValue?: unknown,
    options?: unknown,
  ) {
    super.requestUpdate(name, oldValue, options as never);
    const navHeader =
      this.renderRoot?.querySelector<LitElement>('sample-nav-header');
    navHeader?.requestUpdate();
  }

  get stateService() {
    return this._uiViewProps.router.stateService;
  }

  isActive(glob: string) {
    return this.stateService.includes(glob);
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
