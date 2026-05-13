'use client'

import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

type Platform = 'chatgpt' | 'claude' | 'gemini' | 'other' | string
type Prompt = {
  id: string
  title: string
  content: string
  platform: Platform
  category: string
  use_count: number
  created_at: string
  collection_id: string | null
}
type Collection = {
  id: string
  name: string
  description: string
  is_public: boolean
  collection_prompts: { count: number }[]
}

const PLATFORMS = [
  { value: 'chatgpt', label: 'ChatGPT', bg: 'bg-[#10a37f]/10 text-[#10a37f]' },
  { value: 'claude', label: 'Claude', bg: 'bg-amber-500/10 text-amber-400' },
  { value: 'gemini', label: 'Gemini', bg: 'bg-blue-500/10 text-blue-400' },
  { value: 'other', label: 'Other', bg: 'bg-violet-500/10 text-violet-400' },
]

const CATEGORIES = ['General', 'Writing', 'Coding', 'Marketing', 'Research', 'Design', 'Other']

function getPlatformStyle(value: string) {
  const found = PLATFORMS.find(p => p.value === value)
  return found ? found.bg : 'bg-violet-500/10 text-violet-400'
}

function getPlatformLabel(value: string) {
  const found = PLATFORMS.find(p => p.value === value)
  if (found && value !== 'other') return found.label
  if (value === 'other') return 'Other'
  return value.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Dashboard() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [user, setUser] = useState<{
    email?: string
    user_metadata?: { full_name?: string; avatar_url?: string }
  } | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddPrompt, setShowAddPrompt] = useState(false)
  const [showAddCollection, setShowAddCollection] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [activeCollection, setActiveCollection] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const emptyForm = {
    title: '',
    content: '',
    platform: 'chatgpt',
    category: 'General',
    collection_id: '',
    customPlatform: '',
    customCategory: '',
  }
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

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchAll = async () => {
    const [p, c] = await Promise.all([
      fetch('/api/prompts').then(r => r.json()),
      fetch('/api/collections').then(r => r.json()),
    ])
    if (Array.isArray(p)) setPrompts(p)
    if (Array.isArray(c)) setCollections(c)
  }

  const getFinalPlatform = () => {
    if (form.platform === 'other' && form.customPlatform.trim()) {
      return form.customPlatform.trim().toLowerCase().replace(/\s+/g, '-')
    }
    return form.platform
  }

  const getFinalCategory = () => {
    if (form.category === 'Other' && form.customCategory.trim()) {
      return form.customCategory.trim()
    }
    return form.category
  }

  const handleAddPrompt = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError('Title and content are required.')
      return
    }
    setSubmitting(true)
    setError('')
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
    const data = await res.json()
    if (!res.ok) {
      setError(
        data.error === 'FREE_LIMIT_REACHED'
          ? 'Free plan limit reached (50 prompts). Upgrade to Pro.'
          : data.error
      )
    } else {
      setPrompts(prev => [data, ...prev])
      setForm(emptyForm)
      setShowAddPrompt(false)
    }
    setSubmitting(false)
  }

  const handleEditPrompt = async () => {
    if (!editingPrompt) return
    setSubmitting(true)
    const res = await fetch(`/api/prompts/${editingPrompt.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title.trim(),
        content: form.content.trim(),
        platform: getFinalPlatform(),
        category: getFinalCategory(),
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setPrompts(prev => prev.map(p => p.id === editingPrompt.id ? data : p))
      setEditingPrompt(null)
      setShowAddPrompt(false)
      setForm(emptyForm)
    }
    setSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/prompts/${id}`, { method: 'DELETE' })
    setPrompts(prev => prev.filter(p => p.id !== id))
    setOpenMenu(null)
  }

  const handleAddCollection = async () => {
    if (!collectionForm.name.trim()) return
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectionForm),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(
        data.error === 'FREE_COLLECTION_LIMIT'
          ? 'Free plan allows max 3 collections. Upgrade to Pro.'
          : data.error
      )
    } else {
      setCollections(prev => [data, ...prev])
      setCollectionForm({ name: '', description: '' })
      setShowAddCollection(false)
    }
    setSubmitting(false)
  }

  const openEdit = (prompt: Prompt) => {
    setEditingPrompt(prompt)
    const isCustomPlatform = !PLATFORMS.find(p => p.value === prompt.platform)
    const isCustomCategory = !CATEGORIES.includes(prompt.category)
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
    setOpenMenu(null)
  }

  const filteredPrompts = activeCollection
    ? prompts.filter(p => p.collection_id === activeCollection)
    : prompts

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-60 bg-[#0E0E16] border-r border-white/[0.06] flex flex-col z-20">

        {/* Logo */}
        <div className="p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 4h10M3 8h7M3 12h5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <span className="font-semibold text-[15px] tracking-tight">Prompax</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 overflow-y-auto">
          <button
            onClick={() => setActiveCollection(null)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors mb-1 ${
              !activeCollection
                ? 'bg-violet-500/15 text-violet-300'
                : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            All Prompts
            <span className="ml-auto text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded-md">
              {prompts.length}
            </span>
          </button>

          <div className="mt-4 mb-2 px-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-white/25 uppercase tracking-wider">Collections</span>
            <button
              onClick={() => { setShowAddCollection(true); setError('') }}
              className="text-white/30 hover:text-white/60 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>

          {collections.map(col => (
            <button
              key={col.id}
              onClick={() => setActiveCollection(col.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors mb-0.5 ${
                activeCollection === col.id
                  ? 'bg-violet-500/15 text-violet-300'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 7a2 2 0 012-2h3.5l2 2H19a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              <span className="truncate">{col.name}</span>
              <span className="ml-auto text-[11px] text-white/20">
                {prompts.filter(p => p.collection_id === col.id).length}
              </span>
            </button>
          ))}

          {collections.length === 0 && (
            <p className="text-[12px] text-white/20 px-3 py-2">No collections yet</p>
          )}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5 px-2 py-2">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} className="w-7 h-7 rounded-full" alt="" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-300 text-[11px] font-semibold">
                {user?.email?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-white/80 truncate">
                {user?.user_metadata?.full_name || user?.email}
              </p>
              <p className="text-[10px] text-white/30">Free plan</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-60 min-h-screen">

        {/* Header */}
        <header className="sticky top-0 z-10 bg-[#0A0A0F]/80 backdrop-blur-xl border-b border-white/[0.06] px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-[15px] font-semibold text-white">
              {activeCollection
                ? collections.find(c => c.id === activeCollection)?.name
                : 'All Prompts'}
            </h1>
            <p className="text-[12px] text-white/30 mt-0.5">{filteredPrompts.length} prompts</p>
          </div>
          <button
            onClick={() => {
              setShowAddPrompt(true)
              setEditingPrompt(null)
              setForm(emptyForm)
              setError('')
            }}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Prompt
          </button>
        </header>

        {/* Content */}
        <div className="p-8">
          {filteredPrompts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <p className="text-white/40 text-[14px] font-medium">No prompts yet</p>
              <p className="text-white/20 text-[12px] mt-1">
                {activeCollection
                  ? 'No prompts in this collection yet'
                  : 'Add your first prompt to get started'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" ref={menuRef}>
              {filteredPrompts.map(prompt => (
                <div
                  key={prompt.id}
                  className="group relative bg-[#111118] border border-white/[0.06] rounded-xl p-5 hover:border-white/[0.12] transition-all duration-200"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-[13px] font-semibold text-white leading-snug line-clamp-2 flex-1">
                      {prompt.title}
                    </h3>

                    {/* Three dot menu */}
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => setOpenMenu(openMenu === prompt.id ? null : prompt.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="1.5" />
                          <circle cx="12" cy="12" r="1.5" />
                          <circle cx="12" cy="19" r="1.5" />
                        </svg>
                      </button>
                      {openMenu === prompt.id && (
                        <div className="absolute right-0 top-8 w-36 bg-[#1A1A28] border border-white/[0.08] rounded-xl shadow-xl z-50 overflow-hidden">
                          <button
                            onClick={() => openEdit(prompt)}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(prompt.id)}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] text-red-400 hover:text-red-300 hover:bg-red-500/[0.08] transition-colors"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Content preview */}
                  <p className="text-[12px] text-white/35 leading-relaxed line-clamp-3 mb-4">
                    {prompt.content}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${getPlatformStyle(prompt.platform)}`}>
                      {getPlatformLabel(prompt.platform)}
                    </span>
                    <span className="text-[11px] text-white/25 bg-white/[0.04] px-2 py-0.5 rounded-md">
                      {prompt.category}
                    </span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" />
                      </svg>
                      <span className="text-[11px] text-white/20" title={timeAgo(prompt.created_at)}>
                        {formatDate(prompt.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add/Edit Prompt Modal */}
      {showAddPrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-white/[0.08] rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
              <h2 className="text-[15px] font-semibold">
                {editingPrompt ? 'Edit Prompt' : 'New Prompt'}
              </h2>
              <button
                onClick={() => { setShowAddPrompt(false); setEditingPrompt(null); setForm(emptyForm) }}
                className="text-white/30 hover:text-white/60 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <p className="text-[12px] text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
              )}

              {/* Title */}
              <div>
                <label className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-1.5 block">Title</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Cold email opener"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>

              {/* Content */}
              <div>
                <label className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-1.5 block">Prompt</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Paste your prompt here..."
                  rows={5}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors resize-none"
                />
              </div>

              {/* Platform + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-1.5 block">Platform</label>
                  <select
                    value={form.platform}
                    onChange={e => setForm(f => ({ ...f, platform: e.target.value, customPlatform: '' }))}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-violet-500/50 transition-colors appearance-none"
                  >
                    {PLATFORMS.map(p => (
                      <option key={p.value} value={p.value} className="bg-[#1A1A28]">{p.label}</option>
                    ))}
                  </select>
                  {form.platform === 'other' && (
                    <input
                      value={form.customPlatform}
                      onChange={e => setForm(f => ({ ...f, customPlatform: e.target.value }))}
                      placeholder="Enter platform name..."
                      className="w-full mt-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors"
                    />
                  )}
                </div>
                <div>
                  <label className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-1.5 block">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value, customCategory: '' }))}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-violet-500/50 transition-colors appearance-none"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c} className="bg-[#1A1A28]">{c}</option>
                    ))}
                  </select>
                  {form.category === 'Other' && (
                    <input
                      value={form.customCategory}
                      onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))}
                      placeholder="Enter category name..."
                      className="w-full mt-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors"
                    />
                  )}
                </div>
              </div>

              {/* Collection */}
              {!editingPrompt && collections.length > 0 && (
                <div>
                  <label className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-1.5 block">
                    Add to Collection (optional)
                  </label>
                  <select
                    value={form.collection_id}
                    onChange={e => setForm(f => ({ ...f, collection_id: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-violet-500/50 transition-colors appearance-none"
                  >
                    <option value="" className="bg-[#1A1A28]">None</option>
                    {collections.map(c => (
                      <option key={c.id} value={c.id} className="bg-[#1A1A28]">{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => { setShowAddPrompt(false); setEditingPrompt(null); setForm(emptyForm) }}
                className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-[13px] text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={editingPrompt ? handleEditPrompt : handleAddPrompt}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-[13px] font-medium transition-colors"
              >
                {submitting ? 'Saving...' : editingPrompt ? 'Save Changes' : 'Add Prompt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Collection Modal */}
      {showAddCollection && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
              <h2 className="text-[15px] font-semibold">New Collection</h2>
              <button
                onClick={() => { setShowAddCollection(false); setError('') }}
                className="text-white/30 hover:text-white/60 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <p className="text-[12px] text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
              )}
              <div>
                <label className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-1.5 block">Name</label>
                <input
                  value={collectionForm.name}
                  onChange={e => setCollectionForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Marketing prompts"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-1.5 block">
                  Description (optional)
                </label>
                <input
                  value={collectionForm.description}
                  onChange={e => setCollectionForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What's this collection for?"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
              <p className="text-[11px] text-white/20">
                {collections.length}/3 collections used on free plan
              </p>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => { setShowAddCollection(false); setError('') }}
                className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-[13px] text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCollection}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-[13px] font-medium transition-colors"
              >
                {submitting ? 'Creating...' : 'Create Collection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}