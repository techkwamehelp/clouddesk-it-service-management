import { defineFunction } from '@aws-amplify/backend';

export const cloudDeskAI = defineFunction({
  name: 'cloudDeskAI',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 256,
});