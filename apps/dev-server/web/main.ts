import { createDevWebClient } from '../src/client';

const status = document.querySelector<HTMLParagraphElement>('#status');
const client = createDevWebClient('');

try {
  const info = await client.app.info();
  if (status) status.textContent = `${info.name} ${info.version} — adapter reachable`;
} catch (error) {
  if (status) status.textContent = `adapter unreachable: ${(error as Error).message}`;
}
