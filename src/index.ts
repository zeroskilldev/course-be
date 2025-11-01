import express from "express";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from "./config.ts";


const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const app = express();
app.use(express.json());



// app.post("/signup", (req, res) => {
//     try{
//         const parsedData = signUpSchema.safeParse(req.body);

//         if(parsedData.success){
//             // Storing user credentials in db

//         }
//     }
//     catch(e){
//         console.log(e)
//     }


    
// })



// app.post("/signin", (req, res) => {

// })



app.post("/generate-course", async (req, res) => {
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
    // await 

    app.listen(3000, () => {
        console.log("Running on port 3000")
    })
    
}

main();