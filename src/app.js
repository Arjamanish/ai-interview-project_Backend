const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
    cors({
        origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
        credentials: true,
    })
);

const authRoutes = require("./routes/auth.routes");
const interviewRouter = require("./routes/interview.routes");

app.use("/api/auth", authRoutes);
app.use("/api/interview", interviewRouter);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found.",
    });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
            success: false,
            message: "File too large. Maximum size is 3MB.",
        });
    }
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
});

module.exports = app;
