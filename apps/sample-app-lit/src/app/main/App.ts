import { html, LitElement } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { customElement } from 'lit/decorators.js';
import { UIViewInjectedProps, RoutedLitElement } from '@uirouter/lit';

import AuthService from '../global/authService.js';
import './NavHeader.js';

@customElement('sample-app')
export class App extends RoutedLitElement {
  createRenderRoot() {
    return this;
  }

  static sticky = true;

  shouldUpdate(changedProperties) {
    const viewPropsChanged = changedProperties.has('_uiViewProps');
    return viewPropsChanged || super.shouldUpdate(changedProperties);
  }

  requestUpdate(changedProperties) {
    super.requestUpdate(changedProperties);
    const navHeader: LitElement =
      this.renderRoot?.querySelector('sample-nav-header');
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
