import { html } from 'lit';
import { uiSref } from 'lit-ui-router';

export function home() {
  return html`<div>
    <h1 class="sr-only" tabindex="-1">Home</h1>
    <div class="home buttons">
      <a ${uiSref('mymessages')} class="btn btn-primary">
        <div class="h1"><i class="fa fa-envelope"></i></div>
        <h2 class="h1">Messages</h2>
      </a>

      <a ${uiSref('contacts')} class="btn btn-primary">
        <div class="h1"><i class="fa fa-users"></i></div>
        <h2 class="h1">Contacts</h2>
      </a>

      <a ${uiSref('prefs')} class="btn btn-primary">
        <div class="h1"><i class="fa fa-cogs"></i></div>
        <h2 class="h1">Preferences</h2>
      </a>
    </div>
  </div>`;
}

export default home;
