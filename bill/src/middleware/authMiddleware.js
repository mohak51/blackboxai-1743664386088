const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const authMiddleware = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(403).json({ error: 'No token provided' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).populate('role');
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
};

const roleMiddleware = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role.name)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    };
};

module.exports = { authMiddleware, roleMiddleware };