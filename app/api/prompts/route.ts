import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

// OpenAI Kurulumu
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function GET() {
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

  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

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

  // Ücretsiz plan kontrolü (50 limit)
  const { count } = await supabase
    .from('prompts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) >= 50) {
    return NextResponse.json({ error: 'FREE_LIMIT_REACHED' }, { status: 403 })
  }

  const body = await request.json()
  const { title, content, platform, category, collection_id } = body

  // YENİ: OpenAI ile Embedding (Anlamsal Vektör) Üretimi
  let embedding = null
  try {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small', // Hızlı ve ucuz olan yeni nesil model
      input: `${title} - ${content}`, // Başlık ve içeriği birleştirip haritalıyoruz
    })
    embedding = embeddingResponse.data[0].embedding
  } catch (err) {
    console.error('Embedding hatası:', err)
  }

  const { data, error } = await supabase
    .from('prompts')
    .insert({ 
      title, 
      content, 
      platform: platform || 'other', 
      category: category || 'general',
      collection_id: collection_id || null,
      user_id: user.id,
      embedding // Ürettiğimiz haritayı veritabanına yazıyoruz
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}