import { createInterface } from "node:readline/promises";

import { sessions, TelegramClient } from "teleproto";

const { StringSession } = sessions;

const apiIdText = process.env.TELEGRAM_API_ID?.trim();
const apiHash = process.env.TELEGRAM_API_HASH?.trim();
const apiId = Number(apiIdText);
if (!apiIdText || !Number.isSafeInteger(apiId) || apiId <= 0) {
  throw new Error("TELEGRAM_API_ID must be a positive integer");
}
if (!apiHash) throw new Error("TELEGRAM_API_HASH is required");

const input = createInterface({ input: process.stdin, output: process.stdout });
const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 5
});

try {
  await client.start({
    phoneNumber: () => input.question("Telefone com código do país: "),
    phoneCode: () => input.question("Código recebido pelo Telegram: "),
    password: () => input.question("Senha 2FA (se solicitada): "),
    onError: (error) => {
      console.error(
        `Falha de autorização: ${error instanceof Error ? error.name : "UnknownError"}`
      );
      return Promise.resolve(false);
    }
  });
  console.log("\nGuarde o valor abaixo como segredo; ele concede acesso à conta autorizada.");
  console.log(`TELEGRAM_SESSION=${client.session.save()}`);
} finally {
  input.close();
  await client.disconnect();
}
