
import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({

  Ticket: a.model({
    title: a.string().required(),
    description: a.string().required(),

    category: a.enum([
      'HARDWARE',
      'SOFTWARE',
      'NETWORK',
      'ACCESS',
      'OTHER'
    ]),

    priority: a.enum([
      'LOW',
      'MEDIUM',
      'HIGH',
      'URGENT'
    ]),

    status: a.enum([
      'OPEN',
      'IN_PROGRESS',
      'PENDING',
      'RESOLVED',
      'CLOSED'
    ]),

    assignedTo: a.string(),
    resolutionNotes: a.string(),

  }).authorization((allow) => [
    allow.owner().to(['create', 'read', 'update']),
    allow.groups(['TECHNICIANS']).to(['read', 'update']),
    allow.groups(['ADMINS']),
  ]),

  KnowledgeArticle: a.model({
    title: a.string().required(),
    category: a.string().required(),
    content: a.string().required(),
    author: a.string(),
    published: a.boolean().default(false),

  }).authorization((allow) => [
    allow.authenticated().to(['read']),
    allow.groups(['TECHNICIANS', 'ADMINS']),
  ]),

});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
