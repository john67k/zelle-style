# Email System Setup Guide

This guide will help you set up the email system with SendGrid, configure DNS records, and ensure high deliverability.

## 1. SendGrid Setup

### Create SendGrid Account
1. Go to [SendGrid](https://sendgrid.com) and create an account
2. Verify your account via email
3. Complete the setup wizard

### Generate API Key
1. Go to Settings > API Keys
2. Click "Create API Key"
3. Choose "Restricted Access"
4. Grant the following permissions:
   - Mail Send: Full Access
   - Template Engine: Read Access (if using dynamic templates)
5. Copy the API key and add it to your `.env` file

### Domain Authentication (Critical for Deliverability)
1. Go to Settings > Sender Authentication
2. Click "Authenticate Your Domain"
3. Enter your domain (e.g., `yourdomain.com`)
4. Choose your DNS host
5. Add the provided DNS records to your domain

## 2. DNS Configuration

### Required DNS Records

Add these records to your domain's DNS settings:

#### SPF Record
```
Type: TXT
Name: @
Value: v=spf1 include:sendgrid.net ~all
```

#### DKIM Records
SendGrid will provide you with specific DKIM records. They'll look like:
```
Type: CNAME
Name: s1._domainkey
Value: s1.domainkey.u1234567.wl123.sendgrid.net

Type: CNAME
Name: s2._domainkey
Value: s2.domainkey.u1234567.wl123.sendgrid.net
```

#### DMARC Record
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com; ruf=mailto:dmarc@yourdomain.com; fo=1
```

### Verification
1. After adding DNS records, return to SendGrid
2. Click "Verify" on your domain authentication
3. Wait for verification (can take up to 48 hours)

## 3. Environment Variables

Create a `.env` file in your server directory:

```env
# SendGrid Configuration
SENDGRID_API_KEY=SG.your_api_key_here
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=Zelle

# JWT Configuration
JWT_SECRET=your_very_secure_jwt_secret_here

# Server Configuration
PORT=3001
NODE_ENV=development

# Domain Configuration
DOMAIN=yourdomain.com
```

## 4. Email Templates

### Option 1: HTML Templates (Current Implementation)
The system includes built-in HTML templates for:
- Verification codes
- Transaction receipts
- Welcome emails

### Option 2: SendGrid Dynamic Templates (Recommended for Production)
1. Go to Email API > Dynamic Templates
2. Create templates for each email type
3. Update the template IDs in `server/config/email.js`
4. Uncomment the dynamic template code in `emailService.js`

## 5. Testing Email Deliverability

### Test Endpoint
Use the test endpoint to verify emails are working:

```bash
curl -X POST http://localhost:3001/api/test-email \
  -H "Content-Type: application/json" \
  -d '{
    "type": "verification",
    "email": "test@example.com",
    "name": "Test User"
  }'
```

### Deliverability Tools
1. **Mail Tester**: Send a test email to check@mail-tester.com
2. **SendGrid Analytics**: Monitor delivery rates in SendGrid dashboard
3. **Google Postmaster Tools**: Monitor Gmail delivery
4. **Microsoft SNDS**: Monitor Outlook delivery

## 6. Production Considerations

### Security
- Never expose API keys in frontend code
- Use environment variables for all sensitive data
- Implement proper rate limiting
- Use HTTPS for all API endpoints

### Monitoring
- Set up SendGrid webhooks for delivery events
- Monitor bounce and spam rates
- Set up alerts for high bounce rates
- Log all email sending attempts

### Compliance
- Include unsubscribe links in marketing emails
- Respect user preferences
- Follow CAN-SPAM Act guidelines
- Implement proper data retention policies

## 7. Rate Limiting Configuration

The system implements several rate limits:

- **Verification emails**: 3 per hour per email address
- **General API**: 100 requests per 15 minutes per IP
- **Auth endpoints**: 5 requests per 15 minutes per IP
- **Email endpoints**: 10 requests per hour per IP

## 8. Troubleshooting

### Common Issues

#### Emails Going to Spam
- Verify SPF, DKIM, and DMARC records
- Check sender reputation
- Avoid spam trigger words
- Maintain good sending practices

#### DNS Verification Failing
- Wait up to 48 hours for DNS propagation
- Use DNS checker tools to verify records
- Ensure records are added to the correct domain

#### API Key Issues
- Verify API key permissions
- Check for typos in environment variables
- Ensure API key is not expired

### Debug Mode
Set `NODE_ENV=development` to enable detailed error messages and test endpoints.

## 9. Scaling Considerations

### High Volume Sending
- Consider SendGrid's dedicated IP options
- Implement email queuing with Redis/Bull
- Use multiple API keys for load distribution
- Monitor sending reputation closely

### Database Integration
Replace in-memory storage with:
- PostgreSQL for user data
- Redis for verification codes and rate limiting
- MongoDB for transaction logs

## 10. Support

- SendGrid Documentation: https://docs.sendgrid.com/
- SendGrid Support: Available through dashboard
- DNS Tools: Use tools like dig, nslookup for troubleshooting