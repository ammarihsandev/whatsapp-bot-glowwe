import baileys from '@whiskeysockets/baileys';
import express from 'express';
import qrcode from 'qrcode-terminal';

const { makeWASocket, useMultiFileAuthState } = baileys;

const app = express();
app.use(express.json());

// 🔒 SECURE TOKEN — must be provided in Render env, not in code
const SECRET = process.env.SECRET;
if (!SECRET) {
  console.error('❌ FATAL: SECRET environment variable is not set');
  process.exit(1);
}

const PORT = process.env.PORT;

// WhatsApp session with persistent multi‑file auth
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

// POST /send route to send WhatsApp message with 10‑second timeout safeguard
app.post('/send', async (req, res) => {
  const { phone, text, token } = req.body;
  if (token !== SECRET) return res.status(403).json({ error: 'Invalid token' });
  if (!isReady)   return res.status(503).json({ error: 'WhatsApp not connected yet' });

  try {
    console.log(`📤 Sending message to ${phone}`);

    await Promise.race([
      sock.sendMessage(`${phone}@s.whatsapp.net`, { text }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed Out')), 10000))
    ]);

    return res.json({ status: 'sent' });
  } catch (err) {
    console.error('❌ Send error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 WhatsApp bot running on port ${PORT}`));
