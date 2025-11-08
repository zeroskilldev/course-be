import { z } from "zod";

export const signUpSchema = z.object({
    email: z.email(),
    password: z.string().max(15),
    fullName: z.string()
})

export const signInSchema = z.object({
    email: z.email(),
    password: z.string().max(15)
})