import { html, LitElement, PropertyValues } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { customElement, state } from 'lit/decorators.js';
import { UIViewInjectedProps } from '@uirouter/lit';

import AuthService from '../global/authService.js';
import './NavHeader.js';

@customElement('sample-app')
export class App extends LitElement {
  createRenderRoot() {
    return this;
  }

  static sticky = true;

  @state()
  uiViewProps?: UIViewInjectedProps;

  constructor(props?: UIViewInjectedProps) {
    super();

    this.uiViewProps = props;
  }

  protected shouldUpdate(changedProperties: PropertyValues<this>) {
    const viewPropsChanged = changedProperties.has('uiViewProps');
    return viewPropsChanged || super.shouldUpdate(changedProperties);
  }

  requestUpdate(changedProperties: PropertyKey | undefined) {
    super.requestUpdate(changedProperties);
    const navHeader: LitElement =
      this.renderRoot?.querySelector('sample-nav-header');
    navHeader?.requestUpdate();
  }

  private get _stateService() {
    return this.uiViewProps?.router?.stateService;
  }

  isActive(glob: string) {
    return this._stateService?.includes(glob);
  }

  handleLogout = () => {
    AuthService.logout();
    this._stateService?.go('welcome', {}, { reload: true });
  };

  displayActive(glob) {
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

export default App;
