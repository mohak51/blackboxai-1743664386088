# Multi-Branch Billing System

A comprehensive billing system with role-based access control, UPI integration, and Tally export functionality.

## Features

- User Authentication with JWT
- Role-Based Access Control (Admin, Sales, Inventory)
- Invoice Creation and Management
- Thermal Printer Support
- PhonePe UPI Integration
- Sales Report Generation
- Tally Integration for Data Export

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Thermal Printer (for invoice printing)
- PhonePe Merchant Account (for UPI integration)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd billing-system
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
- Copy `.env.example` to `.env`
- Update the following variables:
  - `MONGODB_URI`: Your MongoDB connection string
  - `JWT_SECRET`: Secret key for JWT token generation
  - `PHONEPE_MERCHANT_ID`: Your PhonePe merchant ID
  - `PHONEPE_SALT_KEY`: Your PhonePe salt key
  - `THERMAL_PRINTER_NAME`: Your thermal printer name

4. Start the server:
```bash
npm start
```

For development:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

### Billing
- `POST /api/billing/create` - Create new invoice
- `POST /api/billing/print/:invoiceId` - Print invoice
- `GET /api/billing/:invoiceId` - Get invoice details

### UPI Integration
- `POST /api/upi/generate-qr` - Generate UPI QR code
- `POST /api/upi/verify` - Verify payment status
- `POST /api/upi/callback` - Payment callback from PhonePe

### Reports
- `GET /api/reports/sales` - Get sales report
- `GET /api/reports/payment-analysis` - Get payment mode analysis
- `GET /api/reports/export` - Export report to CSV

### Tally Integration
- `POST /api/tally/export` - Export sales data to Tally
- `GET /api/tally/export-status` - Get export status

## Security

- JWT-based authentication
- Role-based access control
- Environment variable configuration
- Input validation
- Error handling

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License. 