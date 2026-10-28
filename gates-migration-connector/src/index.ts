import { startConnectorLoop } from './connector-loop.js';

export { startConnectorLoop };

const isDirect =
  typeof process.argv[1] === 'string' && /(?:^|[/\\])index\.(c?js|mjs|ts)$/i.test(process.argv[1]);

if (isDirect) {
  void import('dotenv/config')
    .then(() => startConnectorLoop())
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
