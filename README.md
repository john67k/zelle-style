# Zelle-Style Payment Web App

A complete mobile-first Progressive Web App (PWA) for instant peer-to-peer payments with robust email verification, Gmail-compatible receipts, and comprehensive admin tooling.

## 🚀 Features

- **Progressive Web App (PWA)**: Installable on mobile devices with offline support
- **Robust Email Verification**: Blocks payments until users are verified
- **Gmail-Compatible Receipts**: HTML + plain text receipts sent to both parties
- **Admin Email Management**: Dashboard for monitoring and manual retry of failed emails
- **Mobile-First Design**: Fully responsive and accessible on all devices
- **Security Hardened**: BCrypt password hashing, JWT authentication, rate limiting, CSRF protection
- **Exponential Backoff**: Failed emails automatically retried up to 3 times
- **Configurable API**: No hard-coded URLs, environment-based configuration

## 📋 Prerequisites

- Node.js 16+ and npm
- SendGrid account for email delivery
- Modern web browser with PWA support

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/john67k/zelle-style.git
cd zelle-style
```

### 2. Backend Setup

```bash
cd server
npm install
cp ../.env.example .env
```

### 3. Frontend Setup

```bash
cd ..
npm install
```

### 4. Environment Configuration

Edit `server/.env` with your configuration:

```env
# SendGrid Configuration (REQUIRED)
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=Zelle

# JWT Configuration (REQUIRED)
JWT_SECRET=your_very_secure_random_jwt_secret_minimum_32_characters

# Database Configuration (Optional - uses in-memory storage if not provided)
DATABASE_URL=postgresql://user:password@localhost:5432/zelle_db

# Server Configuration
PORT=3001
NODE_ENV=development

# Domain Configuration
DOMAIN=yourdomain.com

# Admin Configuration (Email addresses that can access admin dashboard)
ADMIN_EMAILS=admin@yourdomain.com,admin2@yourdomain.com

# Rate Limiting Configuration (Optional)
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX=5
EMAIL_RATE_LIMIT_MAX=10
```

## 📧 Email System Setup

### SendGrid Configuration

1. **Create SendGrid Account**: Sign up at [SendGrid.com](https://sendgrid.com)

2. **Generate API Key**:
   - Go to Settings → API Keys
   - Create new API key with "Full Access" or "Mail Send" permissions
   - Add to your `.env` file as `SENDGRID_API_KEY`

3. **Domain Authentication** (Production):
   - Go to Settings → Sender Authentication
   - Authenticate your domain
   - Add required DNS records (SPF, DKIM, DMARC)

4. **Email Templates** (Optional):
   - Use dynamic templates for branded emails
   - Update template IDs in `server/config/email.js`

### DNS Configuration for Production

Add these DNS records to your domain:

```
# SPF Record
Type: TXT
Name: @
Value: v=spf1 include:sendgrid.net ~all

# DMARC Record
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com

# DKIM Records (provided by SendGrid after domain verification)
Type: CNAME
Name: s1._domainkey
Value: [provided by SendGrid]
```

## 🚀 Development

### Start Backend Server

```bash
cd server
npm run dev  # Uses nodemon for auto-restart
```

### Start Frontend (for Astro docs)

```bash
npm run dev
```

### Access the Application

- **Main App**: http://localhost:3001 (served by Express)
- **Frontend PWA**: Open `docs/index.html` in browser or serve via web server
- **Astro Docs**: http://localhost:4321 (development documentation)

## 📱 PWA Installation

### Mobile Installation

1. Open the app in mobile browser
2. Look for "Install App" prompt or
3. Use browser's "Add to Home Screen" option

### Desktop Installation

1. Open in Chrome/Edge
2. Click install icon in address bar
3. Follow browser prompts

## 🔒 Security Features

### Authentication & Authorization
- **Password Hashing**: BCrypt with salt rounds
- **JWT Tokens**: Secure token-based authentication
- **Email Verification**: Required before any transactions
- **Admin Role Check**: Environment-based admin email verification

### Rate Limiting
- **General API**: 100 requests per 15 minutes per IP
- **Auth Endpoints**: 5 requests per 15 minutes per IP  
- **Email Endpoints**: 10 requests per hour per IP
- **Verification Emails**: 3 per hour per email address

### Data Protection
- **HTTPS Enforcement**: Automatic redirect in production
- **CORS Configuration**: Restricted origin access
- **Helmet Security**: Security headers and CSP
- **Input Validation**: Comprehensive server-side validation

## 🔧 API Documentation

### Base URLs
- **Development**: `http://localhost:3001/api`
- **Production**: `https://yourdomain.com/api`

