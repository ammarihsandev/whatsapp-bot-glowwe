import * as baileys from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';

async function startSock() {
  const { state, saveCreds } = await baileys.useMultiFileAuthState('./auth');
  const { version } = await baileys.fetchLatestBaileysVersion();

  const sock = baileys.default({
    version,
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== baileys.DisconnectReason.loggedOut) {
        console.log('🌀 Reconnecting...');
        startSock();
      } else {
        console.log('❌ Logged out. Delete auth folder to re-pair.');
      }
    } else if (connection === 'open') {
      console.log('✅ Connected to WhatsApp');
    }
  });

  sock.ev.on('messages.upsert', ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const text = m.message.conversation || m.message.extendedTextMessage?.text;
    if (text?.toLowerCase() === 'ping') {
      sock.sendMessage(m.key.remoteJid, { text: 'pong' });
    }
  });
}

startSock();
