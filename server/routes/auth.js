const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const emailService = require('../services/emailService');
const { authLimiter, emailLimiter } = require('../middleware/rateLimiter');
const { generateTransactionId } = require('../utils/codeGenerator');

const router = express.Router();

// In-memory storage (replace with database in production)
const users = new Map();
const sessions = new Map();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Register endpoint
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Validate input
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    if (users.has(email)) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = {
      id: uuidv4(),
      name,
      email,
      phone,
      password: hashedPassword,
      verified: false,
      balance: 0,
      createdAt: new Date().toISOString()
    };

    users.set(email, user);

    // Send verification email
    await emailService.sendVerificationCode(email, name);

    res.status(201).json({
      message: 'User registered successfully. Please check your email for verification code.',
      userId: user.id
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
});

// Verify email endpoint
router.post('/verify-email', authLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    const user = users.get(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify the code
    emailService.verifyCode(email, code);

    // Mark user as verified
    user.verified = true;
    users.set(email, user);

    // Send welcome email
    await emailService.sendWelcomeEmail(email, user.name);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Email verified successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        balance: user.balance
      }
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Resend verification code
router.post('/resend-verification', emailLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = users.get(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.verified) {
      return res.status(400).json({ error: 'User is already verified' });
    }

    await emailService.sendVerificationCode(email, user.name);

    res.json({ message: 'Verification code sent successfully' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Login endpoint
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = users.get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.verified) {
      return res.status(403).json({ error: 'Please verify your email before logging in' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        balance: user.balance
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get user profile
router.get('/profile', authenticateToken, (req, res) => {
  try {
    const user = users.get(req.user.email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        balance: user.balance
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

module.exports = { router, authenticateToken, users };