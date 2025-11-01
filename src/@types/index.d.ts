import { Express } from "express";

declare global {
    namespace express {
        interface Request {
            userId: string
        }
    }
}