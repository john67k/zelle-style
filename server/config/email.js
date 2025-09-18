const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const emailConfig = {
  from: {
    email: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
    name: process.env.FROM_NAME || 'Zelle'
  },
  templates: {
    verification: 'd-your-verification-template-id',
    receipt: 'd-your-receipt-template-id',
    welcome: 'd-your-welcome-template-id'
  }
};

module.exports = { sgMail, emailConfig };