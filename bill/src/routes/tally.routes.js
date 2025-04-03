const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Invoice = require('../models/invoice.model');
const auth = require('../middleware/auth');
const authMiddleware = auth;
const checkRole = auth.checkRole;
const moment = require('moment');
const fs = require('fs');
const path = require('path');

// Export sales data to Tally format
router.post('/export', [
    authMiddleware,
    checkRole(['admin']),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').isISO8601().withMessage('Valid end date is required')
], async (req, res) => {
    try {
        const { startDate, endDate, branch } = req.body;
        const query = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            },
            tallyExported: false
        };

        if (branch) {
            query.branch = branch;
        }

        const invoices = await Invoice.find(query)
            .populate('branch', 'name')
            .populate('items.product', 'name');

        if (invoices.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No unexported invoices found for the specified period'
            });
        }

        // Generate Tally XML format
        let tallyXML = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Import Data</TALLYREQUEST>
        <TYPE>Data</TYPE>
        <ID>Sales Import</ID>
    </HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDATA>
                <REQUESTDESC>
                    <STATICVARIABLES>
                        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                    </STATICVARIABLES>
                </REQUESTDESC>
                <REQUESTTABLE>
                    <TABLENAME>Voucher</TABLENAME>
                    <FETCHLIST>
                        <FETCH>VoucherNumber</FETCH>
                        <FETCH>Date</FETCH>
                        <FETCH>PartyName</FETCH>
                        <FETCH>Amount</FETCH>
                        <FETCH>PaymentMode</FETCH>
                    </FETCHLIST>
                    <FILTER>$$FilterType:Voucher</FILTER>
                </REQUESTTABLE>
            </REQUESTDATA>
            <IMPORTTABLE>
                <TABLENAME>Voucher</TABLENAME>
                <TABLEDATA>`;

        // Add invoice data to XML
        invoices.forEach(invoice => {
            tallyXML += `
                    <VOUCHER>
                        <VOUCHERNUMBER>${invoice.invoiceNumber}</VOUCHERNUMBER>
                        <DATE>${moment(invoice.createdAt).format('DD/MM/YYYY')}</DATE>
                        <PARTYNAME>${invoice.customer.name}</PARTYNAME>
                        <AMOUNT>${invoice.total}</AMOUNT>
                        <PAYMENTMODE>${invoice.paymentDetails.mode}</PAYMENTMODE>
                        <ITEMS>
                            ${invoice.items.map(item => `
                            <ITEM>
                                <NAME>${item.product.name}</NAME>
                                <QUANTITY>${item.quantity}</QUANTITY>
                                <RATE>${item.price}</RATE>
                                <AMOUNT>${item.quantity * item.price}</AMOUNT>
                            </ITEM>`).join('')}
                        </ITEMS>
                    </VOUCHER>`;
        });

        tallyXML += `
                </TABLEDATA>
            </IMPORTTABLE>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`;

        // Save XML file
        const fileName = `tally_export_${moment().format('YYYYMMDD_HHmmss')}.xml`;
        const filePath = path.join(__dirname, '../../exports', fileName);
        
        // Ensure exports directory exists
        if (!fs.existsSync(path.join(__dirname, '../../exports'))) {
            fs.mkdirSync(path.join(__dirname, '../../exports'));
        }

        fs.writeFileSync(filePath, tallyXML);

        // Mark invoices as exported
        await Invoice.updateMany(
            { _id: { $in: invoices.map(inv => inv._id) } },
            { $set: { tallyExported: true } }
        );

        // Send file
        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error('File download error:', err);
            }
            // Delete file after sending
            fs.unlinkSync(filePath);
        });
    } catch (error) {
        console.error('Tally export error:', error);
        res.status(500).json({
            success: false,
            message: 'Error exporting to Tally'
        });
    }
});

// Get export status
router.get('/export-status', [
    authMiddleware,
    checkRole(['admin'])
], async (req, res) => {
    try {
        const { startDate, endDate, branch } = req.query;
        const query = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        };

        if (branch) {
            query.branch = branch;
        }

        const [total, exported] = await Promise.all([
            Invoice.countDocuments(query),
            Invoice.countDocuments({ ...query, tallyExported: true })
        ]);

        res.json({
            success: true,
            total,
            exported,
            pending: total - exported
        });
    } catch (error) {
        console.error('Export status error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting export status'
        });
    }
});

module.exports = router; 