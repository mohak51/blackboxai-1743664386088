const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    invoiceNumber: {
        type: String,
        required: true,
        unique: true
    },
    customer: {
        name: {
            type: String,
            required: true
        },
        phone: String,
        email: String,
        address: String
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true
        },
        discount: {
            type: Number,
            default: 0
        }
    }],
    subtotal: {
        type: Number,
        required: true
    },
    tax: {
        type: Number,
        default: 0
    },
    total: {
        type: Number,
        required: true
    },
    paymentDetails: {
        mode: {
            type: String,
            enum: ['cash', 'upi', 'credit', 'split'],
            required: true
        },
        upiReferenceId: String,
        cashAmount: Number,
        upiAmount: Number,
        creditAmount: Number,
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending'
        }
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    printed: {
        type: Boolean,
        default: false
    },
    tallyExported: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Generate branch-specific invoice number
invoiceSchema.pre('save', async function(next) {
    if (this.isNew) {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const branchCode = (await mongoose.model('Branch').findById(this.branch)).code;
        const count = await this.constructor.countDocuments({
            branch: this.branch,
            createdAt: {
                $gte: new Date(date.getFullYear(), date.getMonth(), 1),
                $lt: new Date(date.getFullYear(), date.getMonth() + 1, 1)
            }
        });
        this.invoiceNumber = `${branchCode}-INV-${year}${month}-${(count + 1).toString().padStart(4, '0')}`;
    }
    next();
});

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice; 