const expressB = require('express');
const fsB = require('fs');
const bitcoinB = require('bitcoinjs-lib');
const eccB = require('tiny-secp256k1');
const ECPairFactoryB = require('ecpair').default;
const ECPairB = ECPairFactoryB(eccB);
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const appB = expressB();
appB.use(expressB.json());

// Load TLS and macaroon
const lndCert = fsB.readFileSync(path.resolve(__dirname, '../tls.cert'));
const macaroon = fsB.readFileSync(path.resolve(__dirname, '../admin.macaroon')).toString('hex');

const credentials = grpc.credentials.createSsl(lndCert);
const metadata = new grpc.Metadata();
metadata.add('macaroon', macaroon);
const macaroonCreds = grpc.credentials.createFromMetadataGenerator((params, callback) => {
  callback(null, metadata);
});
const combinedCreds = grpc.credentials.combineChannelCredentials(credentials, macaroonCreds);

const packageDefinition = protoLoader.loadSync(
  path.resolve(__dirname, '../rpc.proto'),
  { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
);
const lnrpc = grpc.loadPackageDefinition(packageDefinition).lnrpc;
const lnd = new lnrpc.Lightning('localhost:10009', combinedCreds); // Adjust to Polar port if needed

// POST /receive-note — verifies and pays invoice
appB.post('/receive-note', (req, res) => {
  const note = req.body;
  const { signature, issuer_pubkey, invoice, ...originalData } = note;

  const noteString = JSON.stringify(originalData);
  const hash = bitcoinB.crypto.sha256(Buffer.from(noteString));
  const sigBuffer = Buffer.from(signature, 'hex');
  const pubKeyBuffer = Buffer.from(issuer_pubkey, 'hex');

  const key = ECPairB.fromPublicKey(pubKeyBuffer);
  const isValid = key.verify(hash, sigBuffer);

  if (!isValid) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  console.log('✅ Valid note received from issuer. Paying invoice via LND...');

  lnd.sendPaymentSync({ payment_request: invoice }, (err, response) => {
    if (err || response.payment_error) {
      console.error('❌ Payment failed:', err || response.payment_error);
      return res.status(500).json({ error: 'Payment failed' });
    }

    console.log('✅ Invoice paid via LND');
    res.status(200).json({ message: 'Invoice paid', preimage: response.payment_preimage.toString('hex') });
  });
});

appB.listen(3002, () => {
  console.log('💰 Node B running at http://localhost:3002');
});