### Authentication Endpoints

#### Register User
```
POST /auth/register
{
  "name": "John Doe",
  "email": "john@example.com", 
  "phone": "+1234567890",
  "password": "securepassword123"
}
```

#### Verify Email
```
POST /auth/verify-email
{
  "email": "john@example.com",
  "code": "123456"
}
```

#### Login
```
POST /auth/login
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

### Transaction Endpoints

#### Send Money
```
POST /transactions/send
Authorization: Bearer <jwt_token>
{
  "recipientEmail": "recipient@example.com",
  "amount": 50.00,
  "note": "Payment for lunch"
}
```

#### Request Money
```
POST /transactions/request
Authorization: Bearer <jwt_token>
{
  "requesteeEmail": "requestee@example.com", 
  "amount": 25.00,
  "note": "Split dinner bill"
}
```

#### Transaction History
```
GET /transactions/history
Authorization: Bearer <jwt_token>
```

### Admin Endpoints

#### Email Statistics
```
GET /admin/emails/stats
Authorization: Bearer <admin_jwt_token>
```

#### Failed Emails
```
GET /admin/emails/failed
Authorization: Bearer <admin_jwt_token>
```

#### Retry Failed Email
```
POST /admin/emails/retry/:emailId
Authorization: Bearer <admin_jwt_token>
```

## 📊 Admin Dashboard

### Access Requirements
- Valid JWT token from verified user
- Email address listed in `ADMIN_EMAILS` environment variable

### Features
- **Email Statistics**: Success/failure rates by type
- **Failed Email Management**: View and retry failed emails
- **Email Logs**: Detailed sending history with error details
- **Manual Email Testing**: Send test emails for debugging

### Admin Access

1. Register/login with admin email address
2. Access admin endpoints via API calls
3. Use frontend admin section (if implemented)

## 🧪 Testing

### Run Backend Tests
```bash
cd server
npm test
```

### Manual Testing Checklist

#### Email Testing
```bash
# Test verification email
curl -X POST http://localhost:3001/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"type": "verification", "email": "test@example.com", "name": "Test User"}'

# Test receipt email  
curl -X POST http://localhost:3001/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"type": "receipt", "email": "test@example.com", "name": "Test User"}'
```

#### API Health Check
```bash
curl http://localhost:3001/health
```

## 🚀 Production Deployment

### Environment Setup

1. **Set Production Environment Variables**:
```bash
export NODE_ENV=production
export SENDGRID_API_KEY=your_production_key
export JWT_SECRET=your_secure_production_secret
export DOMAIN=yourdomain.com
export PORT=3001
```

2. **SSL/TLS Certificate**: Configure HTTPS (Let's Encrypt recommended)

3. **Database**: Replace in-memory storage with PostgreSQL/MongoDB

4. **Process Management**: Use PM2 or similar for production process management

5. **Reverse Proxy**: Configure Nginx for SSL termination and load balancing

### Build and Deploy

```bash
# Build frontend assets
npm run build

