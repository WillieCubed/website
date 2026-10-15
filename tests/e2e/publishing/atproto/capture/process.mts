import { spawn } from 'node:child_process';

export async function run(
  command: string,
  args: string[],
  cwd: string,
  env = process.env
) {
  await new Promise<void>((finish, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? finish() : reject(new Error(`${command} exited ${code}.`))
    );
  });
}
