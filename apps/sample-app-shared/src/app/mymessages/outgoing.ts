import { Message } from './interface.js';

/** A composed message stamped for the drafts or sent folder; `date` is ISO like the fixtures. */
export const outgoingMessage = (
  message: Message,
  folder: 'drafts' | 'sent',
  now: Date = new Date(),
): Message => ({
  ...message,
  date: now.toISOString(),
  read: true,
  folder,
});
