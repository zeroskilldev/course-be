import express from "express";
import jwt from "jsonwebtoken";
import bcrypt, { hash } from "bcrypt";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY, JWT_SECRET, MONGO_URL } from "./config.js";
import { signInSchema, signUpSchema } from "./types.js";
import { UserModel } from "./db.js";
import mongoose from "mongoose";
import { Middleware } from "./middleware.js";


const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const app = express();
app.use(express.json());



app.post("/signup", async (req, res) => {
  const parsedData = signUpSchema.safeParse(req.body);

  try {

    if(parsedData.error){
      res.json(parsedData.error);
      return;
    }
    
    const hashedPass = await bcrypt.hash(parsedData.data.password, 10);

    const user = await UserModel.findOne({
      email: parsedData.data.email
    })

    if(user){
      res.json({
        msg: "User Already exists. Please signIn"
      })
      return;
    }

    await UserModel.create({
      email: parsedData.data.email,
      fullname: parsedData.data.fullName,
      password: hashedPass
    })

    res.json({
      msg: "Signed Up successfully"
    })
    
  } catch (error) {
    res.json({
      msg : "Error signing up",
      error: error
    })
  }
    
})



app.post("/signin", async (req, res) => {
  const parsedData = signInSchema.safeParse(req.body);

  try{

    if(parsedData.error){
      res.json(parsedData.error)
      return;
    }

    const user = await UserModel.findOne({
      email: parsedData.data.email
    })

    if(!user){
      res.json({
        msg : "Please singup first"
      })

      return;
    }
    
    const matched = await bcrypt.compare(parsedData.data.password, user.password);

    if(!matched){
      res.json({
        msg: "Wrong Password"
      })

      return;
    }

    const token = jwt.sign({
      userId : user._id
    }, JWT_SECRET);

    res.json({
      token
    })

  } catch(e){
    res.json(e);
  }

})



app.post("/generate-course", Middleware, async (req, res) => {
    const { courseName,duration } = req.body;

    const prompt = `
    You are an expert course creator and educator.
    Create a structured ${duration}-day learning plan for a beginner who wants to learn "${courseName}".
    Return the response strictly in JSON format like this:
    {
      "courseName": "${courseName}",
      "duration": ${duration},
      "days": [
        {
          "day": 1,
          "title": "",
          "topics": [],
          "objectives": [],
          "activities": [],
          "resources": []
        }
      ]
    }
  `;
    
    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
    });

    
    if(!result.text){
        res.json("Error generating response");
        return;
    }
    const finalRes = result.text.slice(7,-3);

    try {
        const jsonRes = JSON.parse(finalRes);
        res.json(jsonRes);
    }
    catch(e){
        res.json(e);
    }

})



async function main() {
    await mongoose.connect(MONGO_URL);

    app.listen(3000, () => {
        console.log("Running on port 3000")
    })
    
}

main();