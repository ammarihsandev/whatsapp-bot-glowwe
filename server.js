import * as baileys from '@whiskeysockets/baileys';
import express from 'express';

const { makeWASocket, useMultiFileAuthState } = baileys;
const app = express();
app.use(express.json());

const SECRET = 'glowwe-secret';

const { state, saveCreds } = await useMultiFileAuthState('auth');
const sock = makeWASocket({ auth: state });
sock.ev.on('creds.update', saveCreds);

app.post('/send', async (req, res) => {
  const { phone, text, token } = req.body;
  if (token !== SECRET) return res.status(403).json({ error: 'Invalid token' });

  try {
    await sock.sendMessage(`${phone}@s.whatsapp.net`, { text });
    res.json({ status: 'sent' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));
