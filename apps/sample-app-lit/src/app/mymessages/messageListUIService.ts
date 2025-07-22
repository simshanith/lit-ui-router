import AppConfig from '../global/appConfig';

export function orderBy (predicate: string) {
  let descending = 1;
  if (predicate.charAt(0) === '+' || predicate.charAt(0) === '-') {
    descending = predicate.charAt(0) === '-' ? -1 : 1;
    predicate = predicate.substring(1);
  }
  return (a, b) => {
    let result = 0;
    const valA = a[predicate], valB = b[predicate];
    if (valA < valB) result = -1;
    if (valA > valB) result = 1;
    return result * descending;
  }
}

class MessageListUI {
  proximalMessageId (messages, messageId) {
    const sorted = messages.sort(orderBy(AppConfig.sort));
    const idx = sorted.findIndex(msg => msg._id === messageId);
    const proximalIdx = sorted.length > idx + 1 ? idx + 1 : idx - 1;
    return proximalIdx >= 0 ? sorted[proximalIdx]._id : undefined;
  }
}

const instance = new MessageListUI();
export default instance;
