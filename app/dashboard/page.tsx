'use client'

import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { Copy, Plus, MoreVertical, Edit2, Trash2, Folder, LayoutGrid, Clock, AlertCircle, Check, Search, Sparkles, Loader2 } from 'lucide-react'

// Shadcn UI Bileşenleri
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Prompt = {
  id: string
  title: string
  content: string
  platform: string
  category: string
  use_count: number
  created_at: string
  collection_id: string | null
  similarity?: number // Anlamsal aramadan gelen eşleşme oranı
}

type Collection = {
  id: string
  name: string
  description: string
  is_public: boolean
}

const PLATFORMS = [
  { value: 'chatgpt', label: 'ChatGPT', bg: 'bg-[#10a37f]/15 text-[#10a37f] border-[#10a37f]/20' },
  { value: 'claude', label: 'Claude', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  { value: 'gemini', label: 'Gemini', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  { value: 'other', label: 'Other', bg: 'bg-violet-500/15 text-violet-400 border-violet-500/20' },
]

const CATEGORIES = ['General', 'Writing', 'Coding', 'Marketing', 'Research', 'Design', 'Other']

function getPlatformStyle(value: string) {
  const found = PLATFORMS.find(p => p.value === value)
  return found ? found.bg : 'bg-violet-500/15 text-violet-400 border-violet-500/20'
}

function getPlatformLabel(value: string) {
  const found = PLATFORMS.find(p => p.value === value)
  if (found && value !== 'other') return found.label
  if (value === 'other') return 'Other'
  return value.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return formatDate(dateStr)
}

const emptyForm = { title: '', content: '', platform: 'chatgpt', category: 'General', collection_id: '', customPlatform: '', customCategory: '' }

export default function Dashboard() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [user, setUser] = useState<{ email?: string; user_metadata?: { full_name?: string; avatar_url?: string } } | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddPrompt, setShowAddPrompt] = useState(false)
  const [showAddCollection, setShowAddCollection] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [activeCollection, setActiveCollection] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  
  // YENİ: Anlamsal Arama (Semantic Search) State'leri
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Prompt[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  const [form, setForm] = useState(emptyForm)
  const [collectionForm, setCollectionForm] = useState({ name: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      await fetchAll()
      setLoading(false)
    }
    init()
  }, [])

  // YENİ: Arama çubuğuna yazıldığında çalışacak "Debounce" efekti
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        setIsSearching(true)
        try {
          const res = await fetch('/api/prompts/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: searchQuery }),
          })
          if (res.ok) {
            const data = await res.json()
            setSearchResults(data)
          } else {
            console.error("Arama servisi hata döndürdü")
          }
        } catch (error) {
          console.error("Arama hatası:", error)
        } finally {
          setIsSearching(false)
        }
      } else {
        setSearchResults(null)
      }
    }, 500) // Kullanıcı yazmayı bıraktıktan 500ms sonra arar (API tasarrufu sağlar)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])

  const fetchAll = async () => {
    const [p, c] = await Promise.all([
      fetch('/api/prompts').then(r => r.json()),
      fetch('/api/collections').then(r => r.json()),
    ])
    if (Array.isArray(p)) setPrompts(p)
    if (Array.isArray(c)) setCollections(c)
  }

  const getFinalPlatform = () => form.platform === 'other' && form.customPlatform.trim() ? form.customPlatform.trim().toLowerCase().replace(/\s+/g, '-') : form.platform
  const getFinalCategory = () => form.category === 'Other' && form.customCategory.trim() ? form.customCategory.trim() : form.category

  const handleAddPrompt = async () => {
    if (!form.title.trim() || !form.content.trim()) { setError('Title and content are required.'); return }
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          content: form.content.trim(),
          platform: getFinalPlatform(),
          category: getFinalCategory(),
          collection_id: form.collection_id || null,
        }),
      })
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch (e) { throw new Error('Server error: ' + text.slice(0, 100)) }

      if (!res.ok) {
        setError(data.error === 'FREE_LIMIT_REACHED' ? 'Free plan limit reached (50 prompts). Upgrade to Pro.' : data.error || 'An error occurred.')
      } else {
        setPrompts(prev => [data, ...prev])
        setForm(emptyForm)
        setShowAddPrompt(false)
      }
    } catch (err: any) { setError('Operation failed: ' + err.message) }
    finally { setSubmitting(false) }
  }

  const handleEditPrompt = async () => {
    if (!editingPrompt) return
    setSubmitting(true); setError('')
    try {
      const res = await fetch(`/api/prompts/${editingPrompt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          content: form.content.trim(),
          platform: getFinalPlatform(),
          category: getFinalCategory(),
          collection_id: form.collection_id || null,
        }),
      })
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch (e) { throw new Error('Server error: ' + text.slice(0, 100)) }

      if (res.ok) {
        setPrompts(prev => prev.map(p => p.id === editingPrompt.id ? data : p))
        setEditingPrompt(null)
        setShowAddPrompt(false)
        setForm(emptyForm)
      } else { setError(data.error || 'Update failed.') }
    } catch (err: any) { setError('Operation failed: ' + err.message) }
    finally { setSubmitting(false) }
  }

  const handleDelete = async (id: string) => {
    const isConfirmed = window.confirm("Are you sure you want to delete this prompt? This action cannot be undone.")
    if (!isConfirmed) return
    await fetch(`/api/prompts/${id}`, { method: 'DELETE' })
    setPrompts(prev => prev.filter(p => p.id !== id))
    if (searchResults) {
      setSearchResults(prev => prev ? prev.filter(p => p.id !== id) : null)
    }
  }

  const handleAddCollection = async () => {
    if (!collectionForm.name.trim()) return
    setSubmitting(true); setError('')
    const res = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectionForm),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error === 'FREE_COLLECTION_LIMIT' ? 'Free plan allows max 3 collections. Upgrade to Pro.' : data.error)
    } else {
      setCollections(prev => [data, ...prev])
      setCollectionForm({ name: '', description: '' })
      setShowAddCollection(false)
    }
    setSubmitting(false)
  }

  const openEdit = (prompt: Prompt) => {
    const isCustomPlatform = !PLATFORMS.find(p => p.value === prompt.platform)
    const isCustomCategory = !CATEGORIES.includes(prompt.category)
    setEditingPrompt(prompt)
    setForm({
      title: prompt.title,
      content: prompt.content,
      platform: isCustomPlatform ? 'other' : prompt.platform,
      category: isCustomCategory ? 'Other' : prompt.category,
      collection_id: prompt.collection_id || '',
      customPlatform: isCustomPlatform ? prompt.platform : '',
      customCategory: isCustomCategory ? prompt.category : '',
    })
    setShowAddPrompt(true)
    setError('')
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Ekranda gösterilecek promptları belirleme mantığı:
  const filteredPrompts = activeCollection ? prompts.filter(p => p.collection_id === activeCollection) : prompts
  const displayPrompts = searchResults !== null ? searchResults : filteredPrompts

  if (loading) return (
    <div className="min-h-screen bg-[#060609] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#060609] text-slate-200 font-sans selection:bg-violet-500/30">
      
      {/* SIDEBAR */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-[#0A0A0F]/95 backdrop-blur-xl border-r border-white/5 flex flex-col z-20">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_-5px_rgba(139,92,246,0.5)]">
              <LayoutGrid className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-[17px] tracking-tight text-white">Prompax</span>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto space-y-1">
          <button
            onClick={() => { setActiveCollection(null); setSearchQuery(''); setSearchResults(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium transition-all duration-200 ${
              !activeCollection && searchResults === null ? 'bg-violet-500/10 text-violet-400 border border-violet-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            All Prompts
            <span className="ml-auto text-[11px] bg-white/5 px-2 py-0.5 rounded-md font-medium">{prompts.length}</span>
          </button>

          <div className="mt-8 mb-3 px-4 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Collections</span>
            <button onClick={() => { setShowAddCollection(true); setError('') }} className="text-slate-400 hover:text-violet-400 transition-colors bg-white/5 hover:bg-white/10 p-1 rounded-md">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {collections.map(col => (
            <button
              key={col.id}
              onClick={() => { setActiveCollection(col.id); setSearchQuery(''); setSearchResults(null); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] transition-all duration-200 ${
                activeCollection === col.id ? 'bg-violet-500/10 text-violet-400 border border-violet-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <Folder className="w-4 h-4" />
              <span className="truncate">{col.name}</span>
              <span className="ml-auto text-[11px] text-slate-500">{prompts.filter(p => p.collection_id === col.id).length}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 bg-[#060609]/50">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} className="w-8 h-8 rounded-full border border-white/10" alt="Avatar" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-300 text-[12px] font-semibold border border-violet-500/20">
                {user?.email?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-slate-200 truncate">{user?.user_metadata?.full_name || user?.email}</p>
              <p className="text-[11px] text-slate-500">Free Plan</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="ml-64 min-h-screen flex flex-col relative">
        {/* HEADER */}
        <header className="sticky top-0 z-10 bg-[#060609]/80 backdrop-blur-xl border-b border-white/5 px-10 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              {searchResults !== null 
                ? 'Search Results' 
                : (activeCollection ? collections.find(c => c.id === activeCollection)?.name : 'All Prompts')}
            </h1>
            <p className="text-[13px] text-slate-400 mt-1">
              {searchResults !== null 
                ? `Found ${displayPrompts.length} matching prompts` 
                : `${filteredPrompts.length} prompts safely stored`}
            </p>
          </div>
          <button 
            onClick={() => { setShowAddPrompt(true); setEditingPrompt(null); setForm(emptyForm); setError('') }}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-medium px-5 py-2.5 rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(139,92,246,0.4)] hover:shadow-[0_0_25px_-5px_rgba(139,92,246,0.6)]"
          >
            <Plus className="w-4 h-4" /> New Prompt
          </button>
        </header>

        {/* YENİ: Semantic Search Bar */}
        <div className="px-10 pt-8 pb-2 relative z-10">
          <div className="relative max-w-2xl group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 group-focus-within:bg-violet-500 group-focus-within:text-white transition-colors">
              <Sparkles className="w-4 h-4" />
            </div>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search prompts by meaning, keywords, or intent..."
              className="w-full bg-[#0A0A0F]/80 backdrop-blur-md border border-white/5 rounded-2xl pl-14 pr-12 py-7 text-[14px] text-white placeholder-slate-500 focus-visible:ring-1 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/30 transition-all shadow-lg hover:border-white/10"
            />
            {isSearching ? (
              <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-violet-400 animate-spin" />
            ) : (
              <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            )}
          </div>
        </div>

        {/* PROMPT CARDS GRID */}
        <div className="p-10 pt-6 flex-1 relative">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

          {displayPrompts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-5 shadow-inner">
                {searchResults !== null ? <Search className="w-6 h-6 text-slate-400" /> : <Folder className="w-6 h-6 text-slate-400" />}
              </div>
              <p className="text-white text-[16px] font-medium">
                {searchResults !== null ? 'No matching prompts found' : 'No prompts found'}
              </p>
              <p className="text-slate-400 text-[14px] mt-2 max-w-sm leading-relaxed">
                {searchResults !== null 
                  ? "Try searching with different keywords or describe what the prompt does." 
                  : (activeCollection ? "You haven't saved any prompts to this collection yet." : "Start building your personal AI knowledge base by adding your first prompt.")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative z-10">
              {displayPrompts.map(prompt => (
                <div key={prompt.id} className="group flex flex-col bg-[#0A0A0F]/80 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-violet-500/40 transition-all duration-300 h-[280px] shadow-lg hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.15)] relative">
                  
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="text-[15px] font-semibold text-slate-100 leading-snug line-clamp-2 flex-1 group-hover:text-violet-100 transition-colors">
                      {prompt.title}
                    </h3>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all outline-none">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 bg-[#1A1A28] border-white/10 text-slate-200 rounded-xl shadow-2xl">
                        <DropdownMenuItem onClick={() => openEdit(prompt)} className="gap-2.5 cursor-pointer hover:bg-white/10 focus:bg-white/10 py-2.5">
                          <Edit2 className="h-4 w-4 text-slate-400" /> Edit Prompt
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(prompt.id)} className="gap-2.5 cursor-pointer text-red-400 focus:text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 py-2.5">
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="relative flex-1 overflow-hidden mb-4">
                    <p className="text-[13px] text-slate-400 leading-relaxed whitespace-pre-wrap">
                      {prompt.content}
                    </p>
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0A0A0F] to-transparent pointer-events-none group-hover:from-[#0d0d16] transition-colors duration-300" />
                  </div>

                  <div className="flex items-center gap-2 mt-auto pt-4 border-t border-white/5">
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-md border ${getPlatformStyle(prompt.platform)}`}>
                      {getPlatformLabel(prompt.platform)}
                    </span>
                    <span className="text-[11px] text-slate-400 bg-white/5 border border-white/5 px-2.5 py-1 rounded-md">
                      {prompt.category}
                    </span>

                    {/* AI Eşleşme Oranı Rozeti (Sadece aramada çıkar) */}
                    {prompt.similarity && (
                      <span className="text-[10px] font-medium text-violet-400 bg-violet-500/10 px-2 py-1 rounded-md ml-1" title="AI Semantic Match Score">
                        {Math.round(prompt.similarity * 100)}% Match
                      </span>
                    )}
                    
                    <button 
                      onClick={() => copyToClipboard(prompt.content, prompt.id)}
                      className="ml-auto flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-violet-500/20 hover:text-violet-300 text-slate-400 transition-all border border-transparent hover:border-violet-500/30"
                      title="Copy Prompt"
                    >
                      {copiedId === prompt.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* SHADCN DIALOG: Add/Edit Prompt (Kaydırılabilir Modal) */}
      <Dialog open={showAddPrompt} onOpenChange={(open) => {
        setShowAddPrompt(open);
        if(!open){ setEditingPrompt(null); setForm(emptyForm); setError(''); }
      }}>
        <DialogContent className="bg-[#111118] border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl p-0 gap-0 overflow-hidden text-white [&>button]:hidden max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#0A0A0F]/50">
            <DialogTitle className="text-[16px] font-semibold text-white">
              {editingPrompt ? 'Edit Prompt' : 'Create New Prompt'}
            </DialogTitle>
            <button onClick={() => setShowAddPrompt(false)} className="text-slate-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-lg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto">
            {error && (
              <div className="flex items-center gap-2 text-[13px] text-red-400 bg-red-500/10 p-3.5 rounded-xl border border-red-500/20">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div>
              <label className="text-[12px] font-medium text-slate-400 mb-2 block">Title</label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Lead Generation Email Template"
                className="w-full bg-[#060609] border-white/10 rounded-xl px-4 py-6 text-[14px] text-white placeholder-slate-600 focus-visible:ring-1 focus-visible:ring-violet-500/50 transition-all shadow-inner"
              />
            </div>

            <div>
              <label className="text-[12px] font-medium text-slate-400 mb-2 block">Prompt Content</label>
              <Textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Paste the prompt you want to save here..."
                rows={8}
                className="w-full bg-[#060609] border-white/10 rounded-xl px-4 py-4 text-[14px] text-white placeholder-slate-600 focus-visible:ring-1 focus-visible:ring-violet-500/50 transition-all resize-none shadow-inner"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[12px] font-medium text-slate-400 mb-2 block">Platform</label>
                <Select value={form.platform} onValueChange={(v) => setForm(f => ({ ...f, platform: v, customPlatform: '' }))}>
                  <SelectTrigger className="w-full bg-[#060609] border-white/10 rounded-xl px-4 py-6 text-[13px] text-white focus:ring-1 focus:ring-violet-500/50 transition-all">
                    <SelectValue placeholder="Select Platform" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200 rounded-xl shadow-2xl">
                    {PLATFORMS.map(p => (
                      <SelectItem key={p.value} value={p.value} className="focus:bg-white/10 cursor-pointer py-2.5">{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.platform === 'other' && (
                  <Input value={form.customPlatform} onChange={e => setForm(f => ({ ...f, customPlatform: e.target.value }))} placeholder="Enter platform name..." className="w-full mt-3 bg-[#060609] border-white/10 rounded-xl px-4 py-5 text-[13px] text-white" />
                )}
              </div>
              
              <div>
                <label className="text-[12px] font-medium text-slate-400 mb-2 block">Category</label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v, customCategory: '' }))}>
                  <SelectTrigger className="w-full bg-[#060609] border-white/10 rounded-xl px-4 py-6 text-[13px] text-white focus:ring-1 focus:ring-violet-500/50 transition-all">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200 rounded-xl shadow-2xl">
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c} className="focus:bg-white/10 cursor-pointer py-2.5">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.category === 'Other' && (
                  <Input value={form.customCategory} onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))} placeholder="Enter category name..." className="w-full mt-3 bg-[#060609] border-white/10 rounded-xl px-4 py-5 text-[13px] text-white" />
                )}
              </div>
            </div>

            {collections.length > 0 && (
              <div>
                <label className="text-[12px] font-medium text-slate-400 mb-2 block">Collection</label>
                <Select value={form.collection_id || "none"} onValueChange={(v) => setForm(f => ({ ...f, collection_id: v === "none" ? "" : v }))}>
                  <SelectTrigger className="w-full bg-[#060609] border-white/10 rounded-xl px-4 py-6 text-[13px] text-white focus:ring-1 focus:ring-violet-500/50 transition-all">
                    <SelectValue placeholder="Select Collection" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200 rounded-xl shadow-2xl">
                    <SelectItem value="none" className="focus:bg-white/10 text-slate-500 cursor-pointer py-2.5">None (Unorganized)</SelectItem>
                    {collections.map(c => (
                      <SelectItem key={c.id} value={c.id} className="focus:bg-white/10 cursor-pointer py-2.5">{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex gap-3 p-6 border-t border-white/5 bg-[#0A0A0F]/50">
            <button onClick={() => setShowAddPrompt(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-[13px] font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button onClick={editingPrompt ? handleEditPrompt : handleAddPrompt} disabled={submitting} className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-[13px] font-medium text-white transition-all shadow-[0_0_15px_-3px_rgba(139,92,246,0.5)]">
              {submitting ? 'Saving...' : editingPrompt ? 'Save Changes' : 'Save Prompt'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SHADCN DIALOG: Add Collection Modal */}
      <Dialog open={showAddCollection} onOpenChange={(open) => { setShowAddCollection(open); setError(''); }}>
        <DialogContent className="bg-[#111118] border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-0 gap-0 overflow-hidden text-white [&>button]:hidden">
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#0A0A0F]/50">
            <DialogTitle className="text-[16px] font-semibold text-white">New Collection</DialogTitle>
            <button onClick={() => setShowAddCollection(false)} className="text-slate-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-lg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
          
          <div className="p-6 space-y-5">
            {error && (
              <div className="flex items-center gap-2 text-[13px] text-red-400 bg-red-500/10 p-3.5 rounded-xl border border-red-500/20">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}
            
            <div>
              <label className="text-[12px] font-medium text-slate-400 mb-2 block">Name</label>
              <Input
                value={collectionForm.name}
                onChange={e => setCollectionForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Real Estate Prompts"
                className="w-full bg-[#060609] border-white/10 rounded-xl px-4 py-6 text-[14px] text-white placeholder-slate-600 focus-visible:ring-1 focus-visible:ring-violet-500/50 transition-all shadow-inner"
              />
            </div>
            
            <div>
              <label className="text-[12px] font-medium text-slate-400 mb-2 block">Description (Optional)</label>
              <Input
                value={collectionForm.description}
                onChange={e => setCollectionForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What is this collection for?"
                className="w-full bg-[#060609] border-white/10 rounded-xl px-4 py-6 text-[14px] text-white placeholder-slate-600 focus-visible:ring-1 focus-visible:ring-violet-500/50 transition-all shadow-inner"
              />
            </div>
            
            <p className="text-[12px] text-slate-500">
              <span className="text-violet-400 font-medium">{collections.length}</span> out of 3 collections used on free plan.
            </p>
          </div>
          
          <div className="flex gap-3 p-6 border-t border-white/5 bg-[#0A0A0F]/50">
            <button onClick={() => setShowAddCollection(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-[13px] font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button onClick={handleAddCollection} disabled={submitting} className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-[13px] font-medium text-white transition-all shadow-[0_0_15px_-3px_rgba(139,92,246,0.5)]">
              {submitting ? 'Creating...' : 'Create Collection'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}