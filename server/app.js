const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { apiLimiter } = require('./middleware/rateLimiter');
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const adminRoutes = require('./routes/admin');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000', 'http://localhost:4321'],
  credentials: true
}));

// Rate limiting
app.use('/api/', apiLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes.router);
app.use('/api/transactions', transactionRoutes);
app.use('/api/admin', adminRoutes);

// Test email endpoint (remove in production)
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/test-email', async (req, res) => {
    try {
      const emailService = require('./services/emailService');
      const { type, email, name } = req.body;
      
      let result;
      switch (type) {
        case 'verification':
          result = await emailService.sendVerificationCode(email, name);
          break;
        case 'welcome':
          result = await emailService.sendWelcomeEmail(email, name);
          break;
        case 'receipt':
          result = await emailService.sendTransactionReceipt(email, {
            recipientName: 'Test Recipient',
            recipientEmail: 'test@example.com',
            amount: 50.00,
            transactionId: 'TX-TEST123',
            timestamp: new Date().toISOString(),
            note: 'Test transaction',
            type: 'sent',
            senderName: name
          });
          break;
        default:
          return res.status(400).json({ error: 'Invalid email type' });
      }
      
      res.json({ message: 'Test email sent successfully', result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Validate required environment variables
  const requiredEnvVars = ['SENDGRID_API_KEY', 'JWT_SECRET', 'FROM_EMAIL'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn('⚠️  Missing environment variables:', missingVars.join(', '));
    console.warn('⚠️  Please check your .env file');
  } else {
    console.log('✅ All required environment variables are set');
  }
});

module.exports = app;