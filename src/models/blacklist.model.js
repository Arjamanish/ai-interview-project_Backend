const mongoose = require("mongoose")


const blacklistTokenSchema = new mongoose.Schema({
    token: {
        type: String,
        required:[true, "Token is required to added in the blacklist"]
    }
},{
    timestamps: true
})

blacklistTokenSchema.index({ token: 1 });

const tokenBlacklistModel = mongoose.model("blacklistToken", blacklistTokenSchema);

module.exports = tokenBlacklistModel;