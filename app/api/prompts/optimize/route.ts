import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // GELECEK İÇİN PRO KONTROLÜ (Şimdilik pasif bıraktım, ödeme sistemi gelince açacağız)
  /*
  const { data: profile } = await supabase.from('profiles').select('is_pro').eq('id', user.id).single()
  if (!profile?.is_pro) {
    return NextResponse.json({ error: 'PRO_PLAN_REQUIRED' }, { status: 403 })
  }
  */

  const { content } = await request.json()
  if (!content) return NextResponse.json({ error: 'Prompt içeriği gerekli' }, { status: 400 })

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Hızlı, ucuz ve zeki model
      response_format: { type: "json_object" }, // Kesinlikle JSON formatında yanıt vermeye zorluyoruz
messages: [
        {
          role: "system",
          content: `You are a world-class Prompt Engineer. Analyze the given prompt.
          Return a JSON strictly matching this format:
          {
            "strengths": ["Strength 1", "Strength 2"],
            "weaknesses": ["Weakness 1", "Missing detail 2"],
            "improved_prompt": "The PERFECT version of the prompt, rewritten to get the best, most consistent, and professional output from an AI model. Clarify variables (e.g., [Product Name]), add role and context."
          }
          Your entire response MUST be in English, regardless of the input language.`
        },
        {
          role: "user",
          content: `Prompt to optimize: \n\n${content}`
        }
      ]
    })

    const resultString = completion.choices[0].message.content
    if (!resultString) throw new Error("OpenAI boş yanıt döndürdü")

    const result = JSON.parse(resultString)
    
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("AI Optimization Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}