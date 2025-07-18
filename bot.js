const baileys = require('@whiskeysockets/baileys');
const makeWASocket = baileys.default;
const { useMultiFileAuthState, DisconnectReason } = baileys;
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const { authorize, uploadSession, downloadSession } = require('./drive');
const express = require('express');

const sessionPath = './auth_info/creds.json';
const SECRET = 'process.env.SECRET'; // 🔒 Same as used in Google Apps Script

let sockGlobal = null;


const fs = require('fs');

// Rebuild token.json from env
if (process.env.SECRET_AT && process.env.SECRET_RT) {
  const tokenData = {
    access_token: process.env.SECRET_AT,
    refresh_token: process.env.SECRET_RT,
    scope: "https://www.googleapis.com/auth/drive.file",
    token_type: "Bearer",
    expiry_date: Date.now() + 3600 * 1000 // 1 jam dari sekarang (sementara)
  };
  fs.writeFileSync('token.json', JSON.stringify(tokenData));
}


if (process.env.SECRET_CLIENTID && process.env.GOOGLE_CLIENT_SECRET) {
  const credentials = {
    installed: {
      client_id: process.env.SECRET2,
      project_id: "glowwe-whatsapp-bot",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_secret: process.env.SECRET2,
      redirect_uris: ["http://localhost"]
    }
  };
  fs.writeFileSync('credentials.json', JSON.stringify(credentials));
}



async function startBot() {
  const auth = await authorize();

  const sessionId = await downloadSession(auth, sessionPath);
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('connection closed due to', lastDisconnect.error, ', reconnecting:', shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('✅ Connected to WhatsApp');
      sockGlobal = sock;
    }
  });

  sock.ev.on('creds.update', async () => {
    await saveCreds();
    await uploadSession(auth, sessionPath, sessionId);
    console.log('💾 Session updated to Google Drive');
  });

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;
    // Auto-reply logic (optional)
  });

  return sock;
}

// Start bot and web server
startBot().then(() => {
  const app = express();
  app.use(express.json());

  app.post('/send', async (req, res) => {
    const { phone, text, token } = req.body;

    if (token !== SECRET) {
      return res.status(403).send('❌ Forbidden: Invalid token');
    }

    if (!phone || !text) {
      return res.status(400).send('❌ Missing phone or text');
    }

    try {
      await sockGlobal.sendMessage(`${phone}@s.whatsapp.net`, { text });
      res.send('✅ Message sent');
    } catch (e) {
      console.error('❌ Send failed:', e);
      res.status(500).send('❌ Send failed');
    }
  });

  app.listen(3000, () => {
    console.log('🌐 Express server running at http://localhost:3000');
  });
});
