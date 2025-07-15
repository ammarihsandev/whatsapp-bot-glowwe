import { default as makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';

async function startSock() {
  // Load authentication state from "auth" folder
  const { state, saveCreds } = await useMultiFileAuthState('./auth');

  // Get latest WhatsApp Web version
  const { version } = await fetchLatestBaileysVersion();

  // Initialize the socket
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true
  });

  // Save credentials on update
  sock.ev.on('creds.update', saveCreds);

  // Connection updates (reconnect if not logged out)
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        console.log('🌀 Reconnecting...');
        startSock();
      } else {
        console.log('❌ Logged out. Delete auth folder to re-scan QR.');
      }
    } else if (connection === 'open') {
      console.log('✅ WhatsApp connected successfully!');
    }
  });

  // Basic "ping" ➜ "pong" reply
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
