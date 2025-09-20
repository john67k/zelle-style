const express = require('express');
const { authenticateToken, users } = require('./auth');
const emailService = require('../services/emailService');
const { generateTransactionId } = require('../utils/codeGenerator');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// In-memory storage for transactions (replace with database in production)
const transactions = new Map();

// Send money endpoint
router.post('/send', authenticateToken, apiLimiter, async (req, res) => {
  try {
    const { recipientEmail, amount, note } = req.body;
    const senderEmail = req.user.email;

    // Validate input
    if (!recipientEmail || !amount) {
      return res.status(400).json({ error: 'Recipient email and amount are required' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    // Get sender
    const sender = users.get(senderEmail);
    if (!sender) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    // Check if sender is verified - CRITICAL SECURITY CHECK
    if (!sender.verified) {
      return res.status(403).json({ 
        error: 'Please verify your email address before sending money',
        code: 'EMAIL_NOT_VERIFIED' 
      });
    }

    // Check balance
    if (sender.balance < amount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    // Get recipient (for name, but allow sending to non-users)
    const recipient = users.get(recipientEmail);
    const recipientName = recipient ? recipient.name : recipientEmail.split('@')[0];

    // Generate transaction ID
    const transactionId = generateTransactionId();
    const timestamp = new Date().toISOString();

    // Create transaction record
    const transaction = {
      id: transactionId,
      senderEmail,
      senderName: sender.name,
      recipientEmail,
      recipientName,
      amount: parseFloat(amount),
      note: note || '',
      timestamp,
      status: 'completed'
    };

    // Update sender balance
    sender.balance -= parseFloat(amount);
    users.set(senderEmail, sender);

    // Update recipient balance if they're a user
    if (recipient) {
      recipient.balance += parseFloat(amount);
      users.set(recipientEmail, recipient);
    }

    // Store transaction
    transactions.set(transactionId, transaction);

    // Send receipt emails
    try {
      // Send receipt to sender
      await emailService.sendTransactionReceipt(senderEmail, {
        ...transaction,
        type: 'sent'
      });

      // Send receipt to recipient if they're a user
      if (recipient) {
        await emailService.sendTransactionReceipt(recipientEmail, {
          ...transaction,
          type: 'received'
        });
      }
    } catch (emailError) {
      console.error('Failed to send receipt emails:', emailError);
      // Don't fail the transaction if email fails
    }

    res.json({
      message: 'Payment sent successfully',
      transaction: {
        id: transactionId,
        recipientEmail,
        recipientName,
        amount: parseFloat(amount),
        note: note || '',
        timestamp,
        status: 'completed'
      },
      newBalance: sender.balance
    });
  } catch (error) {
    console.error('Send money error:', error);
    res.status(500).json({ error: 'Failed to send money' });
  }
});

// Request money endpoint
router.post('/request', authenticateToken, apiLimiter, async (req, res) => {
  try {
    const { requesteeEmail, amount, note } = req.body;
    const requesterEmail = req.user.email;

    // Validate input
    if (!requesteeEmail || !amount) {
      return res.status(400).json({ error: 'Requestee email and amount are required' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    // Get requester
    const requester = users.get(requesterEmail);
    if (!requester) {
      return res.status(404).json({ error: 'Requester not found' });
    }

    // Check if requester is verified - CRITICAL SECURITY CHECK
    if (!requester.verified) {
      return res.status(403).json({ 
        error: 'Please verify your email address before requesting money',
        code: 'EMAIL_NOT_VERIFIED' 
      });
    }

    // Generate request ID
    const requestId = generateTransactionId();
    const timestamp = new Date().toISOString();

    // Create request record
    const request = {
      id: requestId,
      requesterEmail,
      requesterName: requester.name,
      requesteeEmail,
      amount: parseFloat(amount),
      note: note || '',
      timestamp,
      status: 'pending'
    };

    // Store request
    transactions.set(requestId, request);

    // Send request email to requestee
    try {
      const requesteeUser = users.get(requesteeEmail);
      const requesteeName = requesteeUser ? requesteeUser.name : requesteeEmail.split('@')[0];
      
      // You would send a money request email here
      // For now, we'll just log it
      console.log(`Money request sent to ${requesteeEmail} for $${amount}`);
    } catch (emailError) {
      console.error('Failed to send request email:', emailError);
    }

    res.json({
      message: 'Money request sent successfully',
      request: {
        id: requestId,
        requesteeEmail,
        amount: parseFloat(amount),
        note: note || '',
        timestamp,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Request money error:', error);
    res.status(500).json({ error: 'Failed to send money request' });
  }
});

// Get transaction history
router.get('/history', authenticateToken, (req, res) => {
  try {
    const userEmail = req.user.email;
    const userTransactions = [];

    // Get all transactions for this user
    for (const [id, transaction] of transactions) {
      if (transaction.senderEmail === userEmail || transaction.recipientEmail === userEmail) {
        const isReceived = transaction.recipientEmail === userEmail;
        userTransactions.push({
          id: transaction.id,
          type: isReceived ? 'received' : 'sent',
          name: isReceived ? transaction.senderName : transaction.recipientName,
          email: isReceived ? transaction.senderEmail : transaction.recipientEmail,
          amount: transaction.amount,
          note: transaction.note,
          timestamp: transaction.timestamp,
          status: transaction.status
        });
      }
    }

    // Sort by timestamp (newest first)
    userTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ transactions: userTransactions });
  } catch (error) {
    console.error('Transaction history error:', error);
    res.status(500).json({ error: 'Failed to get transaction history' });
  }
});

// Get transaction details
router.get('/:transactionId', authenticateToken, (req, res) => {
  try {
    const { transactionId } = req.params;
    const userEmail = req.user.email;

    const transaction = transactions.get(transactionId);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Check if user is involved in this transaction
    if (transaction.senderEmail !== userEmail && transaction.recipientEmail !== userEmail) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const isReceived = transaction.recipientEmail === userEmail;
    res.json({
      transaction: {
        id: transaction.id,
        type: isReceived ? 'received' : 'sent',
        name: isReceived ? transaction.senderName : transaction.recipientName,
        email: isReceived ? transaction.senderEmail : transaction.recipientEmail,
        amount: transaction.amount,
        note: transaction.note,
        timestamp: transaction.timestamp,
        status: transaction.status
      }
    });
  } catch (error) {
    console.error('Transaction details error:', error);
    res.status(500).json({ error: 'Failed to get transaction details' });
  }
});

module.exports = router;