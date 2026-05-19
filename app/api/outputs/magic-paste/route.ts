import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    
    if (!text) return NextResponse.json({ error: 'Text is required' }, { status: 400 });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // GPT-4o-mini bu iş için hem ışık hızında hem çok ucuz!
      messages: [
        { 
          role: "system", 
          content: `You are an intelligent parser for a SaaS app called Prompax. 
          The user is going to paste a raw chat log (e.g., from ChatGPT, Claude). This log contains BOTH the user's prompt and the AI's generated output.
          
          Your job is to separate them and return a strict JSON object with:
          - 'extracted_prompt': The exact instructions or prompt the user wrote. (Clean out timestamps or usernames).
          - 'suggested_title': A short, punchy 3-4 word title for the extracted prompt.
          - 'output_content': The final generated text/code from the AI (Clean out conversational filler like "Sure, here is the code:").
          - 'format': Pick ONE exact match from: [email, tweet, social_post, article, code, ad_copy], or if none fit, write a short 1-word custom format.
          - 'platform': Guess the platform (chatgpt, claude, gemini, deepseek), or default to 'chatgpt'.
          - 'notes': Provide a brief 1-sentence context of what this asset is about.` 
        },
        { role: "user", content: text }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    return NextResponse.json(result);
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}