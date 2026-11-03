import type { Schema } from '../amplify/data/resource';

type TicketFields = Schema['Ticket']['type'];

// These assignments test the inferred field types.
const titleCheck: TicketFields['title'] = 'Test ticket';
const descriptionCheck: TicketFields['description'] = 'Test description';

export { titleCheck, descriptionCheck };