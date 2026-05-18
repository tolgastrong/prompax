import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

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

  try {
    const { collection_id } = await request.json()
    if (!collection_id) return NextResponse.json({ error: 'Missing collection ID' }, { status: 400 })

    // 1. Orijinal koleksiyonu bul
    const { data: originalCol, error: colError } = await supabase
      .from('collections')
      .select('*')
      .eq('id', collection_id)
      .single()
      
    if (colError || !originalCol) throw new Error('Collection not found')

    // 2. Yeni koleksiyonu kullanıcının hesabına kopyala (İsmine " (Imported)" ekleyelim)
    const { data: newCol, error: newColError } = await supabase
      .from('collections')
      .insert([{ 
        name: `${originalCol.name} (Imported)`, 
        description: originalCol.description,
        user_id: user.id
      }])
      .select()
      .single()

    if (newColError) throw newColError

    // 3. Orijinal promptları bul
    const { data: originalPrompts, error: promptsError } = await supabase
      .from('prompts')
      .select('*')
      .eq('collection_id', collection_id)

    if (promptsError) throw promptsError

    // 4. Promptları yeni koleksiyon ID'si ve yeni kullanıcı ID'si ile klonla
    if (originalPrompts && originalPrompts.length > 0) {
      const clonedPrompts = originalPrompts.map(p => ({
        title: p.title,
        content: p.content,
        platform: p.platform,
        category: p.category,
        collection_id: newCol.id,
        user_id: user.id
      }))

      const { error: insertError } = await supabase.from('prompts').insert(clonedPrompts)
      if (insertError) throw insertError
    }

    return NextResponse.json({ success: true, new_collection_id: newCol.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}