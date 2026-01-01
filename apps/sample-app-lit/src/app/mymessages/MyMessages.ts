import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { UIViewInjectedProps, uiSref, uiSrefActive } from 'lit-ui-router';

@customElement('sample-my-messages')
export class MyMessages extends LitElement {
  createRenderRoot() {
    return this;
  }

  constructor(public _uiViewProps: UIViewInjectedProps) {
    super();
  }

  get folders(): { _id: string }[] {
    return this._uiViewProps.resolves?.folders ?? [];
  }

  render() {
    const folders = repeat(
      this.folders,
      ({ _id }) => _id,
      (folder) =>
        html`<li
          class="folder"
          ${uiSrefActive({ activeClasses: ['selected'] })}
        >
          <a ${uiSref('.messagelist', { folderId: folder._id })}>
            <i class="fa"></i>${folder._id}
          </a>
        </li>`,
    );
    return html`<div>
      <div class="my-messages">
        <div class="folderlist">
          <ul class="selectlist list-unstyled">
            ${folders}
          </ul>
        </div>
        ${
          null /* A named view for the list of messages in this folder. This will be filled in by the 'mymessages.messagelist' child state */
        }
        <ui-view name="messagelist" class="messagelist"></ui-view>
      </div>
      ${
        null /*  A named UIView for a message's contents. The 'mymessages.messagelist.message' grandchild state plugs into this UIView */
      }
      <ui-view name="messagecontent"></ui-view>
    </div>`;
  }
}

export default MyMessages;
