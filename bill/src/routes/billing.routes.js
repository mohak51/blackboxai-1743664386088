const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;
const Invoice = require('../models/invoice.model');
const auth = require('../middleware/auth');
const authMiddleware = auth;
const checkRole = auth.checkRole;

// Initialize thermal printer
const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: 'printer:THERMAL_PRINTER_NAME',
    options: {
        timeout: 5000
    },
    width: 42,
    characterSet: 'SLOVENIA',
    removeSpecialCharacters: false,
    lineCharacter: "-",
});

// Create new invoice
router.post('/create', [
    authMiddleware,
    checkRole(['admin', 'sales']),
    body('customer.name').notEmpty().withMessage('Customer name is required'),
    body('items').isArray().notEmpty().withMessage('At least one item is required'),
    body('paymentDetails.mode').isIn(['cash', 'upi', 'credit', 'split']).withMessage('Invalid payment mode')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const invoice = new Invoice({
            ...req.body,
            branch: req.user.branch,
            createdBy: req.user.userId
        });

        await invoice.save();

        res.status(201).json({
            success: true,
            invoice
        });
    } catch (error) {
        console.error('Invoice creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating invoice'
        });
    }
});

// Print invoice
router.post('/print/:invoiceId', [
    authMiddleware,
    checkRole(['admin', 'sales'])
], async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.invoiceId)
            .populate('items.product')
            .populate('branch');

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }

        // Print invoice header
        printer.alignCenter();
        printer.bold(true);
        printer.println(invoice.branch.name);
        printer.println('INVOICE');
        printer.bold(false);
        printer.drawLine();

        // Print invoice details
        printer.alignLeft();
        printer.println(`Invoice No: ${invoice.invoiceNumber}`);
        printer.println(`Date: ${invoice.createdAt.toLocaleDateString()}`);
        printer.println(`Customer: ${invoice.customer.name}`);
        if (invoice.customer.phone) {
            printer.println(`Phone: ${invoice.customer.phone}`);
        }
        printer.drawLine();

        // Print items
        printer.tableCustom([
            { text: "Item", width: 0.4 },
            { text: "Qty", width: 0.2, align: "right" },
            { text: "Price", width: 0.2, align: "right" },
            { text: "Total", width: 0.2, align: "right" }
        ]);

        invoice.items.forEach(item => {
            printer.tableCustom([
                { text: item.product.name, width: 0.4 },
                { text: item.quantity.toString(), width: 0.2, align: "right" },
                { text: item.price.toFixed(2), width: 0.2, align: "right" },
                { text: (item.quantity * item.price).toFixed(2), width: 0.2, align: "right" }
            ]);
        });

        printer.drawLine();

        // Print totals
        printer.alignRight();
        printer.println(`Subtotal: ${invoice.subtotal.toFixed(2)}`);
        printer.println(`Tax: ${invoice.tax.toFixed(2)}`);
        printer.bold(true);
        printer.println(`Total: ${invoice.total.toFixed(2)}`);
        printer.bold(false);

        // Print payment details
        printer.alignLeft();
        printer.drawLine();
        printer.println(`Payment Mode: ${invoice.paymentDetails.mode.toUpperCase()}`);
        if (invoice.paymentDetails.upiReferenceId) {
            printer.println(`UPI Ref: ${invoice.paymentDetails.upiReferenceId}`);
        }

        // Print footer
        printer.alignCenter();
        printer.drawLine();
        printer.println('Thank you for your business!');
        printer.cut();

        // Execute print
        const printResult = await printer.execute();
        
        // Update invoice printed status
        invoice.printed = true;
        await invoice.save();

        res.json({
            success: true,
            message: 'Invoice printed successfully'
        });
    } catch (error) {
        console.error('Print error:', error);
        res.status(500).json({
            success: false,
            message: 'Error printing invoice'
        });
    }
});

// Get invoice by ID
router.get('/:invoiceId', [
    authMiddleware,
    checkRole(['admin', 'sales'])
], async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.invoiceId)
            .populate('items.product')
            .populate('branch')
            .populate('createdBy', 'username');

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }

        res.json({
            success: true,
            invoice
        });
    } catch (error) {
        console.error('Get invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving invoice'
        });
    }
});

module.exports = router; 