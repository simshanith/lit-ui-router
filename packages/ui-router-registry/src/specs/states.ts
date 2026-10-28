export interface Draft {
  subject?: string;
}

declare const draft: Draft;

// The declaration table the registered specs augment `Register` with.
export const states = [
  { name: 'home', url: '/home' },
  { name: 'contacts', url: '/contacts' },
  { name: 'contacts.contact', url: '/:contactId' },
  { name: 'contacts.contact.edit', url: '/edit' },
  {
    name: 'messages',
    url: '/messages?sort',
    params: { sort: { value: 'date', squash: true } },
  },
  { name: 'messages.list', url: '/:folderId', params: { folderId: 'inbox' } },
  { name: 'messages.list.message', url: '/{messageId:int}' },
  {
    name: 'compose',
    parent: 'messages',
    url: '/compose',
    params: {
      draft: { value: draft },
      meta: { type: 'json', value: null },
    },
  },
  {
    name: 'search',
    url: '/search?q&{page:int}&kv',
    params: { kv: { value: null, squash: true }, tab: { value: null } },
  },
  // A future state's placeholder; the lazy module registers `admin.*` itself.
  { name: 'admin.**', url: '/admin' },
] as const;

export class AboutState {
  readonly name = 'about';

  readonly url = '/about';
}

// A widened name can't be registered, so it adds nothing to StateName.
export declare const dynamicState: { name: string; url: '/dynamic' };
