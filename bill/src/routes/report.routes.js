const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Invoice = require('../models/invoice.model');
const auth = require('../middleware/auth');
const authMiddleware = auth;
const checkRole = auth.checkRole;
const moment = require('moment');

// Get sales report by date range
router.get('/sales', [
    authMiddleware,
    checkRole(['admin', 'sales']),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').isISO8601().withMessage('Valid end date is required')
], async (req, res) => {
    try {
        const { startDate, endDate, branch } = req.query;
        const query = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        };

        // Add branch filter if specified
        if (branch) {
            query.branch = branch;
        }

        const invoices = await Invoice.find(query)
            .populate('branch', 'name')
            .populate('createdBy', 'username');

        // Calculate summary
        const summary = {
            totalSales: 0,
            totalInvoices: invoices.length,
            paymentModeBreakdown: {
                cash: 0,
                upi: 0,
                credit: 0,
                split: 0
            },
            dailySales: {},
            branchWiseSales: {}
        };

        invoices.forEach(invoice => {
            // Total sales
            summary.totalSales += invoice.total;

            // Payment mode breakdown
            summary.paymentModeBreakdown[invoice.paymentDetails.mode] += invoice.total;

            // Daily sales
            const date = moment(invoice.createdAt).format('YYYY-MM-DD');
            if (!summary.dailySales[date]) {
                summary.dailySales[date] = 0;
            }
            summary.dailySales[date] += invoice.total;

            // Branch-wise sales
            const branchName = invoice.branch.name;
            if (!summary.branchWiseSales[branchName]) {
                summary.branchWiseSales[branchName] = 0;
            }
            summary.branchWiseSales[branchName] += invoice.total;
        });

        res.json({
            success: true,
            summary,
            invoices: invoices.map(invoice => ({
                id: invoice._id,
                invoiceNumber: invoice.invoiceNumber,
                date: invoice.createdAt,
                customer: invoice.customer.name,
                total: invoice.total,
                paymentMode: invoice.paymentDetails.mode,
                paymentStatus: invoice.paymentDetails.status,
                branch: invoice.branch.name,
                createdBy: invoice.createdBy.username
            }))
        });
    } catch (error) {
        console.error('Sales report error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating sales report'
        });
    }
});

// Get payment mode analysis
router.get('/payment-analysis', [
    authMiddleware,
    checkRole(['admin', 'sales'])
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

        const paymentAnalysis = await Invoice.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$paymentDetails.mode',
                    totalAmount: { $sum: '$total' },
                    count: { $sum: 1 },
                    successfulPayments: {
                        $sum: {
                            $cond: [{ $eq: ['$paymentDetails.status', 'completed'] }, 1, 0]
                        }
                    },
                    failedPayments: {
                        $sum: {
                            $cond: [{ $eq: ['$paymentDetails.status', 'failed'] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        res.json({
            success: true,
            paymentAnalysis: paymentAnalysis.map(mode => ({
                mode: mode._id,
                totalAmount: mode.totalAmount,
                totalTransactions: mode.count,
                successfulTransactions: mode.successfulPayments,
                failedTransactions: mode.failedPayments,
                successRate: (mode.successfulPayments / mode.count) * 100
            }))
        });
    } catch (error) {
        console.error('Payment analysis error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating payment analysis'
        });
    }
});

// Export report to CSV
router.get('/export', [
    authMiddleware,
    checkRole(['admin', 'sales'])
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

        const invoices = await Invoice.find(query)
            .populate('branch', 'name')
            .populate('createdBy', 'username');

        // Generate CSV content
        const csvHeader = 'Invoice Number,Date,Customer,Total,Payment Mode,Payment Status,Branch,Created By\n';
        const csvRows = invoices.map(invoice => {
            return `${invoice.invoiceNumber},${invoice.createdAt.toISOString()},${invoice.customer.name},${invoice.total},${invoice.paymentDetails.mode},${invoice.paymentDetails.status},${invoice.branch.name},${invoice.createdBy.username}`;
        }).join('\n');

        const csvContent = csvHeader + csvRows;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=sales-report.csv');
        res.send(csvContent);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({
            success: false,
            message: 'Error exporting report'
        });
    }
});

module.exports = router; 