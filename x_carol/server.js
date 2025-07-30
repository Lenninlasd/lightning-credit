const express = require('express');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const bitcoin = require('bitcoinjs-lib');
const tinysecp = require('tiny-secp256k1');
const ECPairFactory = require('ecpair').default;

bitcoin.initEccLib(tinysecp);
const ECPair = ECPairFactory(tinysecp);


const app = express();
app.use(express.json());

// Mock private key of node X (DO NOT use in production)
const keyPair = ECPair.makeRandom();
const publicKey = Buffer.from(keyPair.publicKey).toString('hex');

// Endpoint that issues the promissory note
app.post('/issue-note', (req, res) => {
  const { amount, creditor_pubkey, recipient_invoice } = req.body;

  if (!amount || !creditor_pubkey || !recipient_invoice) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const note = {
    id: uuidv4(),
    issuer_pubkey: publicKey,
    creditor_pubkey,
    amount,
    invoice: recipient_invoice,
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hora
  };

  // Signed Note
  const noteString = JSON.stringify(note);
  const hash = bitcoin.crypto.sha256(Buffer.from(noteString));
  const signature = Buffer.from(keyPair.sign(hash)).toString('hex');

  const signedNote = { ...note, signature };

  // fs.writeFileSync('promissory_note_output.json', JSON.stringify(signedNote, null, 2));

  console.log('✅ Promissory note issued and saved.');

  res.status(200).json({ message: 'Note created', note: signedNote });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Node X REST server running on http://localhost:${PORT}`);
});
