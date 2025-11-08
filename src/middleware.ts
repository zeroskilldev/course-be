import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./config.js";
import { NextFunction, Request, Response } from "express";

interface JwtPayload{
    userId : string
}


export const Middleware = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers["authorization"];

    if(token == undefined){
        res.json({
            msg: "Enter the token"
        })
        return;
    }

    try{
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

        if(!decoded){
            res.json({
                msg: "Enter correct credentials"
            })
            return;
        }

        req.userId = decoded.userId;
        next();

    } catch(e){
        res.json(e);
    }
}