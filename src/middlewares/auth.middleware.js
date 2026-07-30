const jwt = require("jsonwebtoken");
const tokenBlacklistModel = require("../models/blacklist.model");

async function authUser(req, res, next) {
    try {

        // ----------------------------
        // Get Token from Cookie or Header
        // ----------------------------

        const token =
            req.cookies?.token ||
            req.headers.authorization?.replace("Bearer ", "");

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication token not provided."
            });
        }

        // ----------------------------
        // Check Blacklist
        // ----------------------------

        const isBlacklisted = await tokenBlacklistModel.findOne({
            token
        });

        if (isBlacklisted) {
            return res.status(401).json({
                success: false,
                message: "Token has been blacklisted. Please login again."
            });
        }

        // ----------------------------
        // Verify JWT
        // ----------------------------

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {

        console.error("Authentication Error:", error.message);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token."
        });
    }
}

module.exports = {
    authUser
};