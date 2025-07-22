import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import {
  uiSref,
  uiSrefActive,
} from '@lit-ui-router/lit-ui-router';
import { isEqual } from 'lodash';

import {orderBy} from './messageListUIService';

import AppConfig from '../global/appConfig';
import { SortMessages, ChangeEvent } from './SortMessages';
import { Message } from './interface';

export { SortMessages };

/**
* A component that displays a folder of messages as a table
*
* If a row is clicked, the details of the message is shown using a relative UISref to `.message`.
*
* UISrefActive is used to highlight the selected row.
*
* Shows/hides specific columns based on the `columns` resolved prop.
*/
const tableColumns = [
  { label: '', name: 'read' },
  { label: 'Sender', name: 'from' },
  { label: 'Recipient', name: 'to' },
  { label: 'Subject', name: 'subject' },
  { label: 'Date', name: 'date' },
];

@customElement('sample-message-table')
export class MessageTable extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property({ attribute: false })
  columns: { name: string; }[];

  @property({
    hasChanged(value, oldValue) {
      return isEqual(value, oldValue);
    },
    attribute: false,
  })
  messages: Message[]

  @state()
  sort = AppConfig.sort;

  colVisible = (name) => this.columns.indexOf(name) !== -1;
  changeSort = (e: ChangeEvent) => this.sort = e.detail.sort;
  formattedContent = (message: Message, col: keyof Message) => {
    if (col === 'date') return new Date(message[col]).toISOString().slice(0,10);
    if (col === 'read') return !message[col] ? html`<i class="fa fa-circle" style="font-size: 50%"></i>` : '';
    return message[col];
  }

  render() {
    const { sort, messages } = this;

    const visibleColumns = tableColumns.filter(column => this.colVisible(column.name));
    const tableHead = repeat(
        visibleColumns,
        ({ name }) => name,
        column => html`<td>
          <sample-sort-messages
            .label=${column.label}
            .col=${column.name}
            .sort=${sort}
            @change=${this.changeSort}
          ></sample-sort-messages>
        </td>`
    );
    const tableBody = repeat(
      messages.sort(orderBy(sort)),
      ({ _id }) => _id,
      message => html`<tr ${
        uiSrefActive({ activeClasses: ['active']})
      } ${
        uiSref('.message', {messageId: message._id })
      }>${
        visibleColumns.map(column =>
          html`<td>${this.formattedContent(message, column.name as keyof Message)}</td>`
        )}
      </tr>`
    );
    return html`
    <table>
      <thead>
        <tr>${tableHead}</tr>
      </thead>
      <tbody>
        ${tableBody}
      </tbody>
    </table>`;
  }
}

export default MessageTable;
