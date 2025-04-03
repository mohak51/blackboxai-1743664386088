const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        minlength: 3,
        maxlength: 5
    },
    address: {
        street: String,
        city: String,
        state: String,
        postalCode: String,
        country: {
            type: String,
            default: 'India'
        }
    },
    contact: {
        phone: String,
        email: String
    },
    isActive: {
        type: Boolean,
        default: true
    },
    invoiceCounter: {
        type: Number,
        default: 1
    }
}, {
    timestamps: true
});

const Branch = mongoose.model('Branch', branchSchema);

module.exports = Branch;