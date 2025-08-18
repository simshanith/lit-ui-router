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

  requestUpdate(changedProperties: PropertyKey | undefined) {
    super.requestUpdate(changedProperties);
    // TODO: This manual update should not be necessary
    // Nav header should be able to detect the change in state and update itself
    const navHeader: LitElement | null =
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

  // TODO: Can the ui-view component manage this internally and set a reflected attribute?
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
        <!-- TODO: This should probably be renamed to sidebar -->
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
