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

  const { query } = await request.json()
  if (!query) return NextResponse.json({ error: 'Arama kelimesi gerekli' }, { status: 400 })

  try {
    // 1. Kullanıcının arama kutusuna yazdığı yazıyı vektöre (sayılara) çeviriyoruz
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    })
    const queryEmbedding = embeddingResponse.data[0].embedding

    // 2. Bu vektörü, Supabase'de yazdığımız "match_prompts" SQL fonksiyonuna gönderiyoruz
    const { data, error } = await supabase.rpc('match_prompts', {
      query_embedding: queryEmbedding,
      match_threshold: 0.3, // Benzerlik oranı (Düşürdükçe daha esnek arar)
      match_count: 12,      // Maksimum döndürülecek sonuç sayısı
      p_user_id: user.id
    })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Semantic search error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}