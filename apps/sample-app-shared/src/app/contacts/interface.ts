export interface Contact {
  _id?: string;
  name: {
    first: string;
    last: string;
  };
  company: string;
  age: number;
  phone: string;
  email: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  picture: string;
}
