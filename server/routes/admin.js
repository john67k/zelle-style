const express = require('express');
const { authenticateToken } = require('./auth');
const emailService = require('../services/emailService');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Admin middleware - check if user is admin
const requireAdmin = (req, res, next) => {
  // In production, you would check admin role from database
  // For now, using a simple email check
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',');
  
  if (!adminEmails.includes(req.user.email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
};

// Get email logs
router.get('/emails/logs', authenticateToken, requireAdmin, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = emailService.getEmailLogs(limit);
    
    res.json({
      logs,
      total: logs.length,
      summary: {
        successful: logs.filter(log => log.success).length,
        failed: logs.filter(log => !log.success).length
      }
    });
  } catch (error) {
    console.error('Error fetching email logs:', error);
    res.status(500).json({ error: 'Failed to fetch email logs' });
  }
});

// Get failed emails
router.get('/emails/failed', authenticateToken, requireAdmin, (req, res) => {
  try {
    const failedEmails = emailService.getFailedEmails();
    
    res.json({
      failedEmails,
      count: failedEmails.length
    });
  } catch (error) {
    console.error('Error fetching failed emails:', error);
    res.status(500).json({ error: 'Failed to fetch failed emails' });
  }
});

// Retry failed email
router.post('/emails/retry/:emailId', authenticateToken, requireAdmin, apiLimiter, async (req, res) => {
  try {
    const { emailId } = req.params;
    
    const result = await emailService.retryFailedEmail(emailId);
    
    res.json({
      message: 'Email retry successful',
      result
    });
  } catch (error) {
    console.error('Error retrying email:', error);
    res.status(400).json({ error: error.message });
  }
});

// Manual email send for testing
router.post('/emails/send-test', authenticateToken, requireAdmin, apiLimiter, async (req, res) => {
  try {
    const { type, email, name, transactionData } = req.body;
    
    let result;
    switch (type) {
      case 'verification':
        result = await emailService.sendVerificationCode(email, name);
        break;
      case 'welcome':
        result = await emailService.sendWelcomeEmail(email, name);
        break;
      case 'receipt':
        if (!transactionData) {
          return res.status(400).json({ error: 'Transaction data required for receipt' });
        }
        result = await emailService.sendTransactionReceipt(email, transactionData);
        break;
      default:
        return res.status(400).json({ error: 'Invalid email type' });
    }
    
    res.json({
      message: 'Test email sent successfully',
      result
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(400).json({ error: error.message });
  }
});

// Email statistics
router.get('/emails/stats', authenticateToken, requireAdmin, (req, res) => {
  try {
    const logs = emailService.getEmailLogs(1000); // Get more logs for stats
    const failedEmails = emailService.getFailedEmails();
    
    const stats = {
      total: logs.length,
      successful: logs.filter(log => log.success).length,
      failed: logs.filter(log => !log.success).length,
      pendingRetries: failedEmails.length,
      byType: {},
      recentActivity: logs.slice(0, 10)
    };
    
    // Count by email type
    logs.forEach(log => {
      if (!stats.byType[log.type]) {
        stats.byType[log.type] = { total: 0, successful: 0, failed: 0 };
      }
      stats.byType[log.type].total++;
      if (log.success) {
        stats.byType[log.type].successful++;
      } else {
        stats.byType[log.type].failed++;
      }
    });
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching email stats:', error);
    res.status(500).json({ error: 'Failed to fetch email statistics' });
  }
});

module.exports = router;