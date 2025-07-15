import pkg from '@whiskeysockets/baileys';
import express from 'express';
import qrcode from 'qrcode-terminal';

const { makeWASocket, useSingleFileAuthState } = pkg;

const app = express();
app.use(express.json());

const SECRET = process.env.SECRET || 'glowwe-secret';
const PORT = process.env.PORT;

// WhatsApp session with persistent auth
const { state, saveState } = await useSingleFileAuthState('./auth.json');
const sock = makeWASocket({ auth: state });
sock.ev.on('creds.update', saveState);

// Show QR in Render logs
sock.ev.on('connection.update', ({ qr }) => {
  if (qr) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
    console.log('📱  Scan this QR to log in →', qrUrl);
  }
});

// POST /send route to send WhatsApp message
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

app.listen(PORT, () => console.log(`🚀 WhatsApp bot running on port ${PORT}`));
