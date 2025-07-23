import { html, LitElement } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { customElement, property } from 'lit/decorators.js';
import { UIViewInjectedProps } from '@uirouter/lit';

import AuthService from '../global/authService.js';
import './NavHeader.js';

@customElement('sample-app')
export class App extends LitElement {
  createRenderRoot() {
    return this;
  }

  static sticky = true;

  @property({ attribute: false })
  _uiViewProps: UIViewInjectedProps;

  constructor(props: UIViewInjectedProps) {
    super();

    this._uiViewProps = props;
  }

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
