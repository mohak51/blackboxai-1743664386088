const Role = require('../models/role.model');
const mongoose = require('mongoose');
require('dotenv').config();

async function initializeRoles() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const roles = [
            {
                name: 'admin',
                permissions: [
                    'manage_users',
                    'manage_invoices',
                    'view_reports',
                    'manage_inventory',
                    'manage_branches'
                ]
            },
            {
                name: 'sales',
                permissions: [
                    'create_invoices',
                    'view_invoices',
                    'process_payments'
                ]
            },
            {
                name: 'inventory',
                permissions: [
                    'manage_products',
                    'view_inventory',
                    'process_transfers'
                ]
            }
        ];

        for (const roleData of roles) {
            const existingRole = await Role.findOne({ name: roleData.name });
            if (!existingRole) {
                const role = new Role(roleData);
                await role.save();
                console.log(`Created ${role.name} role`);
            }
        }

        console.log('Role initialization complete');
        process.exit(0);
    } catch (error) {
        console.error('Error initializing roles:', error);
        process.exit(1);
    }
}

initializeRoles();