# Start production server
cd server
npm start
```

### Production Security Checklist

- [ ] HTTPS enforced with valid SSL certificate
- [ ] Environment variables secured (no .env in version control)
- [ ] Database secured with strong authentication
- [ ] Rate limiting configured appropriately
- [ ] Admin access restricted to authorized emails
- [ ] SendGrid domain authentication completed
- [ ] Monitoring and logging configured
- [ ] Backup strategy implemented

## 🔍 Troubleshooting

### Common Issues

#### Emails Going to Spam
- **Verify SPF/DKIM/DMARC records**: Use DNS checker tools
- **Check SendGrid reputation**: Monitor dashboard analytics
- **Avoid spam trigger words**: Review email templates
- **Warm up domain**: Start with low volume

#### Email Sending Failures
- **Check API key permissions**: Verify SendGrid API key scope
- **Monitor rate limits**: SendGrid has sending limits
- **Review error logs**: Check server logs for detailed errors
- **Test with curl**: Use test endpoints for debugging

#### PWA Installation Issues
- **HTTPS Required**: PWA requires secure context
- **Manifest validation**: Use browser dev tools to check manifest
- **Service worker errors**: Check console for registration errors
- **Cache issues**: Clear browser cache and try again

#### Authentication Problems
- **JWT secret**: Ensure JWT_SECRET is properly set
- **Token expiration**: Tokens expire after 24 hours
- **Email verification**: Users must verify before transactions
- **Rate limiting**: Check if user is being rate limited

### Debug Mode

Set `NODE_ENV=development` for:
- Detailed error messages
- Test email endpoints  
- Reduced security for debugging
- Verbose logging

### Email Deliverability Testing

1. **Mail Tester**: Send test email to check@mail-tester.com
2. **SendGrid Analytics**: Monitor delivery rates in dashboard
3. **Google Postmaster Tools**: Monitor Gmail delivery
4. **Manual Testing**: Test with various email providers

## 📸 Screenshots & QA Artifacts

### User Flow Screenshots

1. **Home Page**: Landing page with call-to-action
2. **Registration**: User signup form with validation
3. **Email Verification**: Verification code input screen
4. **Dashboard**: Main app interface after login
5. **Send Money**: Payment form with confirmation
6. **Receipt**: Payment confirmation and receipt
7. **PWA Install**: Installation prompt and home screen icon

### QA Testing Checklist

#### User Registration & Verification
- [ ] Registration form validates all required fields
- [ ] Password strength requirements enforced
- [ ] Verification email sent immediately
- [ ] Email verification blocks payments until verified
- [ ] Welcome email sent after verification
- [ ] Rate limiting prevents spam verification requests

#### Payment Flow
- [ ] Send money form validates recipient and amount
- [ ] Confirmation screen shows transaction details
- [ ] Payment blocked for unverified users
- [ ] Insufficient funds error handled gracefully
- [ ] Success state shows updated balance
- [ ] Receipts sent to both sender and recipient
- [ ] Transaction appears in history

#### Email System
- [ ] All emails include both HTML and plain text versions
- [ ] Gmail displays emails correctly
- [ ] Failed emails logged and retried with exponential backoff
- [ ] Admin can view failed emails and manually retry
- [ ] Rate limiting prevents email abuse

#### PWA Features  
- [ ] App installable on mobile devices
- [ ] Offline mode displays appropriate messaging
- [ ] Service worker caches static assets
- [ ] App icons display correctly on home screen
- [ ] Manifest.json validates without errors

#### Security & Performance
- [ ] HTTPS enforced in production
- [ ] Rate limiting active on all endpoints
- [ ] Admin endpoints restricted to authorized users
- [ ] Passwords hashed with BCrypt
- [ ] JWT tokens expire appropriately
- [ ] CORS configured for production domains

#### Cross-Browser Testing
- [ ] Chrome (desktop & mobile)
- [ ] Safari (desktop & mobile)
- [ ] Firefox (desktop & mobile)  
- [ ] Edge (desktop)
- [ ] PWA installation works on all platforms

#### Accessibility
- [ ] Keyboard navigation functional
- [ ] Screen reader compatible
- [ ] Color contrast meets WCAG standards
- [ ] Touch targets appropriately sized
- [ ] Form labels properly associated

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Full API Documentation](docs/API_DOCUMENTATION.md)
- **Email Setup**: [Email System Guide](docs/EMAIL_SETUP.md)
- **Issues**: [GitHub Issues](https://github.com/john67k/zelle-style/issues)
- **SendGrid Support**: Available through SendGrid dashboard

---

**Made with ❤️ for secure, instant payments**