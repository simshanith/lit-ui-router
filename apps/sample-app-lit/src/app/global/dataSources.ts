import { SessionStorage } from '../util/sessionStorage.js';
import AppConfig from './appConfig.js';
/**
 * Fake REST Services (Contacts, Folders, Messages) used in the mymessages submodule.
 *
 * Each of these APIs have:
 *
 * .all()
 * .search(exampleItem)
 * .get(id)
 * .save(item)
 * .post(item)
 * .put(item)
 * .remove(item)
 *
 * See ../util/sessionStorage.js for more details, if curious
 */

/** A fake Contacts REST client API */
class Contacts extends SessionStorage {
  constructor() {
    // http://beta.json-generator.com/api/json/get/V1g6UwwGx
    super('contacts', 'static/data/contacts.json');
  }
}

/** A fake Folders REST client API */
class Folders extends SessionStorage {
  constructor() {
    super('folders', 'static/data/folders.json');
  }
}

/** A fake Messages REST client API */
class Messages extends SessionStorage {
  constructor() {
    // http://beta.json-generator.com/api/json/get/VJl5GbIze
    super('messages', 'static/data/messages.json');
  }

  byFolder(folder) {
    const searchObject = { folder: folder._id };
    const toFromAttr =
      ['drafts', 'sent'].indexOf(folder._id) !== -1 ? 'from' : 'to';
    searchObject[toFromAttr] = AppConfig.emailAddress;
    return this.search(searchObject);
  }
}

const ContactsStorage = new Contacts();
const FoldersStorage = new Folders();
const MessagesStorage = new Messages();

export { ContactsStorage, FoldersStorage, MessagesStorage };
