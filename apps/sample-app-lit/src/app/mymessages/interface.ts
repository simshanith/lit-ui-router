export interface Message {
  _id: string;
  read: boolean;
  from: string;
  to: string;
  date: string;
  subject: string;
  body: string;
}
