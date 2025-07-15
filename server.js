import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';

async function startSock () {
  // 1️⃣ load/save auth in a *folder* called “auth”
  const { state, saveCreds } = await useMultiFileAuthState('./auth');

  // 2️⃣ always connect with the latest WA‑Web version
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true       // shows QR in Render build logs
  });

  // 3️⃣ persist creds whenever they change
  sock.ev.on('creds.update', saveCreds);

  // 4️⃣ auto‑reconnect unless the session is explicitly logged out
sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
  if (connection === 'close') {
    const code = lastDisconnect?.error?.output?.statusCode;
    if (code !== DisconnectReason.loggedOut) startSock();
    else console.log('❌ Logged out. Delete auth folder to pair again.');
  } else if (connection === 'open') {
    console.log('✅ WhatsApp Web socket is up');
  }
});


  // 5️⃣ simple echo demo – reply “pong” to “ping”
  sock.ev.on('messages.upsert', ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;
    if (m.message.conversation?.toLowerCase() === 'ping') {
      sock.sendMessage(m.key.remoteJid!, { text: 'pong' });
    }
  });
}

startSock();
