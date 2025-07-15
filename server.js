import baileys from '@whiskeysockets/baileys';
import express from 'express';
import qrcode from 'qrcode-terminal';

const { makeWASocket, useMultiFileAuthState } = baileys;

const app = express();
app.use(express.json());

const SECRET = process.env.SECRET || 'glowwe-secret';
const PORT = process.env.PORT;

// WhatsApp session with persistent multi-file auth
const { state, saveCreds } = await useMultiFileAuthState('./auth');

let sock;
let isReady = false;

async function startSocket() {
  sock = makeWASocket({ auth: state });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, qr }) => {
    if (connection === 'open') {
      isReady = true;
      console.log('✅ WhatsApp connection ready');
    } else if (connection === 'close') {
      isReady = false;
      console.log('❌ WhatsApp connection closed, retrying...');
      startSocket();
    }

    if (qr) {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
      console.log('📱  Scan this QR to log in →', qrUrl);
    }
  });
}

await startSocket();

// POST /send route to send WhatsApp message
app.post('/send', async (req, res) => {
  const { phone, text, token } = req.body;
  if (token !== SECRET) return res.status(403).json({ error: 'Invalid token' });
  if (!isReady) return res.status(503).json({ error: 'WhatsApp not connected yet' });

  try {
    await sock.sendMessage(`${phone}@s.whatsapp.net`, { text });
    return res.json({ status: 'sent' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 WhatsApp bot running on port ${PORT}`));
