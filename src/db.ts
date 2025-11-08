import mongoose, { model } from "mongoose";

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;


const UserSchema = new Schema({
    fullname: {type: String, required: true},
    email:    {type: String, unique: true, required: true},
    password: {type: String, required: true},
})



const DaySchema = new Schema({
    day: {type: Number},
    title: String,
    topics: [String],
    objectives: [String],
    resources: [String],


    generated: {
        content: String,
        summary: String,
    },

    status: {
        type: String,
        enum: ["pending", "generated"],
        default: "pending"
    }
});


const CourseSchema = new Schema({
    user: {
        type: ObjectId,
        ref: "User",
        required: true,
    },

    duration: {type: String, required: true},
    courseName: {type: String, required: true},

    days: [DaySchema]
});


export const UserModel = model("User", UserSchema);
export const CourseModel = model("Course", CourseSchema);
export const DaysModel = model("Days", DaySchema);