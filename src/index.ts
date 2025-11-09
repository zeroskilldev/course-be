import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY, JWT_SECRET, MONGO_URL } from "./config.js";
import { signInSchema, signUpSchema } from "./types.js";
import { CourseModel, UserModel } from "./db.js";
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


app.get("/dashboard", Middleware, async(req, res) => {
  const userId = req.userId;

  const user = await UserModel.findById(userId);

  if(!user){
    return res.json({
      msg : "No such user exist"
    })
  }

  // return the fullname email and the number of courses from here
  
  res.json({
    user
  })
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

      const user = await UserModel.findById(userId);


      if(!user){
        return res.json({
          msg : "No such user exist"
        })
      }


      const course = await CourseModel.create({
        user: userId,
        courseName: jsonRes.courseName,
        duration: jsonRes.duration[0],
        days: jsonRes.days
      });


      user.courses.push(course._id);
      await user.save();

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


  if(!course){
    res.json({
      msg: "No such course exists"
    })

    return;
  }

  const dayIndex = parseInt(dayNumber) - 1;
  const dayData = course.days[dayIndex];

  if(!dayNumber){
    return res.json({
      msg: "Invalid day number"
    })
  }


  // Will return the content if its already generated
  if(course.days[dayIndex].status === "generated"){
    console.log(course.days[dayIndex].generated);

    return res.json(course.days[dayIndex].generated)
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
    - Explain in the most simple terms so that a beginner can also understand.
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


  let resText = result.text;
  const cleanText = resText.replace(/```json|```/g, "").trim();

  const json = JSON.parse(cleanText);

  console.log(json.explanation);


  course.days[dayIndex].generated = {
    content: json.explanation,
    summary: json.summary
  }

  course.days[dayIndex].status = "generated";
  course.markModified("days");

  // embedding days in courseSchema instead of saving in daysSchema separately
  await course.save();

  res.json({
    msg: "Course generated and saved successfully"
  })

})


async function main() {
    await mongoose.connect(MONGO_URL);

    app.listen(3000, () => {
        console.log("Running on port 3000")
    })
    
}

main();