declare module "captcha.json" {
    questions: {
        question: string,
        regex: string,
        options: string[]
    }[]
}