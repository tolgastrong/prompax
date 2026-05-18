'use client'

import { useEffect, useState, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { 
  Copy, Plus, MoreVertical, Edit2, Trash2, Folder, LayoutGrid, AlertCircle, 
  Check, Search, Sparkles, Loader2, Wand2, XCircle, CheckCircle2, History, 
  RotateCcw, Star, Clock, Settings, BookOpen, MessageSquare, Share2, Zap,
  BarChart2, ChevronLeft, ChevronRight, Activity, RefreshCw, PieChart, ShieldAlert
} from 'lucide-react'

// Shadcn UI Bileşenleri
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
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
  similarity?: number
  is_favorite: boolean
  deleted_at: string | null // YENİ: Çöp kutusu için eklendi
}

type Collection = {
  id: string
  name: string
  description: string
  is_public: boolean
}

type OptimizeResult = { strengths: string[], weaknesses: string[], improved_prompt: string }
type PromptVersion = { id: string, prompt_id: string, content: string, version_num: number, created_at: string }

const PLATFORMS = [
  { value: 'chatgpt', label: 'ChatGPT', bg: 'bg-[#10a37f]/15 text-[#10a37f] border-[#10a37f]/20' },
  { value: 'claude', label: 'Claude', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  { value: 'gemini', label: 'Gemini', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  { value: 'deepseek', label: 'DeepSeek', bg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20' },
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

function getPlatformDotColor(value: string) {
  if(value === 'chatgpt') return 'bg-[#10a37f]'
  if(value === 'claude') return 'bg-amber-500'
  if(value === 'gemini') return 'bg-blue-500'
  if(value === 'deepseek') return 'bg-indigo-500'
  return 'bg-violet-500'
}

const emptyForm = { title: '', content: '', platform: 'chatgpt', category: 'General', collection_id: '', customPlatform: '', customCategory: '' }

export default function Dashboard() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [user, setUser] = useState<{ id?: string, email?: string; user_metadata?: { full_name?: string; avatar_url?: string } } | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Modals & States
  const [showAddPrompt, setShowAddPrompt] = useState(false)
  const [showAddCollection, setShowAddCollection] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  
  // Navigation States
  const [activeView, setActiveView] = useState<'all' | 'favorites' | 'recent' | 'trash' | 'analytics' | 'platform' | 'collection'>('all')
  const [activeCollection, setActiveCollection] = useState<string | null>(null)
  const [activePlatform, setActivePlatform] = useState<string | null>(null)
  
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Prompt[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  // AI Optimize States
  const [showOptimizeModal, setShowOptimizeModal] = useState(false)
  const [optimizingPrompt, setOptimizingPrompt] = useState<Prompt | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null)
  const [optimizeError, setOptimizeError] = useState('')

  // Version History States
  const [activeTab, setActiveTab] = useState<'editor' | 'history'>('editor')
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)

  const [form, setForm] = useState(emptyForm)
  const [collectionForm, setCollectionForm] = useState({ name: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // SADECE AKTİF PROMPTLARI (Çöpte olmayanları) filtrele
  const activePrompts = useMemo(() => prompts.filter(p => !p.deleted_at), [prompts])
  const trashedPrompts = useMemo(() => prompts.filter(p => p.deleted_at), [prompts])

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
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        setIsSearching(true)
        try {
          const lowerQuery = searchQuery.toLowerCase()
          const localMatches = activePrompts.filter(p => 
            p.title.toLowerCase().includes(lowerQuery) || 
            p.content.toLowerCase().includes(lowerQuery) ||
            p.category.toLowerCase().includes(lowerQuery)
          )

          let semanticMatches: Prompt[] = []
          try {
            const res = await fetch('/api/prompts/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: searchQuery }),
            })
            if (res.ok) {
              const data = await res.json();
              // Sadece aktif (çöpte olmayan) semantic sonuçları al
              semanticMatches = data.filter((d: Prompt) => !d.deleted_at);
            }
          } catch (e) { console.error(e) }

          const combinedMap = new Map<string, Prompt>()
          semanticMatches.forEach(p => combinedMap.set(p.id, p))
          localMatches.forEach(p => { if (!combinedMap.has(p.id)) combinedMap.set(p.id, p) })

          setSearchResults(Array.from(combinedMap.values()))
        } catch (error) { console.error(error) } 
        finally { setIsSearching(false) }
      } else { setSearchResults(null) }
    }, 500)
    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery, activePrompts])

  const fetchAll = async () => {
    const [p, c] = await Promise.all([
      fetch('/api/prompts').then(r => r.json()),
      fetch('/api/collections').then(r => r.json()),
    ])
    if (Array.isArray(p)) setPrompts(p)
    if (Array.isArray(c)) setCollections(c)
  }

  const fetchVersions = async (promptId: string) => {
    setLoadingVersions(true)
    try {
      const res = await fetch(`/api/prompts/${promptId}/versions`)
      if (res.ok) setPromptVersions(await res.json())
    } catch (err) { console.error(err) } 
    finally { setLoadingVersions(false) }
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
      try { data = JSON.parse(text) } catch (e) { throw new Error('Server error') }

      if (!res.ok) {
        setError(data.error === 'FREE_LIMIT_REACHED' ? 'Free plan limit reached. Upgrade to Pro.' : data.error)
      } else {
        setPrompts(prev => [data, ...prev])
        setForm(emptyForm)
        setShowAddPrompt(false)
      }
    } catch (err: any) { setError('Operation failed') }
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
      const data = await res.json()
      if (res.ok) {
        setPrompts(prev => prev.map(p => p.id === editingPrompt.id ? data : p))
        if (searchResults) setSearchResults(prev => prev ? prev.map(p => p.id === editingPrompt.id ? data : p) : null)
        setEditingPrompt(null)
        setShowAddPrompt(false)
        setForm(emptyForm)
      } else { setError(data.error || 'Update failed.') }
    } catch (err: any) { setError('Operation failed') }
    finally { setSubmitting(false) }
  }

  const toggleFavorite = async (prompt: Prompt) => {
    const newStatus = !prompt.is_favorite
    setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, is_favorite: newStatus } : p))
    if (searchResults) setSearchResults(prev => prev ? prev.map(p => p.id === prompt.id ? { ...p, is_favorite: newStatus } : p) : null)
    try {
      await fetch(`/api/prompts/${prompt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...prompt, is_favorite: newStatus }),
      })
    } catch (err) {
      setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, is_favorite: !newStatus } : p))
    }
  }

  const handleRestoreVersion = async (versionContent: string) => {
    if (!editingPrompt) return
    if (!window.confirm("Are you sure you want to replace the current content with this version?")) return
    setForm(f => ({ ...f, content: versionContent }))
    setActiveTab('editor')
  }

  // YENİ: Çöpe Taşı (Soft Delete)
  const handleMoveToTrash = async (id: string) => {
    const now = new Date().toISOString()
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, deleted_at: now, is_favorite: false } : p))
    if (searchResults) setSearchResults(prev => prev ? prev.filter(p => p.id !== id) : null)
    
    // Doğrudan supabase client ile güncelle
    await supabase.from('prompts').update({ deleted_at: now, is_favorite: false }).eq('id', id)
  }

  // YENİ: Çöpten Kurtar (Restore)
  const handleRestoreFromTrash = async (id: string) => {
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, deleted_at: null } : p))
    await supabase.from('prompts').update({ deleted_at: null }).eq('id', id)
  }

  // YENİ: Kalıcı Olarak Sil (Hard Delete)
  const handlePermanentDelete = async (id: string) => {
    if (!window.confirm("This action is permanent and cannot be undone. Are you sure?")) return
    setPrompts(prev => prev.filter(p => p.id !== id))
    await supabase.from('prompts').delete().eq('id', id)
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

  const openWorkspace = (prompt: Prompt) => {
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
    setActiveTab('editor')
    fetchVersions(prompt.id)
    setShowAddPrompt(true)
    setError('')
  }

  const handleOptimizePrompt = async (prompt: Prompt) => {
    setOptimizingPrompt(prompt)
    setOptimizeResult(null); setOptimizeError(''); setShowOptimizeModal(true); setIsOptimizing(true)
    try {
      const res = await fetch('/api/prompts/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: prompt.content }),
      })
      const data = await res.json()
      if (!res.ok) setOptimizeError(data.error === 'PRO_PLAN_REQUIRED' ? 'This feature requires a Pro Plan subscription.' : data.error)
      else setOptimizeResult(data)
    } catch (err: any) { setOptimizeError('Failed to communicate with AI.') } 
    finally { setIsOptimizing(false) }
  }

  const acceptOptimization = async () => {
    if (!optimizingPrompt || !optimizeResult) return
    setIsOptimizing(true)
    try {
      const res = await fetch(`/api/prompts/${optimizingPrompt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: optimizingPrompt.title,
          content: optimizeResult.improved_prompt,
          platform: optimizingPrompt.platform,
          category: optimizingPrompt.category,
          collection_id: optimizingPrompt.collection_id,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setPrompts(prev => prev.map(p => p.id === optimizingPrompt.id ? data : p))
        if (searchResults) setSearchResults(prev => prev ? prev.map(p => p.id === optimizingPrompt.id ? data : p) : null)
        setShowOptimizeModal(false)
      }
    } catch (err) { setOptimizeError('Failed to save the new prompt.') } 
    finally { setIsOptimizing(false) }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const copyShareLink = (collectionId: string) => {
    const link = `${window.location.origin}/share/${collectionId}`
    navigator.clipboard.writeText(link)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  const setNav = (view: typeof activeView, colId: string | null = null, plat: string | null = null) => {
    setActiveView(view)
    setActiveCollection(colId)
    setActivePlatform(plat)
    setSearchQuery('')
    setSearchResults(null)
  }

  const standardPlatforms = ['chatgpt', 'claude', 'gemini', 'deepseek'];
  const uniqueUserPlatforms = Array.from(new Set(activePrompts.map(p => p.platform)));
  const customPlatforms = uniqueUserPlatforms.filter(p => !standardPlatforms.includes(p) && p !== 'other');
  const sidebarPlatforms = [...standardPlatforms, ...customPlatforms];

  // Filtreleme (activePrompts üzerinden)
  let filteredPrompts = activePrompts
  if (activeView === 'favorites') filteredPrompts = activePrompts.filter(p => p.is_favorite)
  else if (activeView === 'recent') filteredPrompts = [...activePrompts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  else if (activeView === 'collection') filteredPrompts = activePrompts.filter(p => p.collection_id === activeCollection)
  else if (activeView === 'platform') filteredPrompts = activePrompts.filter(p => p.platform === activePlatform)
  else if (activeView === 'trash') filteredPrompts = trashedPrompts // Sadece trash
  
  const displayPrompts = searchResults !== null ? searchResults : filteredPrompts

  // YENİ: Analitik Hesaplamaları
  const totalPrompts = activePrompts.length
  const totalFavorites = activePrompts.filter(p => p.is_favorite).length
  
  const platformCounts = activePrompts.reduce((acc, p) => {
    acc[p.platform] = (acc[p.platform] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const sortedPlatforms = Object.entries(platformCounts).sort(([,a], [,b]) => b - a).slice(0, 4)

  if (loading) return (
    <div className="min-h-screen bg-[#060609] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#060609] text-slate-200 font-sans selection:bg-violet-500/30 flex overflow-hidden">
      
      {/* GENİŞLEYİP DARALABİLEN SIDEBAR */}
      <aside className={`h-screen bg-[#0A0A0F]/95 backdrop-blur-xl border-r border-white/5 flex flex-col z-20 shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-[80px]' : 'w-72'}`}>
        
        {/* Header & Toggle Button */}
        <div className={`p-6 border-b border-white/5 shrink-0 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_-5px_rgba(139,92,246,0.5)] shrink-0">
              <LayoutGrid className="w-4 h-4 text-white" />
            </div>
            {!isCollapsed && <span className="font-semibold text-[18px] tracking-tight text-white transition-opacity duration-300">Prompax</span>}
          </div>
          
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className={`p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all ${isCollapsed ? 'absolute -right-3 top-7 border border-white/10 bg-[#0A0A0F] shadow-lg z-50' : ''}`}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-8 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full transition-colors">
          
          {/* WORKSPACE */}
          <div className="space-y-1">
            {!isCollapsed && <h3 className="px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Workspace</h3>}
            
            <button onClick={() => setNav('all')} title={isCollapsed ? "All Prompts" : ""} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'all' ? 'bg-violet-500/10 text-violet-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
              <LayoutGrid className="w-4 h-4 shrink-0" />
              {!isCollapsed && <>All Prompts <span className="ml-auto text-[11px] bg-white/5 px-2 py-0.5 rounded-md font-medium text-slate-300">{activePrompts.length}</span></>}
            </button>
            
            <button onClick={() => setNav('favorites')} title={isCollapsed ? "Favorites" : ""} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'favorites' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
              <Star className="w-4 h-4 shrink-0" />
              {!isCollapsed && <>Favorites <span className="ml-auto text-[11px] bg-white/5 px-2 py-0.5 rounded-md font-medium text-slate-300">{totalFavorites}</span></>}
            </button>
            
            <button onClick={() => setNav('recent')} title={isCollapsed ? "Recently Used" : ""} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'recent' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
              <Clock className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>Recently Used</span>}
            </button>

            <button onClick={() => setNav('trash')} title={isCollapsed ? "Trash" : ""} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'trash' ? 'bg-red-500/10 text-red-400' : 'text-slate-400 hover:text-red-400 hover:bg-white/5'}`}>
              <Trash2 className="w-4 h-4 shrink-0" />
              {!isCollapsed && <>Trash {trashedPrompts.length > 0 && <span className="ml-auto text-[11px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-md font-medium">{trashedPrompts.length}</span>}</>}
            </button>
          </div>

          {/* INSIGHTS / ANALYTICS */}
          <div className="space-y-1">
            {!isCollapsed && <h3 className="px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Insights</h3>}
            <button onClick={() => setNav('analytics')} title={isCollapsed ? "Analytics & Usage" : ""} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'analytics' ? 'bg-green-500/10 text-green-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
              <BarChart2 className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>Analytics & Usage</span>}
            </button>
          </div>

          {/* COLLECTIONS */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-4 mb-3">
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Collections</h3>
                <button onClick={() => { setShowAddCollection(true); setError('') }} className="text-slate-400 hover:text-violet-400 transition-colors"><Plus className="w-4 h-4" /></button>
              </div>
            )}
            {isCollapsed && (
              <button onClick={() => { setShowAddCollection(true); setError('') }} title="Add Collection" className="w-full flex justify-center py-2 text-slate-400 hover:text-violet-400"><Plus className="w-4 h-4" /></button>
            )}
            {collections.map(col => (
              <button key={col.id} onClick={() => setNav('collection', col.id)} title={isCollapsed ? col.name : ""} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeCollection === col.id ? 'bg-violet-500/10 text-violet-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                <Folder className="w-4 h-4 shrink-0" /> 
                {!isCollapsed && (
                  <>
                    <span className="truncate">{col.name}</span>
                    <span className="ml-auto text-[11px] text-slate-500">{activePrompts.filter(p => p.collection_id === col.id).length}</span>
                  </>
                )}
              </button>
            ))}
          </div>

          {/* PLATFORMS */}
          <div className="space-y-1">
            {!isCollapsed && <h3 className="px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Platforms</h3>}
            {sidebarPlatforms.map(plat => (
              <button key={plat} onClick={() => setNav('platform', null, plat)} title={isCollapsed ? getPlatformLabel(plat) : ""} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activePlatform === plat ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                <div className={`w-2 h-2 rounded-full shrink-0 ${getPlatformDotColor(plat)}`} /> 
                {!isCollapsed && <span>{getPlatformLabel(plat)}</span>}
              </button>
            ))}
          </div>

          {/* RESOURCES */}
          <div className="space-y-1">
            {!isCollapsed && <h3 className="px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Resources</h3>}
            <button title={isCollapsed ? "Prompt Guide" : ""} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all`}>
              <BookOpen className="w-4 h-4 shrink-0" /> {!isCollapsed && <span>Prompt Guide</span>}
            </button>
            <button title={isCollapsed ? "Submit Feedback" : ""} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all`}>
              <MessageSquare className="w-4 h-4 shrink-0" /> {!isCollapsed && <span>Submit Feedback</span>}
            </button>
            <button title={isCollapsed ? "Settings & API" : ""} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all`}>
              <Settings className="w-4 h-4 shrink-0" /> {!isCollapsed && <span>Settings & API</span>}
            </button>
          </div>
        </div>

        {/* PRO UPGRADE & USER */}
        <div className="p-4 border-t border-white/5 bg-[#060609]/50 shrink-0 space-y-3">
          
          <button title={isCollapsed ? "Upgrade to Pro" : ""} className={`w-full flex items-center justify-center ${isCollapsed ? 'p-3' : 'gap-2 py-3'} bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[13px] font-semibold rounded-xl transition-all shadow-[0_0_15px_-3px_rgba(139,92,246,0.4)] hover:shadow-[0_0_20px_-3px_rgba(139,92,246,0.6)]`}>
            <Zap className="w-4 h-4 fill-current shrink-0" /> {!isCollapsed && <span>Upgrade to Pro</span>}
          </button>

          <div title={isCollapsed ? (user?.user_metadata?.full_name || user?.email) : ""} className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer`}>
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} className="w-8 h-8 rounded-full border border-white/10 shrink-0" alt="Avatar" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-300 text-[12px] font-semibold border border-violet-500/20 shrink-0">
                {user?.email?.[0]?.toUpperCase()}
              </div>
            )}
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-200 truncate">{user?.user_metadata?.full_name || user?.email}</p>
                <p className="text-[11px] font-medium text-slate-500">Free Plan</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative h-screen overflow-hidden">
        <header className="sticky top-0 z-10 bg-[#060609]/80 backdrop-blur-xl border-b border-white/5 px-10 py-6 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[22px] font-bold text-white tracking-tight flex items-center gap-2">
                {searchResults !== null ? 'Search Results' : 
                 activeView === 'favorites' ? 'Favorite Prompts' :
                 activeView === 'recent' ? 'Recently Added Prompts' :
                 activeView === 'trash' ? 'Trash' :
                 activeView === 'analytics' ? 'Analytics & Usage' :
                 activeView === 'platform' ? `${getPlatformLabel(activePlatform!)} Prompts` :
                 activeView === 'collection' ? collections.find(c => c.id === activeCollection)?.name : 'All Prompts'}
              </h1>
              
              {activeView === 'collection' && activeCollection && (
                <button 
                  onClick={() => copyShareLink(activeCollection)}
                  className="flex items-center gap-1.5 bg-white/5 hover:bg-violet-500/20 text-slate-400 hover:text-violet-300 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border border-transparent hover:border-violet-500/30"
                >
                  {shareCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
                  {shareCopied ? 'Link Copied!' : 'Share Collection'}
                </button>
              )}
            </div>
            {(activeView !== 'trash' && activeView !== 'analytics') && (
              <p className="text-[13px] text-slate-400 mt-1.5">
                {searchResults !== null ? `Found ${displayPrompts.length} matching prompts` : `${filteredPrompts.length} prompts safely stored`}
              </p>
            )}
            {activeView === 'trash' && (
              <p className="text-[13px] text-red-400 mt-1.5 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /> Items in trash will be permanently deleted after 30 days.</p>
            )}
          </div>
          {(activeView !== 'trash' && activeView !== 'analytics') && (
            <button 
              onClick={() => { setShowAddPrompt(true); setEditingPrompt(null); setForm(emptyForm); setError('') }}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-medium px-5 py-2.5 rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(139,92,246,0.4)] hover:shadow-[0_0_25px_-5px_rgba(139,92,246,0.6)]"
            >
              <Plus className="w-4 h-4" /> New Prompt
            </button>
          )}
        </header>

        {(activeView !== 'trash' && activeView !== 'analytics') && (
          <div className="px-10 pt-8 pb-2 shrink-0">
            <div className="relative max-w-2xl group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 group-focus-within:bg-violet-500 group-focus-within:text-white transition-colors">
                <Sparkles className="w-4 h-4" />
              </div>
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search prompts by meaning, keywords, or intent..." className="w-full bg-[#0A0A0F]/80 backdrop-blur-md border border-white/5 rounded-2xl pl-14 pr-12 py-7 text-[14px] text-white placeholder-slate-500 focus-visible:ring-1 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/30 transition-all shadow-lg hover:border-white/10" />
              {isSearching ? <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-violet-400 animate-spin" /> : <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />}
            </div>
          </div>
        )}

        <div className="flex-1 p-10 pt-6 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/5 hover:[&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full relative">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

          {/* ANALYTICS VIEW */}
          {activeView === 'analytics' ? (
             <div className="relative z-10 max-w-5xl mx-auto space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="bg-[#0A0A0F]/80 border border-white/5 p-6 rounded-2xl flex items-center gap-5 shadow-lg">
                   <div className="w-14 h-14 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center border border-violet-500/20"><LayoutGrid className="w-6 h-6" /></div>
                   <div><p className="text-slate-400 text-[13px] font-medium mb-1">Total Active Prompts</p><h3 className="text-3xl font-bold text-white">{totalPrompts}</h3></div>
                 </div>
                 <div className="bg-[#0A0A0F]/80 border border-white/5 p-6 rounded-2xl flex items-center gap-5 shadow-lg">
                   <div className="w-14 h-14 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20"><Star className="w-6 h-6" /></div>
                   <div><p className="text-slate-400 text-[13px] font-medium mb-1">Total Favorites</p><h3 className="text-3xl font-bold text-white">{totalFavorites}</h3></div>
                 </div>
                 <div className="bg-[#0A0A0F]/80 border border-white/5 p-6 rounded-2xl flex items-center gap-5 shadow-lg">
                   <div className="w-14 h-14 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20"><Folder className="w-6 h-6" /></div>
                   <div><p className="text-slate-400 text-[13px] font-medium mb-1">Total Collections</p><h3 className="text-3xl font-bold text-white">{collections.length}</h3></div>
                 </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Platform Distribution Card */}
                  <div className="bg-[#0A0A0F]/80 border border-white/5 p-8 rounded-2xl shadow-lg">
                    <div className="flex items-center gap-3 mb-8">
                      <PieChart className="w-5 h-5 text-violet-400" />
                      <h3 className="text-[15px] font-semibold text-white">Platform Usage Distribution</h3>
                    </div>
                    
                    {totalPrompts === 0 ? (
                      <p className="text-slate-500 text-[13px]">No data available yet.</p>
                    ) : (
                      <div className="space-y-5">
                        {sortedPlatforms.map(([platform, count]) => {
                          const percentage = Math.round((count / totalPrompts) * 100)
                          return (
                            <div key={platform}>
                              <div className="flex justify-between text-[13px] mb-2 font-medium">
                                <span className="text-slate-300">{getPlatformLabel(platform)}</span>
                                <span className="text-slate-500">{percentage}% ({count})</span>
                              </div>
                              <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
                                <div className={`h-2.5 rounded-full ${getPlatformDotColor(platform)}`} style={{ width: `${percentage}%` }}></div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Quick Tips / Info Card */}
                  <div className="bg-gradient-to-br from-violet-600/10 to-indigo-600/10 border border-violet-500/20 p-8 rounded-2xl shadow-lg flex flex-col justify-center text-center">
                    <div className="w-16 h-16 bg-violet-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5 text-violet-400 shadow-[0_0_20px_-5px_rgba(139,92,246,0.5)]"><Activity className="w-8 h-8" /></div>
                    <h3 className="text-[18px] font-bold text-white mb-2">Build Your AI Brain</h3>
                    <p className="text-[14px] text-slate-400 leading-relaxed max-w-sm mx-auto">You have safely stored {totalPrompts} prompts in Prompax. As you add more, this dashboard will unlock deeper insights about your AI workflow.</p>
                  </div>
               </div>
             </div>
          ) : displayPrompts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-5 shadow-inner">
                {activeView === 'trash' ? <Trash2 className="w-6 h-6 text-slate-400" /> : searchResults !== null ? <Search className="w-6 h-6 text-slate-400" /> : <Folder className="w-6 h-6 text-slate-400" />}
              </div>
              <p className="text-white text-[16px] font-medium">{activeView === 'trash' ? 'Trash is empty' : searchResults !== null ? 'No matching prompts found' : 'No prompts found'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative z-10 pb-10">
              {displayPrompts.map(prompt => (
                <div key={prompt.id} className={`group flex flex-col backdrop-blur-sm border rounded-2xl p-6 transition-all duration-300 h-[280px] shadow-lg relative ${activeView === 'trash' ? 'bg-red-950/10 border-red-500/10 hover:border-red-500/30' : 'bg-[#0A0A0F]/80 border-white/5 hover:border-violet-500/40 hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.15)]'}`}>
                  
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className={`text-[15px] font-semibold leading-snug line-clamp-2 flex-1 transition-colors ${activeView === 'trash' ? 'text-slate-400 line-through decoration-red-500/50' : 'text-slate-100 group-hover:text-violet-100'}`}>
                      {prompt.title}
                    </h3>
                    
                    {activeView === 'trash' ? (
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleRestoreFromTrash(prompt.id)} title="Restore" className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"><RefreshCw className="w-4 h-4" /></button>
                        <button onClick={() => handlePermanentDelete(prompt.id)} title="Delete Permanently" className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => toggleFavorite(prompt)} 
                          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all outline-none"
                          title={prompt.is_favorite ? "Remove from favorites" : "Add to favorites"}
                        >
                          <Star className={`h-4 w-4 ${prompt.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-500 hover:text-amber-400 opacity-0 group-hover:opacity-100'}`} />
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all outline-none">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-[#1A1A28] border-white/10 text-slate-200 rounded-xl shadow-2xl p-1">
                            <DropdownMenuItem onClick={() => handleOptimizePrompt(prompt)} className="gap-2.5 cursor-pointer hover:bg-violet-500/10 focus:bg-violet-500/10 text-violet-300 py-2.5 font-medium">
                              <Wand2 className="h-4 w-4" /> AI Optimize <span className="ml-auto text-[9px] bg-violet-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">PRO</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/5 my-1" />
                            <DropdownMenuItem onClick={() => openWorkspace(prompt)} className="gap-2.5 cursor-pointer hover:bg-white/10 focus:bg-white/10 py-2.5">
                              <Edit2 className="h-4 w-4 text-slate-400" /> Open Workspace
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMoveToTrash(prompt.id)} className="gap-2.5 cursor-pointer text-red-400 focus:text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 py-2.5">
                              <Trash2 className="h-4 w-4" /> Move to Trash
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>

                  <div className="relative flex-1 overflow-hidden mb-4">
                    <p className={`text-[13px] leading-relaxed whitespace-pre-wrap ${activeView === 'trash' ? 'text-slate-600' : 'text-slate-400'}`}>{prompt.content}</p>
                    <div className={`absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t pointer-events-none transition-colors duration-300 ${activeView === 'trash' ? 'from-[#0A0A0F]/80 to-transparent' : 'from-[#0A0A0F] to-transparent group-hover:from-[#0d0d16]'}`} />
                  </div>

                  <div className="flex items-center gap-2 mt-auto pt-4 border-t border-white/5">
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-md border ${activeView === 'trash' ? 'bg-white/5 text-slate-500 border-transparent' : getPlatformStyle(prompt.platform)}`}>{getPlatformLabel(prompt.platform)}</span>
                    <span className={`text-[11px] bg-white/5 border border-white/5 px-2.5 py-1 rounded-md ${activeView === 'trash' ? 'text-slate-600' : 'text-slate-400'}`}>{prompt.category}</span>
                    
                    {activeView !== 'trash' && (
                      <button onClick={() => copyToClipboard(prompt.content, prompt.id)} className="ml-auto flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-violet-500/20 hover:text-violet-300 text-slate-400 transition-all border border-transparent hover:border-violet-500/30">
                        {copiedId === prompt.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* DEV EKRAN: FULL WORKSPACE (PROMPT EDITOR + VERSION HISTORY) */}
      <Dialog open={showAddPrompt} onOpenChange={(open) => {
        if (!submitting) {
          setShowAddPrompt(open);
          if(!open){ setEditingPrompt(null); setForm(emptyForm); setError(''); }
        }
      }}>
        <DialogContent className="bg-[#0A0A0F] border-white/10 rounded-2xl sm:max-w-[95vw] md:max-w-[95vw] lg:max-w-[95vw] w-[95vw] h-[95vh] shadow-2xl p-0 gap-0 overflow-hidden text-white [&>button]:hidden flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-gradient-to-r from-[#0A0A0F] to-[#111118] shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <LayoutGrid className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <DialogTitle className="text-[19px] font-semibold text-white tracking-tight">{editingPrompt ? 'Prompt Workspace' : 'Create New Prompt'}</DialogTitle>
                <p className="text-[13px] text-slate-400 mt-0.5">{editingPrompt ? `Managing: ${editingPrompt.title}` : 'Build your custom prompt template'}</p>
              </div>
            </div>
            {editingPrompt && (
              <div className="flex items-center bg-[#060609] p-1 rounded-xl border border-white/5">
                <button onClick={() => setActiveTab('editor')} className={`px-5 py-2.5 rounded-lg text-[13px] font-medium flex items-center gap-2 transition-all ${activeTab === 'editor' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}><Edit2 className="w-4 h-4" /> Prompt Editor</button>
                <button onClick={() => setActiveTab('history')} className={`px-5 py-2.5 rounded-lg text-[13px] font-medium flex items-center gap-2 transition-all ${activeTab === 'history' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}><History className="w-4 h-4" /> Version History<span className="text-[11px] bg-white/10 px-1.5 py-0.5 rounded-md text-slate-300">{promptVersions.length}</span></button>
              </div>
            )}
            <button onClick={() => setShowAddPrompt(false)} className="text-slate-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2.5 rounded-xl flex items-center gap-2 text-[13px] font-medium"><XCircle className="w-5 h-5" /> Close</button>
          </div>

          <div className="flex-1 overflow-hidden bg-[#060609]">
            {activeTab === 'editor' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 h-full overflow-hidden">
                <div className="p-8 space-y-6 bg-[#0A0A0F]/50 overflow-y-auto h-full border-r border-white/5">
                  {error && <div className="flex items-center gap-2 text-[13px] text-red-400 bg-red-500/10 p-4 rounded-xl border border-red-500/20"><AlertCircle className="w-4 h-4 flex-shrink-0" /><p>{error}</p></div>}
                  <div><label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Title</label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full bg-[#060609] border-white/10 rounded-xl px-4 py-6 text-[14px] text-white" /></div>
                  
                  <div>
                    <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Target Platform</label>
                    <Select value={form.platform} onValueChange={(v) => setForm(f => ({ ...f, platform: v, customPlatform: '' }))}>
                      <SelectTrigger className="w-full bg-[#060609] border-white/10 rounded-xl px-4 py-6 text-[13px] text-white"><SelectValue placeholder="Select Platform" /></SelectTrigger>
                      <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200 rounded-xl">{PLATFORMS.map(p => <SelectItem key={p.value} value={p.value} className="focus:bg-white/10 py-2.5">{p.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {form.platform === 'other' && (
                      <Input value={form.customPlatform} onChange={e => setForm(f => ({ ...f, customPlatform: e.target.value }))} placeholder="e.g. Midjourney" className="w-full mt-3 bg-[#060609] border-white/10 rounded-xl px-4 py-5 text-[13px] text-white" />
                    )}
                  </div>
                  
                  <div>
                    <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Category</label>
                    <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v, customCategory: '' }))}>
                      <SelectTrigger className="w-full bg-[#060609] border-white/10 rounded-xl px-4 py-6 text-[13px] text-white"><SelectValue placeholder="Select Category" /></SelectTrigger>
                      <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200 rounded-xl">{CATEGORIES.map(c => <SelectItem key={c} value={c} className="focus:bg-white/10 py-2.5">{c}</SelectItem>)}</SelectContent>
                    </Select>
                    {form.category === 'Other' && (
                      <Input value={form.customCategory} onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))} placeholder="Enter custom category..." className="w-full mt-3 bg-[#060609] border-white/10 rounded-xl px-4 py-5 text-[13px] text-white" />
                    )}
                  </div>

                  {collections.length > 0 && (
                    <div>
                      <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Collection</label>
                      <Select value={form.collection_id || "none"} onValueChange={(v) => setForm(f => ({ ...f, collection_id: v === "none" ? "" : v }))}>
                        <SelectTrigger className="w-full bg-[#060609] border-white/10 rounded-xl px-4 py-6 text-[13px] text-white"><SelectValue placeholder="Select Collection" /></SelectTrigger>
                        <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200 rounded-xl">
                          <SelectItem value="none" className="focus:bg-white/10 text-slate-500 py-2.5">None (Unorganized)</SelectItem>
                          {collections.map(c => <SelectItem key={c.id} value={c.id} className="focus:bg-white/10 py-2.5">{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-2 flex flex-col h-full">
                  <div className="p-6 pb-2"><label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider block">Prompt Template Content</label></div>
                  <div className="flex-1 px-6 pb-6 flex flex-col"><Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className="flex-1 w-full bg-[#0A0A0F] border border-white/5 rounded-2xl p-8 text-[15px] text-slate-200 leading-loose focus-visible:ring-1 focus-visible:ring-violet-500/50 resize-none shadow-inner [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full transition-colors" /></div>
                  <div className="p-6 border-t border-white/5 bg-[#0A0A0F] flex gap-4">
                    <button disabled={submitting} onClick={() => setShowAddPrompt(false)} className="px-6 py-4 rounded-xl border border-white/10 text-[14px] font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
                    <button disabled={submitting} onClick={editingPrompt ? handleEditPrompt : handleAddPrompt} className="flex-1 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-[14px] font-medium text-white transition-all shadow-[0_0_20px_-5px_rgba(139,92,246,0.5)] flex items-center justify-center gap-2">
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> {editingPrompt ? 'Save Modifications & Log Version' : 'Create Prompt'}</>}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full overflow-hidden p-10">
                {loadingVersions ? (
                  <div className="h-full flex items-center justify-center"><Loader2 className="w-10 h-10 text-violet-500 animate-spin" /></div>
                ) : promptVersions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <History className="w-12 h-12 text-slate-600 mb-4" />
                    <p className="text-[16px] font-medium text-white">No version logs found yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 h-full overflow-y-auto pb-12 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/5 hover:[&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {promptVersions.map((version) => (
                      <div key={version.id} className="flex flex-col bg-[#0A0A0F] border border-white/5 rounded-2xl p-6 h-[320px] relative hover:border-violet-500/30 transition-all group">
                        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-bold text-violet-400 bg-violet-500/10 px-2.5 py-1 rounded-md">V{version.version_num}</span>
                            <span className="text-[12px] text-slate-500">{new Date(version.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <button onClick={() => handleRestoreVersion(version.content)} className="text-[12px] font-medium text-violet-400 hover:text-white flex items-center gap-1.5 bg-violet-500/5 hover:bg-violet-600 px-3 py-1.5 rounded-lg transition-all"><RotateCcw className="w-3.5 h-3.5" /> Restore</button>
                        </div>
                        <div className="flex-1 overflow-hidden relative mb-2">
                          <p className="text-[13px] text-slate-400 font-mono leading-relaxed whitespace-pre-wrap">{version.content}</p>
                          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0A0A0F] to-transparent pointer-events-none" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* SHADCN DIALOG: AI OPTIMIZE MODAL */}
      <Dialog open={showOptimizeModal} onOpenChange={(open) => { if (!isOptimizing) setShowOptimizeModal(open) }}>
        <DialogContent className="bg-[#0A0A0F] border-white/10 rounded-2xl sm:max-w-[95vw] w-[95vw] h-[95vh] shadow-2xl p-0 gap-0 overflow-hidden text-white [&>button]:hidden flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-gradient-to-r from-[#0A0A0F] to-[#111118] shrink-0">
            <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center"><Wand2 className="w-6 h-6 text-violet-400" /></div><div><DialogTitle className="text-[19px] font-semibold text-white tracking-tight">AI Prompt Optimization</DialogTitle><p className="text-[13px] text-violet-400/70 font-medium mt-0.5">Pro Feature Preview</p></div></div>
            {!isOptimizing && <button onClick={() => setShowOptimizeModal(false)} className="text-slate-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2.5 rounded-xl flex items-center gap-2 text-[13px] font-medium"><XCircle className="w-5 h-5" /> Close</button>}
          </div>
          <div className="flex-1 overflow-hidden bg-[#060609] relative">
            {isOptimizing && !optimizeResult ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6 z-10 bg-[#060609]"><div className="relative"><div className="absolute inset-0 bg-violet-500 blur-2xl opacity-20 rounded-full animate-pulse"></div><Loader2 className="w-14 h-14 text-violet-500 animate-spin relative z-10" /></div><div className="text-center"><p className="text-[18px] font-medium text-white mb-2">Analyzing and rebuilding your prompt...</p></div></div>
            ) : optimizeResult ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 h-full overflow-hidden divide-y lg:divide-x divide-white/5">
                <div className="p-10 space-y-10 bg-[#0A0A0F]/50 overflow-y-auto h-full [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/5 hover:[&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <div><h4 className="text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2"><LayoutGrid className="w-4 h-4" /> Original Prompt</h4><div className="bg-black/40 border border-white/5 rounded-xl p-6 text-[14px] text-slate-400">{optimizingPrompt?.content}</div></div>
                  <div className="space-y-8">
                    <div className="bg-green-500/5 border border-green-500/10 rounded-2xl p-6"><h4 className="text-[12px] font-bold text-green-500/90 uppercase tracking-wider mb-4 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Strengths</h4><ul className="space-y-3">{optimizeResult.strengths.map((str, i) => <li key={i} className="text-[14px] text-slate-300 flex items-start gap-3"><span className="w-1.5 h-1.5 rounded-full bg-green-500/60 mt-2 flex-shrink-0" /> {str}</li>)}</ul></div>
                    <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6"><h4 className="text-[12px] font-bold text-red-400/90 uppercase tracking-wider mb-4 flex items-center gap-2"><XCircle className="w-4 h-4" /> Weaknesses</h4><ul className="space-y-3">{optimizeResult.weaknesses.map((weak, i) => <li key={i} className="text-[14px] text-slate-300 flex items-start gap-3"><span className="w-1.5 h-1.5 rounded-full bg-red-400/60 mt-2 flex-shrink-0" /> {weak}</li>)}</ul></div>
                  </div>
                </div>
                <div className="flex flex-col h-full bg-[#060609]">
                  <div className="p-8 pb-4 shrink-0"><h4 className="text-[12px] font-bold text-violet-400 uppercase tracking-wider flex items-center gap-2"><Sparkles className="w-4 h-4" /> Optimized Version</h4></div>
                  <div className="flex-1 p-8 pt-0 flex flex-col"><Textarea value={optimizeResult.improved_prompt} onChange={(e) => setOptimizeResult(prev => prev ? {...prev, improved_prompt: e.target.value} : null)} className="flex-1 w-full bg-violet-500/5 border border-violet-500/20 rounded-2xl p-8 text-[15px] text-slate-200 resize-none [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full transition-colors" /></div>
                  <div className="p-8 pt-4 border-t border-white/5 shrink-0 bg-[#0A0A0F]"><button disabled={isOptimizing} onClick={acceptOptimization} className="w-full py-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-[14px] font-medium text-white shadow-[0_0_20px_-5px_rgba(139,92,246,0.5)] flex items-center justify-center gap-2"><CheckCircle2 className="w-5 h-5" /> Replace Original With Optimized</button></div>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* SHADCN DIALOG: Add Collection Modal */}
      <Dialog open={showAddCollection} onOpenChange={(open) => { setShowAddCollection(open); setError(''); }}>
        <DialogContent className="bg-[#111118] border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-0 gap-0 overflow-hidden text-white [&>button]:hidden">
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#0A0A0F]/50"><DialogTitle className="text-[16px] font-semibold text-white">New Collection</DialogTitle><button onClick={() => setShowAddCollection(false)} className="text-slate-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-lg"><XCircle className="w-4 h-4" /></button></div>
          <div className="p-6 space-y-5">
            {error && <div className="text-red-400 bg-red-500/10 p-3.5 rounded-xl text-[13px]"><p>{error}</p></div>}
            <div><label className="text-[12px] font-medium text-slate-400 mb-2 block">Name</label><Input value={collectionForm.name} onChange={e => setCollectionForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-[#060609] border-white/10 rounded-xl px-4 py-6 text-[14px] text-white" /></div>
            <div><label className="text-[12px] font-medium text-slate-400 mb-2 block">Description</label><Input value={collectionForm.description} onChange={e => setCollectionForm(f => ({ ...f, description: e.target.value }))} className="w-full bg-[#060609] border-white/10 rounded-xl px-4 py-6 text-[14px] text-white" /></div>
          </div>
          <div className="flex gap-3 p-6 border-t border-white/5 bg-[#0A0A0F]/50">
            <button onClick={() => setShowAddCollection(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-[13px] text-slate-400 hover:bg-white/5">Cancel</button>
            <button onClick={handleAddCollection} disabled={submitting} className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-[13px] text-white shadow-[0_0_15px_-3px_rgba(139,92,246,0.5)]">Create</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}