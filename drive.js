const fs = require('fs')
const path = require('path')
const { google } = require('googleapis')
const TOKEN_PATH = 'token.json'

async function authorize() {
  const credentials = require('./credentials.json')
  const { client_secret, client_id, redirect_uris } = credentials.installed
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])

  // Check if token already exists
  if (fs.existsSync(TOKEN_PATH)) {
    const token = fs.readFileSync(TOKEN_PATH)
    oAuth2Client.setCredentials(JSON.parse(token))
    return oAuth2Client
  }

  // If no token, prompt for new auth
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
  })

  console.log('📎 Authorize this app by visiting this URL:\n', authUrl)

  const readline = require('readline')
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question('Paste the code from Google here: ', (code) => {
      rl.close()
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error('❌ Error retrieving access token', err)
        oAuth2Client.setCredentials(token)
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token))
        console.log('✅ Token stored to', TOKEN_PATH)
        resolve(oAuth2Client)
      })
    })
  })
}

async function uploadSession(auth, filePath, fileId = null) {
  const drive = google.drive({ version: 'v3', auth })
  const fileMetadata = { name: 'session.json' }
  const media = { mimeType: 'application/json', body: fs.createReadStream(filePath) }

  if (fileId) {
    return drive.files.update({
      fileId,
      media,
    })
  } else {
    return drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id',
    })
  }
}

async function downloadSession(auth, destPath) {
  const drive = google.drive({ version: 'v3', auth })
  const res = await drive.files.list({
    q: "name = 'session.json'",
    fields: 'files(id, name)',
    spaces: 'drive',
  })
  const file = res.data.files[0]
  if (!file) {
    console.log('🟡 No session.json found in Drive yet.')
    return null
  }
  const dest = fs.createWriteStream(destPath)
  await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'stream' })
    .then(res => {
      return new Promise((resolve, reject) => {
        res.data
          .on('end', () => resolve(file.id))
          .on('error', reject)
          .pipe(dest)
      })
    })
  return file.id
}

module.exports = { authorize, uploadSession, downloadSession }
