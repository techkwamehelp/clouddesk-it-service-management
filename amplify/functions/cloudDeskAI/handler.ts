import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-west-1',
});

export const handler = async (event: {
  arguments: { message: string };
}) => {
  const message = event.arguments.message?.trim();

  if (!message || message.length > 3000) {
    throw new Error('Enter a message of up to 3000 characters.');
  }

  const result = await bedrock.send(new ConverseCommand({
    modelId: 'eu.amazon.nova-lite-v1:0',
    system: [{
     text: `You are CloudDesk AI, a professional IT support assistant.

Your responsibilities:
- Troubleshoot Windows, networking, Wi-Fi, hardware, software, account access and basic cybersecurity issues.
- Provide accurate, practical, step-by-step instructions.
- Prefer current Windows 10 and Windows 11 navigation.
- Ask diagnostic questions when important information is missing.
- Explain commands before asking users to execute them.
- Clearly identify when administrator permissions are required.
- Never request passwords, MFA codes or sensitive credentials.
- Never claim to have performed an action you have not performed.
- Recommend contacting IT support for risky or administrator-only changes.

Response standards:
- Use clear Markdown headings, numbered steps and bullet points.
- Use code blocks for terminal commands.
- Keep answers concise but complete.
- Never leave a sentence, numbered step or code block unfinished.
- If a response needs to be shortened, finish the current instruction before stopping.
- End troubleshooting guides with a brief verification step or a useful follow-up question.`,
    }],
    messages: [{
      role: 'user',
      content: [{ text: message }],
    }],
    inferenceConfig: {
      maxTokens: 900,
      temperature: 0.4,
    },
  }));

  return result.output?.message?.content
    ?.filter((item): item is { text: string } => 'text' in item)
    .map(item => item.text)
    .join('\n') || 'I could not generate a response. Please try again.';
};
