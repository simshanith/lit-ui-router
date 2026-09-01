import { html } from 'lit';
import { uiSref } from 'lit-ui-router';

export function home() {
  return html`<div>
    <div class="home buttons">
      <a ${uiSref('mymessages')} class="btn btn-primary">
        <h1><i class="fa fa-envelope"></i></h1>
        <h1>Messages</h1>
      </a>

      <a ${uiSref('contacts')} class="btn btn-primary">
        <h1><i class="fa fa-users"></i></h1>
        <h1>Contacts</h1>
      </a>

      <a ${uiSref('prefs')} class="btn btn-primary">
        <h1><i class="fa fa-cogs"></i></h1>
        <h1>Preferences</h1>
      </a>
    </div>
  </div>`;
}

export default home;
