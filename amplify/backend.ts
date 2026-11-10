import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { cloudDeskAI } from './functions/cloudDeskAI/resource';

const backend = defineBackend({
  auth,
  data,
  cloudDeskAI,
});

backend.cloudDeskAI.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: [
      `arn:aws:bedrock:eu-west-1:${process.env.CDK_DEFAULT_ACCOUNT}:inference-profile/eu.amazon.nova-lite-v1:0`,
      'arn:aws:bedrock:*::foundation-model/amazon.nova-lite-v1:0',
    ],
  }),
);