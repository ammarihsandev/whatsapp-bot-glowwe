/*****************************************************************
 * Glowwe WhatsApp Bot – server.js
 * - Saves the WhatsApp pairing QR to qr.png
 * - Serves it via Express so you can scan in a browser
 * - Keeps a health‑check endpoint to satisfy Render’s port scan
 *****************************************************************/

const makeWASocket = require('@whiskeysockets/baileys').default;
const {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const QRCode = require('qrcode');
const fs = require('fs');
const express = require('express');

const AUTH_PATH = '/opt/render/project/src/auth';        // persistent disk
const PORT      = process.env.PORT || 3000;              // Render expects this

/*****************************************************************
 * Express server – serves qr.png and a simple home page
 *****************************************************************/
const app = express();
app.use(express.static('.')); // makes qr.png accessible

app.get('/', (_req, res) => {
  res.send(`
    <h1>Glowwe WhatsApp Bot</h1>
    <p>QR Code: <a href="/qr.png" target="_blank">View /qr.png</a></p>
    <p>If you see a blank image, wait a few seconds and refresh after the bot prints "QR saved".</p>
  `);
});

app.listen(PORT, () => {
  console.log(`🌐 Express server running on port ${PORT}`);
});

/*****************************************************************
 * WhatsApp socket setup
 *****************************************************************/
async function startSock () {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false        // we’ll handle QR ourselves
  });

  /* save creds whenever they change */
  sock.ev.on('creds.update', saveCreds);

  /* connection handler */
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    /* if WhatsApp provides a new QR, turn it into qr.png */
    if (qr) {
      console.log('🖼️  Generating PNG QR...');
      await QRCode.toFile('./qr.png', qr, {
        width: 300,
        margin: 1,
        color: { dark: '#000', light: '#FFF' }
      });
      console.log('✅ QR saved as qr.png — open /qr.png to scan');
    }

    /* auto‑reconnect logic */
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        console.log('🔁 Reconnecting...');
        startSock();
      } else {
        console.log('❌ Logged out. Delete auth folder to re‑pair.');
      }
    }

    if (connection === 'open') {
      console.log('✅ Connected to WhatsApp');
    }
  });

  /* simple echo demo */
  sock.ev.on('messages.upsert', ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const text =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      '';

    if (text.toLowerCase() === 'ping') {
      sock.sendMessage(m.key.remoteJid, { text: 'pong' });
    }
  });
}

/* launch */
startSock();
