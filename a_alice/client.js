const axios = require('axios');

async function initiatePaymentFlow() {
  const requestBody = {
    amount: 100000,
    creditor_pubkey: 'pubkey_B', // Replace with real B pubkey
    recipient_invoice: 'lnbc1...Z', // Replace with actual invoice from Z
  };

  try {
    const response = await axios.post('http://localhost:3001/issue-note', requestBody);
    console.log('📝 Promissory note issued:', response.data.note);

    const noteToForward = response.data.note;
    const bResponse = await axios.post('http://localhost:3002/receive-note', noteToForward);
    console.log('✅ Final payment response from B:', bResponse.data);
  } catch (err) {
    console.error('❌ Error in flow:', err.message);
  }
}

initiatePaymentFlow();