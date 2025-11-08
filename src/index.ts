import express from "express";
import jwt from "jsonwebtoken";
import bcrypt, { hash } from "bcrypt";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY, JWT_SECRET, MONGO_URL } from "./config.js";
import { signInSchema, signUpSchema } from "./types.js";
import { CourseModel, DaysModel, UserModel } from "./db.js";
import mongoose from "mongoose";
import { Middleware } from "./middleware.js";
import { object } from "zod";

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;


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
    const userId = req.userId;

    const { courseName,duration } = req.body;

    const prompt = `
    You are an expert course creator and educator.
    Create a structured ${duration}-day learning plan for a beginner who wants to learn "${courseName}".
    Return ONLY valid JSON, No explanation text.
    Return the response strictly in JSON format like this:
    {
      "courseName": "${courseName}",
      "duration": ${duration} days,
      "days": [
        {
          "day": 1,
          "title": "",
          "topics": [],
          "objectives": [],
          "resources": []
        }
      ]
    }
  `;
    
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });

    let text = result.text;

    if(!text){
      res.json("Error generating response");
      return;
    }

    text = text.replace(/```json|```/g,"").trim();

    try {

      const jsonRes = JSON.parse(text);

      await CourseModel.create({
        user: userId,
        courseName: jsonRes.courseName,
        duration: jsonRes.duration[0],
        days: jsonRes.days
      });

      res.json({
        jsonRes,
        msg: "Done"
      })

    }

    catch(e){
      console.error("Error: ", e);
      res.status(500).json({
        error: "Failed to generate course",
      });
    }

})


app.post("/generate-course/:courseId/day/:dayNumber/generate", Middleware, async(req, res) => {
  const { courseId, dayNumber } = req.params;

  const course = await CourseModel.findById(courseId);

  console.log(courseId);



  if(!course){
    res.json({
      msg: "No such course exists"
    })

    return;
  }


  const dayData = course.days[parseInt(dayNumber) - 1];

  console.log(dayData);
  
  if(!dayNumber){
    return res.json({
      msg: "Invalid day number"
    })
  }

  let prompt = `
    You are an expert educator and course designer.
    Generate detailed content for Day {{day}} of a {{duration}}-day beginner course on "{{courseName}}".

    ### Day Goal
    Help the student understand and apply today's concepts clearly.

    ### Today's Topics
    {{topics}}

    ### Learning Objectives
    {{objectives}}

    ### Provided Resources / Hints
    {{resources}}

    ### Output Format (STRICT JSON, no markdown, no extra text)
    {
      "title": "",
      "explanation": "",
      "summary": ""
    }

    ### Notes:
    - Keep tone friendly & motivating.
    - Use beginner-friendly language.
    - If code is required, explain before showing code.
`

  prompt = prompt
      .replace("{{day}}", dayNumber)
      .replace("{{duration}}", course.duration)
      .replace("{{courseName}}", course.courseName)
      .replace("{{topics}}", dayData.topics.join(", "))
      .replace("{{objectives}}", dayData.objectives.join(", "))
      .replace("{{resources}}", dayData.resources.join(", "));



  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt
  });


  if(!result.text){
    res.json({
      msg: "Error generating content for the day"
    })

    return;
  }


  let resText = result.text.slice(7, -3);
  const json = JSON.parse(resText);



  console.log(json.explanation);

  res.json({
    json
  })

})


async function main() {
    await mongoose.connect(MONGO_URL);

    app.listen(3000, () => {
        console.log("Running on port 3000")
    })
    
}

main();