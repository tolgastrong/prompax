import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// KOLEKSİYON DÜZENLEME (Edit Name & Description)
export async function PUT(request: Request, context: { params: { id: string } }) {
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

  try {
    // Next.js 15+ uyumluluğu için params'ı await ediyoruz (sürümden bağımsız güvenli kullanım)
    const params = await context.params
    const body = await request.json()
    const { name, description } = body

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const { data, error } = await supabase
      .from('collections')
      .update({ name, description })
      .eq('id', params.id)
      .eq('user_id', user.id) // Sadece kendi koleksiyonunu güncelleyebilir
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// KOLEKSİYON SİLME (Delete Collection)
export async function DELETE(request: Request, context: { params: { id: string } }) {
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

  try {
    const params = await context.params
    
    // 1. Önce bu koleksiyona ait promptları serbest bırak (collection_id'lerini null yap)
    await supabase
      .from('prompts')
      .update({ collection_id: null })
      .eq('collection_id', params.id)
      .eq('user_id', user.id)

    // 2. Ardından koleksiyonun kendisini sil
    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id) // Sadece kendi koleksiyonunu silebilir

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}