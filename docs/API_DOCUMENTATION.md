# API Documentation

## Base URL
- Development: `http://localhost:3001/api`
- Production: `https://yourdomain.com/api`

## Authentication
Most endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Rate Limits
- General API: 100 requests per 15 minutes per IP
- Auth endpoints: 5 requests per 15 minutes per IP
- Email endpoints: 10 requests per hour per IP

## Endpoints

### Authentication

#### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "message": "User registered successfully. Please check your email for verification code.",
  "userId": "uuid-here"
}
```

#### POST /auth/verify-email
Verify email address with code.

**Request Body:**
```json
{
  "email": "john@example.com",
  "code": "123456"
}
```

**Response:**
```json
{
  "message": "Email verified successfully",
  "token": "jwt_token_here",
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "balance": 0
  }
}
```

#### POST /auth/resend-verification
Resend verification code.

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

#### POST /auth/login
Login to existing account.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "balance": 1250.75
  }
}
```

#### GET /auth/profile
Get user profile (requires authentication).

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "balance": 1250.75
  }
}
```

### Transactions

#### POST /transactions/send
Send money to another user (requires authentication).

**Request Body:**
```json
{
  "recipientEmail": "recipient@example.com",
  "amount": 50.00,
  "note": "Dinner payment"
}
```

**Response:**
```json
{
  "message": "Payment sent successfully",
  "transaction": {
    "id": "TX-ABC123",
    "recipientEmail": "recipient@example.com",
    "recipientName": "Jane Doe",
    "amount": 50.00,
    "note": "Dinner payment",
    "timestamp": "2025-01-27T10:30:00Z",
    "status": "completed"
  },
  "newBalance": 1200.75
}
```

#### POST /transactions/request
Request money from another user (requires authentication).

**Request Body:**
```json
{
  "requesteeEmail": "friend@example.com",
  "amount": 25.00,
  "note": "Split dinner bill"
}
```

**Response:**
```json
{
  "message": "Money request sent successfully",
  "request": {
    "id": "TX-DEF456",
    "requesteeEmail": "friend@example.com",
    "amount": 25.00,
    "note": "Split dinner bill",
    "timestamp": "2025-01-27T10:35:00Z",
    "status": "pending"
  }
}
```

#### GET /transactions/history
Get transaction history (requires authentication).

**Response:**
```json
{
  "transactions": [
    {
      "id": "TX-ABC123",
      "type": "sent",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "amount": 50.00,
      "note": "Dinner payment",
      "timestamp": "2025-01-27T10:30:00Z",
      "status": "completed"
    },
    {
      "id": "TX-GHI789",
      "type": "received",
      "name": "Bob Smith",
      "email": "bob@example.com",
      "amount": 75.00,
      "note": "Freelance work",
      "timestamp": "2025-01-26T15:20:00Z",
      "status": "completed"
    }
  ]
}
```

#### GET /transactions/:transactionId
Get specific transaction details (requires authentication).

**Response:**
```json
{
  "transaction": {
    "id": "TX-ABC123",
    "type": "sent",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "amount": 50.00,
    "note": "Dinner payment",
    "timestamp": "2025-01-27T10:30:00Z",
    "status": "completed"
  }
}
```

### Utility Endpoints

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-01-27T10:00:00Z"
}
```

#### POST /test-email (Development Only)
Test email sending functionality.

**Request Body:**
```json
{
  "type": "verification", // or "welcome", "receipt"
  "email": "test@example.com",
  "name": "Test User"
}
```

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message description"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (access denied)
- `404` - Not Found
- `409` - Conflict (resource already exists)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Email Notifications

The system automatically sends emails for:

1. **Verification Code** - When user registers
2. **Welcome Email** - When email is verified
3. **Transaction Receipt** - When money is sent/received
4. **Money Request** - When someone requests money (future feature)

### Email Features
- **Rate Limited**: Max 3 verification emails per hour per address
- **Expiration**: Verification codes expire after 10 minutes
- **Security**: Codes are single-use and attempt-limited
- **Templates**: Professional HTML templates with branding
- **Deliverability**: Configured with SPF, DKIM, and DMARC

## Frontend Integration

### Example JavaScript Usage

```javascript
// Register user
const registerUser = async (userData) => {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData)
  });
  return response.json();
};

// Send money
const sendMoney = async (transactionData, token) => {
  const response = await fetch('/api/transactions/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(transactionData)
  });
  return response.json();
};
```

### Error Handling

```javascript
const handleApiCall = async (apiFunction) => {
  try {
    const result = await apiFunction();
    if (result.error) {
      throw new Error(result.error);
    }
    return result;
  } catch (error) {
    console.error('API Error:', error.message);
    // Handle error in UI
  }
};
```