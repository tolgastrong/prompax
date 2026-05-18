'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { LayoutGrid, Copy, Check, CheckCircle2, FolderDown, Loader2, Sparkles, LogIn, ArrowRight } from 'lucide-react'

type Prompt = {
  id: string
  title: string
  content: string
  platform: string
  category: string
}

type Collection = {
  id: string
  name: string
  description: string
}

const PLATFORMS = [
  { value: 'chatgpt', label: 'ChatGPT', bg: 'bg-[#10a37f]/15 text-[#10a37f] border-[#10a37f]/20' },
  { value: 'claude', label: 'Claude', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  { value: 'gemini', label: 'Gemini', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  { value: 'deepseek', label: 'DeepSeek', bg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20' },
]

function getPlatformStyle(value: string) {
  const found = PLATFORMS.find(p => p.value === value)
  return found ? found.bg : 'bg-violet-500/15 text-violet-400 border-violet-500/20'
}

function getPlatformLabel(value: string) {
  const found = PLATFORMS.find(p => p.value === value)
  if (found) return found.label
  return value.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export default function PublicSharePage() {
  const params = useParams()
  const router = useRouter()
  const collectionId = params.id as string

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [collection, setCollection] = useState<Collection | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState(false)

  useEffect(() => {
    const fetchSharedData = async () => {
      try {
        // 1. Oturum durumunu kontrol et (Kullanıcı giriş yapmış mı?)
        const { data: { session } } = await supabase.auth.getSession()
        setIsAuthenticated(!!session)

        // 2. Koleksiyon verilerini çek
        const { data: colData, error: colError } = await supabase
          .from('collections')
          .select('id, name, description')
          .eq('id', collectionId)
          .single()

        if (colError || !colData) throw new Error('Collection not found or access denied.')
        setCollection(colData)

        // 3. Prompt verilerini çek
        const { data: promptData, error: promptError } = await supabase
          .from('prompts')
          .select('id, title, content, platform, category')
          .eq('collection_id', collectionId)

        if (!promptError && promptData) {
          setPrompts(promptData)
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (collectionId) fetchSharedData()
  }, [collectionId])

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleImport = async () => {
    if (!isAuthenticated) {
      // Kullanıcı giriş yapmamışsa, giriş sayfasına yönlendir. 
      // Giriş yaptıktan sonra tekrar bu sayfaya dönebilmesi için query parametresi eklenebilir.
      router.push('/login')
      return
    }

    setImporting(true)
    try {
      const res = await fetch('/api/collections/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection_id: collectionId }),
      })
      
      const data = await res.json()
      if (res.ok && data.success) {
        setImportSuccess(true)
        setTimeout(() => {
          router.push('/dashboard')
        }, 1500)
      } else {
        alert(data.error || 'Import failed')
      }
    } catch (err) {
      alert('An error occurred during import.')
    } finally {
      setImporting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060609] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-medium">Loading collection...</p>
      </div>
    )
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen bg-[#060609] flex flex-col items-center justify-center text-center p-10">
        <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
          <FolderDown className="w-8 h-8 text-slate-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Collection Not Found</h1>
        <p className="text-slate-400 max-w-md">This link might be invalid, or the owner has deleted the collection.</p>
        <button onClick={() => router.push('/')} className="mt-8 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-all">Go to Homepage</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#060609] text-slate-200 font-sans selection:bg-violet-500/30">
      
      {/* HEADER (Minimal, Logolu) */}
      <header className="fixed top-0 inset-x-0 z-50 bg-[#060609]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_-5px_rgba(139,92,246,0.5)]">
              <LayoutGrid className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-[20px] tracking-tight text-white">Prompax</span>
          </div>

          {!isAuthenticated ? (
            <button onClick={() => router.push('/login')} className="flex items-center gap-2 text-[14px] font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-5 py-2.5 rounded-xl transition-colors">
              <LogIn className="w-4 h-4" /> Sign In / Register
            </button>
          ) : (
            <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-[14px] font-medium text-white bg-violet-600 hover:bg-violet-500 px-5 py-2.5 rounded-xl transition-all shadow-[0_0_15px_-3px_rgba(139,92,246,0.4)]">
              My Workspace <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      <main className="pt-32 pb-20 px-6 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-violet-600/10 rounded-full blur-[150px] pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10">
          
          {/* HERO BÖLÜMÜ: Koleksiyon Detayları ve Import Butonu */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16 bg-[#0A0A0F]/80 border border-white/5 p-10 rounded-3xl shadow-2xl backdrop-blur-sm">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[12px] font-bold uppercase tracking-widest text-violet-400 bg-violet-500/10 px-3 py-1.5 rounded-lg border border-violet-500/20">
                  Shared Collection
                </span>
                <span className="text-[13px] font-medium text-slate-500 flex items-center gap-1.5">
                  <FolderDown className="w-4 h-4" /> {prompts.length} Prompts
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">{collection.name}</h1>
              {collection.description && (
                <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">{collection.description}</p>
              )}
            </div>

            <div className="shrink-0 w-full md:w-auto">
              <button 
                onClick={handleImport}
                disabled={importing || importSuccess}
                className="w-full md:w-auto flex items-center justify-center gap-2.5 px-8 py-4 bg-white text-[#0A0A0F] hover:bg-slate-200 text-[15px] font-bold rounded-2xl transition-all shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)] disabled:opacity-80"
              >
                {importing ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Importing...</>
                ) : importSuccess ? (
                  <><CheckCircle2 className="w-5 h-5 text-green-600" /> Redirecting...</>
                ) : (
                  <><Sparkles className="w-5 h-5" /> Import to My Workspace</>
                )}
              </button>
              {!isAuthenticated && (
                <p className="text-[11px] text-center text-slate-500 mt-3 font-medium">Requires a free Prompax account</p>
              )}
            </div>
          </div>

          {/* PROMPT LİSTESİ */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {prompts.map((prompt) => (
              <div key={prompt.id} className="group flex flex-col bg-[#0A0A0F]/50 border border-white/5 rounded-2xl p-6 hover:border-violet-500/30 transition-all duration-300 h-[280px]">
                <h3 className="text-[16px] font-semibold text-slate-100 leading-snug line-clamp-2 mb-3">
                  {prompt.title}
                </h3>

                <div className="relative flex-1 overflow-hidden mb-4 bg-black/20 p-4 rounded-xl border border-white/5">
                  <p className="text-[13px] text-slate-400 font-mono leading-relaxed whitespace-pre-wrap">{prompt.content}</p>
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0d0d14] to-transparent pointer-events-none" />
                </div>

                <div className="flex items-center gap-2 mt-auto">
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-md border ${getPlatformStyle(prompt.platform)}`}>
                    {getPlatformLabel(prompt.platform)}
                  </span>
                  <span className="text-[11px] text-slate-400 bg-white/5 border border-white/5 px-2.5 py-1 rounded-md">
                    {prompt.category}
                  </span>
                  
                  <button 
                    onClick={() => copyToClipboard(prompt.content, prompt.id)} 
                    className="ml-auto flex items-center justify-center gap-2 h-8 px-3 rounded-lg bg-white/5 hover:bg-violet-500/20 hover:text-violet-300 text-slate-400 transition-all text-[11px] font-bold tracking-wide"
                  >
                    {copiedId === prompt.id ? <><Check className="w-3.5 h-3.5 text-green-400" /> COPIED</> : <><Copy className="w-3.5 h-3.5" /> COPY</>}
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      </main>
    </div>
  )
}