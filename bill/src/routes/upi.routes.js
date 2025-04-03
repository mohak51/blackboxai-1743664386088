const express = require('express');
const router = express.Router();
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const Invoice = require('../models/invoice.model');
const auth = require('../middleware/auth');
const authMiddleware = auth;
const checkRole = auth.checkRole;

// PhonePe API configuration
const PHONEPE_API_URL = process.env.PHONEPE_API_URL || 'https://api.phonepe.com/apis/hermes';
const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
const SALT_KEY = process.env.PHONEPE_SALT_KEY;
const SALT_INDEX = process.env.PHONEPE_SALT_INDEX;

// Generate QR code for payment
router.post('/generate-qr', [
    authMiddleware,
    checkRole(['admin', 'sales']),
    body('invoiceId').notEmpty().withMessage('Invoice ID is required'),
    body('amount').isNumeric().withMessage('Valid amount is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { invoiceId, amount } = req.body;
        const invoice = await Invoice.findById(invoiceId);

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }

        // Generate unique transaction ID
        const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Prepare payload for PhonePe
        const payload = {
            merchantId: MERCHANT_ID,
            merchantTransactionId: transactionId,
            merchantUserId: invoice.createdBy.toString(),
            amount: amount * 100, // Convert to paise
            redirectUrl: `${process.env.APP_URL}/payment-callback`,
            redirectMode: "POST",
            callbackUrl: `${process.env.APP_URL}/api/upi/callback`,
            mobileNumber: invoice.customer.phone,
            paymentInstrument: {
                type: "UPI_INTENT",
                targetApp: "PHONEPE"
            }
        };

        // Generate checksum
        const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
        const stringToHash = base64Payload + "/pg/v1/pay" + SALT_KEY;
        const sha256Hash = require('crypto').createHash('sha256').update(stringToHash).digest('hex');
        const finalXHeader = sha256Hash + "###" + SALT_INDEX;

        // Make API call to PhonePe
        const response = await axios.post(`${PHONEPE_API_URL}/pg/v1/pay`, {
            request: base64Payload
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-VERIFY': finalXHeader
            }
        });

        // Store transaction details in invoice
        invoice.paymentDetails.upiReferenceId = transactionId;
        await invoice.save();

        res.json({
            success: true,
            qrCode: response.data.data.instrumentResponse.redirectInfo.url,
            transactionId
        });
    } catch (error) {
        console.error('QR generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating QR code'
        });
    }
});

// Verify payment status
router.post('/verify', [
    authMiddleware,
    checkRole(['admin', 'sales']),
    body('transactionId').notEmpty().withMessage('Transaction ID is required')
], async (req, res) => {
    try {
        const { transactionId } = req.body;

        // Find invoice by UPI reference ID
        const invoice = await Invoice.findOne({
            'paymentDetails.upiReferenceId': transactionId
        });

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        // Verify payment status with PhonePe
        const stringToHash = `/pg/v1/status/${MERCHANT_ID}/${transactionId}` + SALT_KEY;
        const sha256Hash = require('crypto').createHash('sha256').update(stringToHash).digest('hex');
        const finalXHeader = sha256Hash + "###" + SALT_INDEX;

        const response = await axios.get(
            `${PHONEPE_API_URL}/pg/v1/status/${MERCHANT_ID}/${transactionId}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-VERIFY': finalXHeader
                }
            }
        );

        const paymentStatus = response.data.data.state;

        // Update invoice payment status
        invoice.paymentDetails.status = paymentStatus === 'COMPLETED' ? 'completed' : 'failed';
        await invoice.save();

        res.json({
            success: true,
            status: paymentStatus,
            invoice: {
                id: invoice._id,
                invoiceNumber: invoice.invoiceNumber,
                amount: invoice.total,
                paymentStatus: invoice.paymentDetails.status
            }
        });
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying payment'
        });
    }
});

// Payment callback from PhonePe
router.post('/callback', async (req, res) => {
    try {
        const { merchantTransactionId, code, state } = req.body;

        // Find and update invoice
        const invoice = await Invoice.findOne({
            'paymentDetails.upiReferenceId': merchantTransactionId
        });

        if (invoice) {
            invoice.paymentDetails.status = state === 'COMPLETED' ? 'completed' : 'failed';
            await invoice.save();
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Callback error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing callback'
        });
    }
});

module.exports = router; 