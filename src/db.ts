import mongoose, { model } from "mongoose";

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;


const UserSchema = new Schema({
    fullname: {type: String, required: true},
    email:    {type: String, unique: true, required: true},
    password: {type: String, required: true},
})

// const CourseSchema = new Schema({
//     user: {
//         type: ObjectId,
//         ref: "User",
//         required: true,
//     },

//     duration: {type: Number, required: true},
//     name: {type: String, required: true},
//     content: [
//         {
//             day: Number,
//             topic: String,
//             description: String,
//         },
//     ],
// });


export const UserModel = model("User", UserSchema)
// export const CourseModel = model("Course", CourseSchema)