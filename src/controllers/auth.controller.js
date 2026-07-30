const userModel = require("../models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const tokenBlacklistModel = require("../models/blacklist.model");

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
};

function setAuthCookie(res, token, maxAgeMs) {
    res.cookie("token", token, {
        ...COOKIE_OPTIONS,
        maxAge: maxAgeMs,
    });
}

async function registerUser(req, res) {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                message: "Please provide all required fields",
            });
        }

        if (String(password).length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters",
            });
        }

        const isuserAlreadyExists = await userModel.findOne({
            $or: [{ username }, { email }],
        });

        if (isuserAlreadyExists) {
            return res.status(400).json({
                message: "Account already exists with this username or email",
            });
        }

        const hash = await bcrypt.hash(password, 10);

        const User = await userModel.create({
            username,
            email,
            password: hash,
        });

        const token = jwt.sign(
            {
                id: User._id,
                username: User.username,
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d",
            }
        );

        setAuthCookie(res, token, 24 * 60 * 60 * 1000);

        return res.status(201).json({
            message: "User registered successfully",
            user: {
                id: User._id,
                username: User.username,
                email: User.email,
            },
        });
    } catch (error) {
        console.error("Register Error:", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

async function loginController(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }

        const user = await userModel.findOne({ email });

        if (!user) {
            return res.status(400).json({
                message: "Invalid email or password",
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(400).json({
                message: "Invalid email or password",
            });
        }

        const token = jwt.sign(
            {
                id: user._id,
                username: user.username,
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d",
            }
        );

        setAuthCookie(res, token, 24 * 60 * 60 * 1000);

        return res.status(200).json({
            message: "User logged in successfully.",
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
            },
        });
    } catch (error) {
        console.error("Login Error:", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

async function logoutUserController(req, res) {
    try {
        const token = req.cookies.token;

        if (token) {
            await tokenBlacklistModel.create({ token });
        }

        res.clearCookie("token", COOKIE_OPTIONS);

        return res.status(200).json({
            message: "User logged out successfully",
        });
    } catch (error) {
        console.error("Logout Error:", error.message);
        res.clearCookie("token", COOKIE_OPTIONS);
        return res.status(200).json({
            message: "User logged out successfully",
        });
    }
}

async function getMeController(req, res) {
    try {
        const user = await userModel.findById(req.user.id).select("-password");

        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        return res.status(200).json({
            message: "User details fetched successfully",
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
            },
        });
    } catch (error) {
        console.error("GetMe Error:", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

module.exports = {
    registerusercontroller: registerUser,
    loginUserController: loginController,
    logoutUserController: logoutUserController,
    getMeController: getMeController,
};
