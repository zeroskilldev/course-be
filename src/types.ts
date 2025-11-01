import { email, z } from "zod";

export const signUpSchema = z.object({
    username: z.email(),
    password: z.string().max(15),
    fullName: z.string()
})

export const signInSchema = z.object({
    username: z.email(),
    password: z.string().max(15)
})