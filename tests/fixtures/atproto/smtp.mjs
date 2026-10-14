import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createServer } from 'node:net';

// The receiver exists only inside the owned container and delivers normal provider email.
createServer((socket) => {
  socket.setEncoding('utf8');
  socket.setTimeout(30000, () => socket.destroy());
  socket.on('error', () => socket.destroy());
  socket.write('220 acceptance SMTP\r\n');
  let buffer = '';
  let receiving = false;
  let message = '';
  socket.on('data', (chunk) => {
    buffer += chunk;
    if (buffer.length + message.length > 1024 * 1024) {
      socket.destroy();
      return;
    }
    let index;
    while ((index = buffer.indexOf('\r\n')) >= 0) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      if (receiving) {
        if (line === '.') {
          writeFileSync(
            `/pds/mail/${Date.now()}-${randomUUID()}.eml`,
            message,
            {
              mode: 0o600,
            }
          );
          message = '';
          receiving = false;
          socket.write('250 delivered\r\n');
        } else message += line.replace(/^\.\./, '.') + '\r\n';
      } else if (/^(EHLO|HELO)/i.test(line)) socket.write('250 acceptance\r\n');
      else if (/^(MAIL FROM|RCPT TO|RSET|NOOP)/i.test(line))
        socket.write('250 OK\r\n');
      else if (/^DATA/i.test(line)) {
        receiving = true;
        socket.write('354 send message\r\n');
      } else if (/^QUIT/i.test(line)) socket.end('221 bye\r\n');
      else socket.write('502 unsupported\r\n');
    }
  });
}).listen(2525, '127.0.0.1');
