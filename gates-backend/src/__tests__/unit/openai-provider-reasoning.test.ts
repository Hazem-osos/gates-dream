import { buildRequestBody } from '../../modules/ai/providers/openai.provider';

jest.mock('../../modules/ai/config/ai.config', () => ({
  getAiRuntimeConfig: () => ({
    apiKey: 'sk-test',
    model: 'gpt-5.6-luna',
    baseUrl: 'https://api.openai.com/v1',
  }),
  isAiConfigured: () => true,
  getPublicAiConfig: () => ({ model: 'gpt-5.6-luna', configured: true }),
}));

describe('OpenAI Chat Completions payload', () => {
  it('sets reasoning_effort none whenever function tools are sent', () => {
    const body = buildRequestBody(
      {
        messages: [{ role: 'user', content: 'نواقص المخزن؟' }],
        tools: [
          {
            type: 'function',
            function: { name: 'getInventoryStatus', description: 'stock' },
          },
        ],
        toolChoice: 'auto',
      },
      false
    );

    expect(body.model).toBe('gpt-5.6-luna');
    expect(body.tools).toHaveLength(1);
    expect(body.reasoning_effort).toBe('none');
  });
});
