import AppConfig from '../global/appConfig.js';
import { Message } from './interface.js';

export function orderBy(predicate: string) {
  let descending = 1;
  if (predicate.charAt(0) === '+' || predicate.charAt(0) === '-') {
    descending = predicate.charAt(0) === '-' ? -1 : 1;
    predicate = predicate.substring(1);
  }
  return (a: Message, b: Message) => {
    let result = 0;
    const valA = a[predicate] as string | number | boolean;
    const valB = b[predicate] as string | number | boolean;
    if (valA < valB) result = -1;
    if (valA > valB) result = 1;
    return result * descending;
  };
}

class MessageListUI {
  proximalMessageId(messages: Message[], messageId: string) {
    const sorted = messages.sort(orderBy(AppConfig.sort));
    const idx = sorted.findIndex((msg: Message) => msg._id === messageId);
    const proximalIdx = sorted.length > idx + 1 ? idx + 1 : idx - 1;
    return proximalIdx >= 0 ? sorted[proximalIdx]._id : undefined;
  }
}

const instance = new MessageListUI();
export default instance;
