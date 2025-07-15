// ---------- server.js ----------
import * as baileys from '@whiskeysockets/baileys';
import express from 'express';
import qrcode from 'qrcode-terminal';

const { makeWASocket, useMultiFileAuthState } = baileys;

const app = express();
app.use(express.json());

// 🔒 Replace with your own secure token or use Render env variable SECRET
const SECRET = process.env.SECRET || 'glowwe-secret';

// ----- WhatsApp Web session -----
const { state, saveCreds } = await useMultiFileAuthState('auth');
const sock = makeWASocket({ auth: state });
sock.ev.on('creds.update', saveCreds);

// Show QR as a clickable link in Render logs
sock.ev.on('connection.update', ({ qr }) => {
  if (qr) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
    console.log('📱  Scan this QR to log in →', qrUrl);
  }
});

// ----- REST endpoint -----
app.post('/send', async (req, res) => {
  const { phone, text, token } = req.body;
  if (token !== SECRET) return res.status(403).json({ error: 'Invalid token' });

  try {
    await sock.sendMessage(`${phone}@s.whatsapp.net`, { text });
    return res.json({ status: 'sent' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 WhatsApp bot running on port ${PORT}`));
