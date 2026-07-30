const mongoose = require("mongoose");

// --------------------
// Technical Questions
// --------------------

const technicalQuestionSchema = new mongoose.Schema(
    {
        question: {
            type: String,
            required: true
        },

        intention: {
            type: String,
            required: true
        },

        answer: {
            type: String,
            required: true
        }
    },
    {
        _id: false
    }
);

// --------------------
// Behavioral Questions
// --------------------

const behavioralQuestionSchema = new mongoose.Schema(
    {
        question: {
            type: String,
            required: true
        },

        intention: {
            type: String,
            required: true
        },

        answer: {
            type: String,
            required: true
        }
    },
    {
        _id: false
    }
);

// --------------------
// Skill Gaps
// --------------------

const skillGapSchema = new mongoose.Schema(
    {
        skill: {
            type: String,
            required: true
        },

        severity: {
            type: String,
            enum: ["low", "medium", "high"],
            required: true
        }
    },
    {
        _id: false
    }
);

// --------------------
// Preparation Plan
// --------------------

const preparationPlanSchema = new mongoose.Schema(
    {
        day: {
            type: Number,
            required: true
        },

        focus: [
            {
                type: String,
                required: true
            }
        ],

        tasks: [
            {
                type: String,
                required: true
            }
        ]
    },
    {
        _id: false
    }
);

// --------------------
// Interview Report
// --------------------

const interviewReportSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        resume: {
            type: String,
            required: true
        },

        selfDescription: {
            type: String,
            required: true
        },

        jobDescription: {
            type: String,
            required: true
        },

        matchScore: {
            type: Number,
            min: 0,
            max: 100,
            required: true
        },

        technicalQuestions: {
            type: [technicalQuestionSchema],
            validate: {
                validator: (value) => value.length === 10,
                message: "Exactly 10 technical questions are required."
            }
        },

        behavioralQuestions: {
            type: [behavioralQuestionSchema],
            validate: {
                validator: (value) => value.length === 10,
                message: "Exactly 10 behavioral questions are required."
            }
        },

        skillGaps: {
            type: [skillGapSchema],
            validate: {
                validator: (value) => value.length >= 5,
                message: "Minimum 5 skill gaps are required."
            }
        },

        preparationPlan: {
            type: [preparationPlanSchema],
            validate: {
                validator: (value) => value.length === 7,
                message: "Exactly 7 preparation days are required."
            }
        },
        
        title: {
            type: String,
            default: "Interview Report",
            trim: true,
        },

        atsResume: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        }
    },
    {
        timestamps: true
    }
);

interviewReportSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model(
    "InterviewReport",
    interviewReportSchema
);