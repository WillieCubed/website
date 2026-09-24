import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';

export function enrollment(target, bytes = randomBytes(20)) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let secret = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      secret += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) secret += alphabet[(value << (5 - bits)) & 31];
  const issuer = 'Willie Chalmers IndieAuth';
  const account = new URL(target.origin).hostname;
  const uri = `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  return { secret, uri };
}

function hiddenAnswer(question) {
  return new Promise((resolve, reject) => {
    process.stdout.write(question);
    let answer = '';
    const input = process.stdin;
    const wasRaw = input.isRaw;
    input.setRawMode(true);
    input.resume();
    const finish = (error) => {
      input.off('data', onData);
      input.setRawMode(Boolean(wasRaw));
      input.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(answer.trim());
    };
    const onData = (chunk) => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\r' || char === '\n') return finish();
        if (char === '\u0003')
          return finish(new Error('Credential entry cancelled'));
        if (char === '\u007f') answer = answer.slice(0, -1);
        else answer += char;
      }
    };
    input.on('data', onData);
  });
}

export async function ownerValues(target, names, provided = process.env) {
  const values = { ...provided };
  if (names.has('INDIEAUTH_TOTP_SECRET') && names.has('MICROPUB_GITHUB_TOKEN'))
    return values;
  if (!process.stdin.isTTY) return values;
  if (!names.has('INDIEAUTH_TOTP_SECRET') && !values.INDIEAUTH_TOTP_SECRET) {
    const { secret, uri } = enrollment(target);
    console.log(
      'Step 1: Add this account to an authenticator. The secret is shown once and is not saved.'
    );
    console.log(`Setup key: ${secret}`);
    console.log(`Authenticator URI: ${uri}`);
    const prompt = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const response = await prompt.question(
      'Press Enter after scanning it, or type cancel: '
    );
    prompt.close();
    if (response.trim())
      throw new Error('Authenticator enrollment was not confirmed');
    values.INDIEAUTH_TOTP_SECRET = secret;
  }
  if (!names.has('MICROPUB_GITHUB_TOKEN') && !values.MICROPUB_GITHUB_TOKEN) {
    console.log(
      'Step 2: Create a fine-grained GitHub token for WillieCubed/website with Contents read/write.'
    );
    console.log('Open https://github.com/settings/personal-access-tokens/new');
    values.MICROPUB_GITHUB_TOKEN = await hiddenAnswer(
      'Paste the token (input hidden): '
    );
  }
  return values;
}
