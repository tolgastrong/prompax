'use client'

import { useEffect, useState, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { 
  Copy, Plus, MoreVertical, Edit2, Trash2, Folder, LayoutGrid, AlertCircle, 
  Check, Search, Sparkles, Loader2, Wand2, XCircle, CheckCircle2, History, 
  RotateCcw, Star, Clock, Settings, BookOpen, MessageSquare, Share2, Zap,
  BarChart2, ChevronLeft, ChevronRight, Activity, RefreshCw, PieChart, ShieldAlert,
  ChevronDown, Library, Mail, MessageCircle, Code2, FileText, Lightbulb
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
  deleted_at: string | null
}

type Collection = {
  id: string
  name: string
  description: string
  is_public: boolean
}

type Output = {
  id: string
  prompt_id: string | null
  content: string
  format: string
  platform: string
  notes: string | null
  metrics: any
  created_at: string
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
const FORMATS = ['email', 'tweet', 'social_post', 'article', 'ad_copy', 'code', 'other']

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

function getFormatIcon(format: string) {
  switch(format) {
    case 'email': return <Mail className="w-3.5 h-3.5" />
    case 'tweet': case 'social_post': return <MessageCircle className="w-3.5 h-3.5" />
    case 'code': return <Code2 className="w-3.5 h-3.5" />
    case 'article': return <FileText className="w-3.5 h-3.5" />
    default: return <Lightbulb className="w-3.5 h-3.5" />
  }
}

const emptyForm = { title: '', content: '', platform: 'chatgpt', category: 'General', collection_id: '', customPlatform: '', customCategory: '' }
const emptyOutputForm = { content: '', format: 'email', platform: 'chatgpt', prompt_id: 'none', notes: '', customFormat: '', customPlatform: '', magicPasteContent: '' }

export default function Dashboard() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [user, setUser] = useState<{ id?: string, email?: string; user_metadata?: { full_name?: string; avatar_url?: string } } | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [outputs, setOutputs] = useState<Output[]>([])
  const [loading, setLoading] = useState(true)
  
  const [isCollapsed, setIsCollapsed] = useState(false)

  const [expandedSections, setExpandedSections] = useState({
    workspace: true,
    insights: true,
    collections: true,
    platforms: true,
    resources: true
  })

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const [showAddPrompt, setShowAddPrompt] = useState(false)
  const [showAddCollection, setShowAddCollection] = useState(false)
  const [showAddOutput, setShowAddOutput] = useState(false)
  const [viewingOutput, setViewingOutput] = useState<Output | null>(null)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null)
  
  const [activeView, setActiveView] = useState<'all' | 'favorites' | 'recent' | 'trash' | 'analytics' | 'outputs' | 'platform' | 'collection'>('all')
  const [activeCollection, setActiveCollection] = useState<string | null>(null)
  const [activePlatform, setActivePlatform] = useState<string | null>(null)
  
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Prompt[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  const [showOptimizeModal, setShowOptimizeModal] = useState(false)
  const [optimizingPrompt, setOptimizingPrompt] = useState<Prompt | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null)
  const [optimizeError, setOptimizeError] = useState('')

  const [activeTab, setActiveTab] = useState<'editor' | 'history'>('editor')
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)

  const [form, setForm] = useState(emptyForm)
  const [outputForm, setOutputForm] = useState(emptyOutputForm)
  const [collectionForm, setCollectionForm] = useState({ name: '', description: '' })
  
  const [submitting, setSubmitting] = useState(false)
  const [isMagicPasting, setIsMagicPasting] = useState(false)
  const [error, setError] = useState('')

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
      if (searchQuery.trim().length > 2 && activeView !== 'outputs') {
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
  }, [searchQuery, activePrompts, activeView])

  const fetchAll = async () => {
    const [p, c, o] = await Promise.all([
      fetch('/api/prompts').then(r => r.json()).catch(() => []),
      fetch('/api/collections').then(r => r.json()).catch(() => []),
      fetch('/api/outputs').then(r => r.ok ? r.json() : []).catch(() => [])
    ])
    if (Array.isArray(p)) setPrompts(p)
    if (Array.isArray(c)) setCollections(c)
    if (Array.isArray(o)) setOutputs(o)
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
  const getFinalOutputPlatform = () => outputForm.platform === 'other' && outputForm.customPlatform.trim() ? outputForm.customPlatform.trim().toLowerCase().replace(/\s+/g, '-') : outputForm.platform
  const getFinalOutputFormat = () => outputForm.format === 'other' && outputForm.customFormat.trim() ? outputForm.customFormat.trim().toLowerCase().replace(/\s+/g, '_') : outputForm.format

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
      let data; try { data = JSON.parse(text) } catch (e) { throw new Error('Server error') }
      if (!res.ok) setError(data.error === 'FREE_LIMIT_REACHED' ? 'Free plan limit reached. Upgrade to Pro.' : data.error)
      else { setPrompts(prev => [data, ...prev]); setForm(emptyForm); setShowAddPrompt(false) }
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

  const handleAddOutput = async () => {
    if (!outputForm.content.trim()) { setError('Output content is required.'); return }
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: outputForm.content.trim(),
          format: getFinalOutputFormat(),
          platform: getFinalOutputPlatform(),
          prompt_id: outputForm.prompt_id === 'none' ? null : outputForm.prompt_id,
          notes: outputForm.notes.trim() || null
        }),
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to save output')
      }
      const data = await res.json()
      setOutputs(prev => [data, ...prev])
      setOutputForm(emptyOutputForm)
      setShowAddOutput(false)
    } catch (err: any) { 
      console.error(err)
      const fakeData: Output = {
        id: Math.random().toString(),
        prompt_id: outputForm.prompt_id === 'none' ? null : outputForm.prompt_id,
        content: outputForm.content,
        format: getFinalOutputFormat(),
        platform: getFinalOutputPlatform(),
        notes: outputForm.notes,
        metrics: {},
        created_at: new Date().toISOString()
      }
      setOutputs(prev => [fakeData, ...prev])
      setShowAddOutput(false)
    }
    finally { setSubmitting(false) }
  }

  const handleMagicPaste = async () => {
    if (!outputForm.magicPasteContent.trim()) { setError('Please paste your full chat log first.'); return }
    setIsMagicPasting(true); setError('')
    try {
      const res = await fetch('/api/outputs/magic-paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: outputForm.magicPasteContent }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Magic Paste analysis failed')
      
      const isKnownFormat = FORMATS.includes(data.format)
      const isKnownPlatform = PLATFORMS.some(p => p.value === data.platform)

      let linkedPromptId = outputForm.prompt_id
      
      // Auto-extract and save prompt
      if(data.extracted_prompt && data.extracted_prompt.length > 5) {
          try {
            const promptRes = await fetch('/api/prompts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: data.suggested_title || 'Auto-Extracted Prompt',
                content: data.extracted_prompt,
                platform: isKnownPlatform ? data.platform : 'other',
                category: isKnownFormat ? data.format : 'Other',
                collection_id: null,
              }),
            })
            if(promptRes.ok) {
              const savedPrompt = await promptRes.json()
              setPrompts(prev => [savedPrompt, ...prev])
              linkedPromptId = savedPrompt.id
            }
          } catch(e) { console.error("Could not auto-save prompt", e) }
      }

      setOutputForm(prev => ({
        ...prev,
        content: data.output_content || prev.content,
        format: isKnownFormat ? data.format : 'other',
        customFormat: isKnownFormat ? '' : (data.format || ''),
        platform: isKnownPlatform ? data.platform : 'other',
        customPlatform: isKnownPlatform ? '' : (data.platform || ''),
        notes: data.notes || prev.notes,
        prompt_id: linkedPromptId,
        magicPasteContent: ''
      }))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsMagicPasting(false)
    }
  }

  const handleDeleteOutput = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this saved output?")) return
    setOutputs(prev => prev.filter(o => o.id !== id))
    setViewingOutput(null)
    await fetch(`/api/outputs/${id}`, { method: 'DELETE' }).catch(()=> {})
  }

  const toggleFavorite = async (prompt: Prompt, e: React.MouseEvent) => {
    e.stopPropagation() 
    const newStatus = !prompt.is_favorite
    setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, is_favorite: newStatus } : p))
    if (searchResults) setSearchResults(prev => prev ? prev.map(p => p.id === prompt.id ? { ...p, is_favorite: newStatus } : p) : null)
    try {
      await fetch(`/api/prompts/${prompt.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...prompt, is_favorite: newStatus }) })
    } catch (err) { setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, is_favorite: !newStatus } : p)) }
  }

  const handleRestoreVersion = async (versionContent: string) => {
    if (!editingPrompt) return
    if (!window.confirm("Are you sure you want to replace the current content with this version?")) return
    setForm(f => ({ ...f, content: versionContent }))
    setActiveTab('editor')
  }

  const handleMoveToTrash = async (id: string, e?: React.MouseEvent) => {
    if(e) e.stopPropagation()
    const now = new Date().toISOString()
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, deleted_at: now, is_favorite: false } : p))
    if (searchResults) setSearchResults(prev => prev ? prev.filter(p => p.id !== id) : null)
    await supabase.from('prompts').update({ deleted_at: now, is_favorite: false }).eq('id', id)
  }

  const handleRestoreFromTrash = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, deleted_at: null } : p))
    await supabase.from('prompts').update({ deleted_at: null }).eq('id', id)
  }

  const handlePermanentDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm("This action is permanent and cannot be undone. Are you sure?")) return
    setPrompts(prev => prev.filter(p => p.id !== id))
    await supabase.from('prompts').delete().eq('id', id)
  }

  const handleSaveCollection = async () => {
    if (!collectionForm.name.trim()) return
    setSubmitting(true); setError('')
    if (editingCollection) {
      try {
        const res = await fetch(`/api/collections/${editingCollection.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(collectionForm) })
        const data = await res.json()
        if (!res.ok) setError(data.error || 'Failed to update collection.')
        else { setCollections(prev => prev.map(c => c.id === editingCollection.id ? data : c)); setShowAddCollection(false); setEditingCollection(null); setCollectionForm({ name: '', description: '' }) }
      } catch (err: any) { setError('Operation failed') }
    } else {
      try {
        const res = await fetch('/api/collections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(collectionForm) })
        const data = await res.json()
        if (!res.ok) setError(data.error === 'FREE_COLLECTION_LIMIT' ? 'Free plan allows max 3 collections. Upgrade to Pro.' : data.error)
        else { setCollections(prev => [data, ...prev]); setCollectionForm({ name: '', description: '' }); setShowAddCollection(false) }
      } catch (err: any) { setError('Operation failed') }
    }
    setSubmitting(false)
  }

  const handleDeleteCollection = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm("Are you sure you want to delete this collection? Prompts inside will not be deleted, but will become unorganized.")) return
    await fetch(`/api/collections/${id}`, { method: 'DELETE' })
    setCollections(prev => prev.filter(c => c.id !== id))
    if (activeCollection === id) setNav('all')
    setPrompts(prev => prev.map(p => p.collection_id === id ? { ...p, collection_id: null } : p))
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

  const handleOptimizePrompt = async (prompt: Prompt, e: React.MouseEvent) => {
    e.stopPropagation()
    setOptimizingPrompt(prompt)
    setOptimizeResult(null); setOptimizeError(''); setShowOptimizeModal(true); setIsOptimizing(true)
    try {
      const res = await fetch('/api/prompts/optimize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: prompt.content }) })
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
      const res = await fetch(`/api/prompts/${optimizingPrompt.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: optimizingPrompt.title, content: optimizeResult.improved_prompt, platform: optimizingPrompt.platform, category: optimizingPrompt.category, collection_id: optimizingPrompt.collection_id }) })
      const data = await res.json()
      if (res.ok) {
        setPrompts(prev => prev.map(p => p.id === optimizingPrompt.id ? data : p))
        if (searchResults) setSearchResults(prev => prev ? prev.map(p => p.id === optimizingPrompt.id ? data : p) : null)
        setShowOptimizeModal(false)
      }
    } catch (err) { setOptimizeError('Failed to save the new prompt.') } 
    finally { setIsOptimizing(false) }
  }

  const copyToClipboard = (text: string, id: string, e?: React.MouseEvent) => {
    if(e) e.stopPropagation()
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

  // KEYBOARD EVENT HANDLERS
  const handleKeyDownCollection = (e: React.KeyboardEvent) => { 
    if (e.key === 'Enter') { e.preventDefault(); handleSaveCollection() } 
  }
  const handleKeyDownPrompt = (e: React.KeyboardEvent) => { 
    if (e.key === 'Enter') { e.preventDefault(); editingPrompt ? handleEditPrompt() : handleAddPrompt() } 
  }
  const handleKeyDownOutput = (e: React.KeyboardEvent) => { 
    if (e.key === 'Enter') { e.preventDefault(); handleAddOutput() } 
  }
  const handleKeyDownTextarea = (e: React.KeyboardEvent, submitFn: () => void) => { 
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submitFn() } 
  }

  const standardPlatforms = ['chatgpt', 'claude', 'gemini', 'deepseek'];
  const uniqueUserPlatforms = Array.from(new Set(activePrompts.map(p => p.platform)));
  const customPlatforms = uniqueUserPlatforms.filter(p => !standardPlatforms.includes(p) && p !== 'other');
  const sidebarPlatforms = [...standardPlatforms, ...customPlatforms];

  let filteredPrompts = activePrompts
  if (activeView === 'favorites') filteredPrompts = activePrompts.filter(p => p.is_favorite)
  else if (activeView === 'recent') filteredPrompts = [...activePrompts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  else if (activeView === 'collection') filteredPrompts = activePrompts.filter(p => p.collection_id === activeCollection)
  else if (activeView === 'platform') filteredPrompts = activePrompts.filter(p => p.platform === activePlatform)
  else if (activeView === 'trash') filteredPrompts = trashedPrompts
  
  const displayPrompts = searchResults !== null ? searchResults : filteredPrompts

  const totalPrompts = activePrompts.length
  const totalFavorites = activePrompts.filter(p => p.is_favorite).length
  
  const platformCounts = activePrompts.reduce((acc, p) => { acc[p.platform] = (acc[p.platform] || 0) + 1; return acc }, {} as Record<string, number>)
  const sortedPlatforms = Object.entries(platformCounts).sort(([,a], [,b]) => b - a).slice(0, 4)

  if (loading) return (
    <div className="min-h-screen bg-[#060609] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#060609] text-slate-200 font-sans selection:bg-violet-500/30 flex overflow-hidden">
      
      {/* ========================================== */}
      {/* SIDEBAR                                      */}
      {/* ========================================== */}
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
            {!isCollapsed && (
              <div className="flex items-center justify-between px-4 mb-3 cursor-pointer group" onClick={() => toggleSection('workspace')}>
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">Workspace</h3>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${expandedSections.workspace ? '' : '-rotate-90'}`} />
              </div>
            )}
            
            {(expandedSections.workspace || isCollapsed) && (
              <>
                <button 
                  onClick={() => setNav('all')} 
                  title={isCollapsed ? "All Prompts" : ""} 
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'all' ? 'bg-violet-500/10 text-violet-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                >
                  <LayoutGrid className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <>All Prompts <span className="ml-auto text-[11px] bg-white/5 px-2 py-0.5 rounded-md font-medium text-slate-300">{activePrompts.length}</span></>}
                </button>

                <button 
                  onClick={() => setNav('outputs')} 
                  title={isCollapsed ? "Saved Outputs" : ""} 
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'outputs' ? 'bg-pink-500/10 text-pink-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                >
                  <Library className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <>Swipe File <span className="ml-auto text-[9px] bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded tracking-widest uppercase">New</span></>}
                </button>
                
                <button 
                  onClick={() => setNav('favorites')} 
                  title={isCollapsed ? "Favorites" : ""} 
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'favorites' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                >
                  <Star className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <>Favorites <span className="ml-auto text-[11px] bg-white/5 px-2 py-0.5 rounded-md font-medium text-slate-300">{totalFavorites}</span></>}
                </button>
                
                <button 
                  onClick={() => setNav('recent')} 
                  title={isCollapsed ? "Recently Used" : ""} 
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'recent' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                >
                  <Clock className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span>Recently Used</span>}
                </button>

                <button 
                  onClick={() => setNav('trash')} 
                  title={isCollapsed ? "Trash" : ""} 
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'trash' ? 'bg-red-500/10 text-red-400' : 'text-slate-400 hover:text-red-400 hover:bg-white/5'}`}
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <>Trash {trashedPrompts.length > 0 && <span className="ml-auto text-[11px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-md font-medium">{trashedPrompts.length}</span>}</>}
                </button>
              </>
            )}
          </div>

          {/* INSIGHTS / ANALYTICS */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-4 mb-3 cursor-pointer group" onClick={() => toggleSection('insights')}>
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">Insights</h3>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${expandedSections.insights ? '' : '-rotate-90'}`} />
              </div>
            )}
            {(expandedSections.insights || isCollapsed) && (
              <button 
                onClick={() => setNav('analytics')} 
                title={isCollapsed ? "Analytics & Usage" : ""} 
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'analytics' ? 'bg-green-500/10 text-green-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
              >
                <BarChart2 className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Analytics & Usage</span>}
              </button>
            )}
          </div>

          {/* COLLECTIONS */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-4 mb-3">
                <div className="flex items-center gap-2 cursor-pointer group flex-1" onClick={() => toggleSection('collections')}>
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">Collections</h3>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${expandedSections.collections ? '' : '-rotate-90'}`} />
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowAddCollection(true); setError(''); setEditingCollection(null); setCollectionForm({name: '', description: ''}) }} 
                  className="text-slate-400 hover:text-violet-400 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
            
            {isCollapsed && (
              <button 
                onClick={() => { setShowAddCollection(true); setError(''); setEditingCollection(null); setCollectionForm({name: '', description: ''}) }} 
                title="Add Collection" 
                className="w-full flex justify-center py-2 text-slate-400 hover:text-violet-400"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            
            {(expandedSections.collections || isCollapsed) && collections.map(col => (
              <div key={col.id} className="relative group/col flex items-center">
                <button 
                  onClick={() => setNav('collection', col.id)} 
                  title={isCollapsed ? col.name : ""} 
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4 pr-10'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeCollection === col.id ? 'bg-violet-500/10 text-violet-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                >
                  <Folder className="w-4 h-4 shrink-0" /> 
                  {!isCollapsed && (
                    <>
                      <span className="truncate">{col.name}</span>
                      <span className="ml-auto text-[11px] text-slate-500">{activePrompts.filter(p => p.collection_id === col.id).length}</span>
                    </>
                  )}
                </button>

                {!isCollapsed && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="absolute right-2 p-1.5 rounded-md text-slate-500 opacity-0 group-hover/col:opacity-100 hover:bg-white/10 hover:text-slate-200 transition-all outline-none">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36 bg-[#1A1A28] border-white/10 text-slate-200 rounded-xl shadow-2xl p-1">
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); setEditingCollection(col); setCollectionForm({name: col.name, description: col.description || ''}); setShowAddCollection(true); setError(''); }} 
                        className="gap-2.5 cursor-pointer hover:bg-white/10 py-2 text-[12px] font-medium"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-400" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/5 my-1" />
                      <DropdownMenuItem 
                        onClick={(e) => handleDeleteCollection(col.id, e as any)} 
                        className="gap-2.5 cursor-pointer text-red-400 focus:text-red-400 hover:bg-red-500/10 py-2 text-[12px] font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>

          {/* PLATFORMS */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-4 mb-3 cursor-pointer group" onClick={() => toggleSection('platforms')}>
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">Platforms</h3>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${expandedSections.platforms ? '' : '-rotate-90'}`} />
              </div>
            )}
            
            {(expandedSections.platforms || isCollapsed) && sidebarPlatforms.map(plat => (
              <button 
                key={plat} 
                onClick={() => setNav('platform', null, plat)} 
                title={isCollapsed ? getPlatformLabel(plat) : ""} 
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activePlatform === plat ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${getPlatformDotColor(plat)}`} /> 
                {!isCollapsed && <span>{getPlatformLabel(plat)}</span>}
              </button>
            ))}
          </div>

          {/* RESOURCES (GERİ GETİRİLDİ) */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-4 mb-3 cursor-pointer group" onClick={() => toggleSection('resources')}>
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">Resources</h3>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${expandedSections.resources ? '' : '-rotate-90'}`} />
              </div>
            )}
            
            {(expandedSections.resources || isCollapsed) && (
              <>
                <button 
                  title={isCollapsed ? "Prompt Guide" : ""} 
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all`}
                >
                  <BookOpen className="w-4 h-4 shrink-0" /> 
                  {!isCollapsed && <span>Prompt Guide</span>}
                </button>
                
                <button 
                  title={isCollapsed ? "Submit Feedback" : ""} 
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all`}
                >
                  <MessageSquare className="w-4 h-4 shrink-0" /> 
                  {!isCollapsed && <span>Submit Feedback</span>}
                </button>
                
                <button 
                  title={isCollapsed ? "Settings & API" : ""} 
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all`}
                >
                  <Settings className="w-4 h-4 shrink-0" /> 
                  {!isCollapsed && <span>Settings & API</span>}
                </button>
              </>
            )}
          </div>

        </div>

        {/* PRO UPGRADE & USER */}
        <div className="p-4 border-t border-white/5 bg-[#060609]/50 shrink-0 space-y-3">
          <button 
            title={isCollapsed ? "Upgrade to Pro" : ""} 
            className={`w-full flex items-center justify-center ${isCollapsed ? 'p-3' : 'gap-2 py-3'} bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[13px] font-semibold rounded-xl transition-all shadow-[0_0_15px_-3px_rgba(139,92,246,0.4)] hover:shadow-[0_0_20px_-3px_rgba(139,92,246,0.6)]`}
          >
            <Zap className="w-4 h-4 fill-current shrink-0" /> 
            {!isCollapsed && <span>Upgrade to Pro</span>}
          </button>
          
          <div 
            title={isCollapsed ? (user?.user_metadata?.full_name || user?.email) : ""} 
            className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer`}
          >
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

      {/* ========================================== */}
      {/* MAIN CONTENT HEADER                          */}
      {/* ========================================== */}
      <main className="flex-1 flex flex-col relative h-screen overflow-hidden">
        <header className="sticky top-0 z-10 bg-[#060609]/80 backdrop-blur-xl border-b border-white/5 px-10 py-6 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[22px] font-bold text-white tracking-tight flex items-center gap-2">
                {searchResults !== null ? 'Search Results' : 
                 activeView === 'outputs' ? 'Saved Outputs (Swipe File)' :
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
            
            {(activeView !== 'trash' && activeView !== 'analytics' && activeView !== 'outputs') && (
              <p className="text-[13px] text-slate-400 mt-1.5">
                {searchResults !== null ? `Found ${displayPrompts.length} matching prompts` : `${filteredPrompts.length} prompts safely stored`}
              </p>
            )}
            
            {activeView === 'outputs' && (
              <p className="text-[13px] text-slate-400 mt-1.5">
                {outputs.length} successful AI generation assets saved.
              </p>
            )}
            
            {activeView === 'trash' && (
              <p className="text-[13px] text-red-400 mt-1.5 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Items in trash will be permanently deleted after 30 days.
              </p>
            )}
          </div>
          
          {(activeView !== 'trash' && activeView !== 'analytics') && (
            <button 
              onClick={() => { 
                if(activeView === 'outputs') { 
                  setShowAddOutput(true); 
                  setOutputForm(emptyOutputForm); 
                  setError(''); 
                } else { 
                  setShowAddPrompt(true); 
                  setEditingPrompt(null); 
                  setForm(emptyForm); 
                  setError(''); 
                } 
              }}
              className={`flex items-center gap-2 text-white text-[13px] font-medium px-5 py-2.5 rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(139,92,246,0.4)] ${activeView === 'outputs' ? 'bg-pink-600 hover:bg-pink-500 shadow-[0_0_20px_-5px_rgba(236,72,153,0.4)] hover:shadow-[0_0_25px_-5px_rgba(236,72,153,0.6)]' : 'bg-violet-600 hover:bg-violet-500 hover:shadow-[0_0_25px_-5px_rgba(139,92,246,0.6)]'}`}
            >
              <Plus className="w-4 h-4" /> 
              {activeView === 'outputs' ? 'Save Output' : 'New Prompt'}
            </button>
          )}
        </header>

        {/* ========================================== */}
        {/* SEARCH BAR                                   */}
        {/* ========================================== */}
        {(activeView !== 'trash' && activeView !== 'analytics' && activeView !== 'outputs') && (
          <div className="px-10 pt-8 pb-2 shrink-0">
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
        )}

        {/* ========================================== */}
        {/* MAIN VIEWS (OUTPUTS, ANALYTICS, PROMPTS)     */}
        {/* ========================================== */}
        <div className="flex-1 p-10 pt-6 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/5 hover:[&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full relative">
          
          {/* Background Glow */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

          {/* VIEW: OUTPUTS / SWIPE FILE */}
          {activeView === 'outputs' ? (
            outputs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center relative z-10">
                <div className="w-20 h-20 rounded-3xl bg-pink-500/5 border border-pink-500/10 flex items-center justify-center mb-6 shadow-inner">
                  <Library className="w-10 h-10 text-pink-400/50" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Build your Swipe File</h2>
                <p className="text-[14px] text-slate-500 max-w-md mb-6">Stop losing your best AI generations. Save successful emails, viral tweets, and perfect code snippets here.</p>
                <button 
                  onClick={() => setShowAddOutput(true)} 
                  className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-[13px] font-medium transition-colors border border-white/10"
                >
                  Save Your First Output
                </button>
              </div>
            ) : (
              <div className="columns-1 md:columns-2 xl:columns-3 gap-6 space-y-6 relative z-10 pb-10">
                {outputs.map(output => (
                  <div 
                    key={output.id} 
                    onClick={() => setViewingOutput(output)} 
                    className="break-inside-avoid cursor-pointer group flex flex-col bg-[#0A0A0F]/80 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-pink-500/40 transition-all duration-300 shadow-lg hover:shadow-[0_0_30px_-5px_rgba(236,72,153,0.15)] relative"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-white/5 px-2.5 py-1 rounded-md">
                        {getFormatIcon(output.format)} 
                        {output.format.replace('_', ' ')}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${getPlatformDotColor(output.platform)}`} title={getPlatformLabel(output.platform)} />
                    </div>
                    
                    <div className="relative overflow-hidden">
                      <p className="text-[14px] text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-6">{output.content}</p>
                      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0A0A0F] to-transparent pointer-events-none group-hover:from-[#0d0d16] transition-colors duration-300" />
                    </div>
                    
                    {output.prompt_id && prompts.find(p => p.id === output.prompt_id) && (
                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center text-[11px] text-slate-500">
                        <Sparkles className="w-3 h-3 mr-1.5 text-violet-400" />
                        Generated from: <span className="ml-1 text-slate-300 truncate font-medium">{prompts.find(p => p.id === output.prompt_id)?.title}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
            
          /* VIEW: ANALYTICS */
          ) : activeView === 'analytics' ? (
             <div className="relative z-10 max-w-5xl mx-auto space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 
                 <div className="bg-[#0A0A0F]/80 border border-white/5 p-6 rounded-2xl flex items-center gap-5 shadow-lg">
                   <div className="w-14 h-14 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center border border-violet-500/20">
                     <LayoutGrid className="w-6 h-6" />
                   </div>
                   <div>
                     <p className="text-slate-400 text-[13px] font-medium mb-1">Total Active Prompts</p>
                     <h3 className="text-3xl font-bold text-white">{totalPrompts}</h3>
                   </div>
                 </div>
                 
                 <div className="bg-[#0A0A0F]/80 border border-white/5 p-6 rounded-2xl flex items-center gap-5 shadow-lg">
                   <div className="w-14 h-14 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                     <Star className="w-6 h-6" />
                   </div>
                   <div>
                     <p className="text-slate-400 text-[13px] font-medium mb-1">Total Favorites</p>
                     <h3 className="text-3xl font-bold text-white">{totalFavorites}</h3>
                   </div>
                 </div>
                 
                 <div className="bg-[#0A0A0F]/80 border border-white/5 p-6 rounded-2xl flex items-center gap-5 shadow-lg">
                   <div className="w-14 h-14 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                     <Folder className="w-6 h-6" />
                   </div>
                   <div>
                     <p className="text-slate-400 text-[13px] font-medium mb-1">Total Collections</p>
                     <h3 className="text-3xl font-bold text-white">{collections.length}</h3>
                   </div>
                 </div>

               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
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
                          const percentage = Math.round((count / totalPrompts) * 100); 
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
                  
                  <div className="bg-gradient-to-br from-violet-600/10 to-indigo-600/10 border border-violet-500/20 p-8 rounded-2xl shadow-lg flex flex-col justify-center text-center">
                    <div className="w-16 h-16 bg-violet-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5 text-violet-400 shadow-[0_0_20px_-5px_rgba(139,92,246,0.5)]">
                      <Activity className="w-8 h-8" />
                    </div>
                    <h3 className="text-[18px] font-bold text-white mb-2">Build Your AI Brain</h3>
                    <p className="text-[14px] text-slate-400 leading-relaxed max-w-sm mx-auto">
                      You have safely stored {totalPrompts} prompts in Prompax. As you add more, this dashboard will unlock deeper insights about your AI workflow.
                    </p>
                  </div>

               </div>
             </div>
             
          /* VIEW: EMPTY STATE (Prompts) */
          ) : displayPrompts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-5 shadow-inner">
                {activeView === 'trash' ? (
                  <Trash2 className="w-6 h-6 text-slate-400" />
                ) : searchResults !== null ? (
                  <Search className="w-6 h-6 text-slate-400" />
                ) : (
                  <Folder className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <p className="text-white text-[16px] font-medium">
                {activeView === 'trash' ? 'Trash is empty' : searchResults !== null ? 'No matching prompts found' : 'No prompts found'}
              </p>
            </div>
            
          /* VIEW: PROMPT CARDS GRID */
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative z-10 pb-10">
              {displayPrompts.map(prompt => (
                <div 
                  key={prompt.id} 
                  onClick={() => activeView !== 'trash' && openWorkspace(prompt)} 
                  className={`group cursor-pointer flex flex-col backdrop-blur-sm border rounded-2xl p-6 transition-all duration-300 h-[280px] shadow-lg relative ${activeView === 'trash' ? 'bg-red-950/10 border-red-500/10 cursor-default' : 'bg-[#0A0A0F]/80 border-white/5 hover:border-violet-500/40 hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.15)]'}`}
                >
                  
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className={`text-[15px] font-semibold leading-snug line-clamp-2 flex-1 transition-colors ${activeView === 'trash' ? 'text-slate-400 line-through decoration-red-500/50' : 'text-slate-100 group-hover:text-violet-100'}`}>
                      {prompt.title}
                    </h3>
                    
                    {activeView === 'trash' ? (
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => handleRestoreFromTrash(prompt.id, e)} 
                          title="Restore" 
                          className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => handlePermanentDelete(prompt.id, e)} 
                          title="Delete Permanently" 
                          className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => toggleFavorite(prompt, e)} 
                          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all outline-none"
                        >
                          <Star className={`h-4 w-4 ${prompt.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-500 hover:text-amber-400 opacity-0 group-hover:opacity-100'}`} />
                        </button>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button 
                              onClick={(e) => e.stopPropagation()} 
                              className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all outline-none"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          
                          <DropdownMenuContent align="end" className="w-48 bg-[#1A1A28] border-white/10 text-slate-200 rounded-xl shadow-2xl p-1">
                            <DropdownMenuItem 
                              onClick={(e) => handleOptimizePrompt(prompt, e as any)} 
                              className="gap-2.5 cursor-pointer hover:bg-violet-500/10 focus:bg-violet-500/10 text-violet-300 py-2.5 font-medium"
                            >
                              <Wand2 className="h-4 w-4" /> AI Optimize 
                              <span className="ml-auto text-[9px] bg-violet-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">PRO</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/5 my-1" />
                            <DropdownMenuItem 
                              onClick={(e) => handleMoveToTrash(prompt.id, e as any)} 
                              className="gap-2.5 cursor-pointer text-red-400 focus:text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 py-2.5"
                            >
                              <Trash2 className="h-4 w-4" /> Move to Trash
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                  
                  {/* Card Body */}
                  <div className="relative flex-1 overflow-hidden mb-4">
                    <p className={`text-[13px] leading-relaxed whitespace-pre-wrap ${activeView === 'trash' ? 'text-slate-600' : 'text-slate-400'}`}>
                      {prompt.content}
                    </p>
                    <div className={`absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t pointer-events-none transition-colors duration-300 ${activeView === 'trash' ? 'from-[#0A0A0F]/80 to-transparent' : 'from-[#0A0A0F] to-transparent group-hover:from-[#0d0d16]'}`} />
                  </div>
                  
                  {/* Card Footer */}
                  <div className="flex items-center gap-2 mt-auto pt-4 border-t border-white/5">
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-md border ${activeView === 'trash' ? 'bg-white/5 text-slate-500 border-transparent' : getPlatformStyle(prompt.platform)}`}>
                      {getPlatformLabel(prompt.platform)}
                    </span>
                    <span className={`text-[11px] bg-white/5 border border-white/5 px-2.5 py-1 rounded-md ${activeView === 'trash' ? 'text-slate-600' : 'text-slate-400'}`}>
                      {prompt.category}
                    </span>
                    {activeView !== 'trash' && (
                      <button 
                        onClick={(e) => copyToClipboard(prompt.content, prompt.id, e)} 
                        className="ml-auto flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-violet-500/20 hover:text-violet-300 text-slate-400 transition-all border border-transparent hover:border-violet-500/30"
                      >
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

      {/* ========================================== */}
      {/* MODALS ALANI                                 */}
      {/* ========================================== */}

      {/* ÇIKTI GÖRÜNTÜLEME MODALI (Split View) */}
      <Dialog open={!!viewingOutput} onOpenChange={(open) => { if(!open) setViewingOutput(null) }}>
        <DialogContent className="bg-[#0A0A0F] border-white/10 rounded-2xl sm:max-w-[85vw] lg:max-w-[1200px] w-[95vw] h-[85vh] shadow-2xl p-0 gap-0 overflow-hidden text-white flex flex-col [&>button]:hidden">
          
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#111118] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center border border-pink-500/20">
                {viewingOutput ? getFormatIcon(viewingOutput.format) : <Library className="w-5 h-5" />}
              </div>
              <div>
                <DialogTitle className="text-[16px] font-bold text-white capitalize">
                  {viewingOutput?.format.replace('_', ' ')} Output
                </DialogTitle>
                <p className="text-[12px] text-slate-400">
                  {viewingOutput && getPlatformLabel(viewingOutput.platform)} • Saved {viewingOutput && new Date(viewingOutput.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => viewingOutput && handleDeleteOutput(viewingOutput.id)} 
                className="text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500 p-2.5 rounded-xl transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewingOutput(null)} 
                className="text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 p-2.5 rounded-xl transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#060609]">
            {/* Split View: Sol Taraf (Prompt) */}
            <div className="w-full lg:w-[35%] bg-[#0A0A0F]/50 border-b lg:border-b-0 lg:border-r border-white/5 p-8 overflow-y-auto space-y-8">
              {viewingOutput?.prompt_id && prompts.find(p => p.id === viewingOutput.prompt_id) ? (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Parent Prompt
                  </h4>
                  <div 
                    className="bg-black/30 border border-white/5 rounded-xl p-5 cursor-pointer hover:border-violet-500/30 transition-colors" 
                    onClick={() => openWorkspace(prompts.find(p => p.id === viewingOutput.prompt_id)!)}
                  >
                    <h5 className="text-[14px] font-medium text-slate-200 mb-2">
                      {prompts.find(p => p.id === viewingOutput.prompt_id)?.title}
                    </h5>
                    <p className="text-[13px] text-slate-500 line-clamp-4">
                      {prompts.find(p => p.id === viewingOutput.prompt_id)?.content}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 border border-white/5 border-dashed rounded-xl p-6 text-center text-[13px] text-slate-500">
                  No prompt linked to this output.
                </div>
              )}
              
              {viewingOutput?.notes && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Notes / Context</h4>
                  <p className="text-[14px] text-slate-300 leading-relaxed p-4 bg-white/5 rounded-xl border border-white/5">
                    {viewingOutput.notes}
                  </p>
                </div>
              )}
            </div>
            
            {/* Split View: Sağ Taraf (Output) */}
            <div className="flex-1 flex flex-col relative h-full">
              <div className="flex-1 p-10 overflow-y-auto">
                <div className="max-w-3xl mx-auto">
                  <p className="text-[15px] text-slate-200 leading-loose whitespace-pre-wrap font-serif">
                    {viewingOutput?.content}
                  </p>
                </div>
              </div>
              <div className="p-6 border-t border-white/5 bg-[#0A0A0F] shrink-0 flex justify-end">
                <button 
                  onClick={(e) => viewingOutput && copyToClipboard(viewingOutput.content, viewingOutput.id, e)} 
                  className="px-8 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-medium flex items-center gap-2 shadow-[0_0_20px_-5px_rgba(236,72,153,0.5)] transition-all"
                >
                  {copiedId === viewingOutput?.id ? <><CheckCircle2 className="w-5 h-5" /> Copied</> : <><Copy className="w-5 h-5" /> Copy Asset</>}
                </button>
              </div>
            </div>
          </div>
          
        </DialogContent>
      </Dialog>

      {/* GENİŞ "SAVE OUTPUT" MODALI (MAGIC PASTE İLE BİRLİKTE) */}
      <Dialog open={showAddOutput} onOpenChange={(open) => { if (!submitting) { setShowAddOutput(open); setError(''); }}}>
        <DialogContent className="bg-[#0A0A0F] border-white/10 rounded-2xl sm:max-w-[95vw] w-[95vw] h-[95vh] shadow-2xl p-0 gap-0 overflow-hidden text-white flex flex-col [&>button]:hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-gradient-to-r from-[#0A0A0F] to-[#111118] shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
                <Library className="w-6 h-6 text-pink-400" />
              </div>
              <div>
                <DialogTitle className="text-[19px] font-semibold text-white tracking-tight">Save to Swipe File</DialogTitle>
                <p className="text-[13px] text-slate-400 mt-0.5">Archive your successful AI generations</p>
              </div>
            </div>
            <button 
              onClick={() => setShowAddOutput(false)} 
              className="text-slate-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2.5 rounded-xl flex items-center gap-2 text-[13px] font-medium"
            >
              <XCircle className="w-5 h-5" /> Close
            </button>
          </div>

          <div className="flex-1 overflow-hidden bg-[#060609] grid grid-cols-1 lg:grid-cols-3">
            
            {/* Sol Taraf: Ayarlar ve Magic Paste */}
            <div className="p-8 space-y-6 bg-[#0A0A0F]/50 overflow-y-auto h-full border-r border-white/5">
              {error && <div className="text-red-400 bg-red-500/10 p-3.5 rounded-xl text-[13px] border border-red-500/20">{error}</div>}
              
              {/* MAGIC PASTE */}
              <div className="bg-gradient-to-b from-pink-500/10 to-violet-500/5 border border-pink-500/20 rounded-2xl p-1 shadow-lg shadow-pink-500/5">
                <div className="bg-[#060609]/80 backdrop-blur rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-[14px] font-bold text-white mb-1 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-pink-400 fill-pink-400" /> Smart Magic Paste
                      </h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed max-w-[200px]">
                        Copy the <span className="text-white">entire ChatGPT conversation</span>. We will automatically extract your prompt, save it, and link it to the output.
                      </p>
                    </div>
                  </div>
                  <Textarea 
                    value={outputForm.magicPasteContent} 
                    onChange={e => setOutputForm(f => ({ ...f, magicPasteContent: e.target.value }))} 
                    placeholder="Paste raw chat transcript here..." 
                    className="w-full bg-black/40 border-white/10 rounded-xl p-3 text-[13px] text-slate-300 h-24 resize-none focus-visible:ring-1 focus-visible:ring-pink-500/50" 
                  />
                  <button 
                    onClick={handleMagicPaste} 
                    disabled={isMagicPasting || !outputForm.magicPasteContent.trim()} 
                    className="w-full py-2.5 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white rounded-lg text-[13px] font-medium transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_-3px_rgba(236,72,153,0.4)]"
                  >
                    {isMagicPasting ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing Transcript...</> : 'Auto-Extract & Fill'}
                  </button>
                </div>
              </div>

              {/* Format & Platform Seçimi */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Format</label>
                  <Select value={outputForm.format} onValueChange={(v) => setOutputForm(f => ({ ...f, format: v, customFormat: '' }))}>
                    <SelectTrigger className="w-full bg-[#060609] border-white/10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200">
                      <MenuItems items={FORMATS.map(f => ({value: f, label: f.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}))} />
                    </SelectContent>
                  </Select>
                  {outputForm.format === 'other' && (
                    <Input 
                      onKeyDown={handleKeyDownOutput} 
                      value={outputForm.customFormat} 
                      onChange={e => setOutputForm(f => ({ ...f, customFormat: e.target.value }))} 
                      placeholder="e.g. YouTube Hook" 
                      className="w-full mt-3 bg-[#060609] border-white/10 rounded-xl" 
                    />
                  )}
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Platform</label>
                  <Select value={outputForm.platform} onValueChange={(v) => setOutputForm(f => ({ ...f, platform: v, customPlatform: '' }))}>
                    <SelectTrigger className="w-full bg-[#060609] border-white/10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200">
                      <MenuItems items={PLATFORMS} />
                    </SelectContent>
                  </Select>
                  {outputForm.platform === 'other' && (
                    <Input 
                      onKeyDown={handleKeyDownOutput} 
                      value={outputForm.customPlatform} 
                      onChange={e => setOutputForm(f => ({ ...f, customPlatform: e.target.value }))} 
                      placeholder="e.g. Midjourney" 
                      className="w-full mt-3 bg-[#060609] border-white/10 rounded-xl" 
                    />
                  )}
                </div>
              </div>

              {/* Prompt Bağlama */}
              <div>
                <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Linked Prompt (Optional)</label>
                <Select value={outputForm.prompt_id} onValueChange={(v) => setOutputForm(f => ({ ...f, prompt_id: v }))}>
                  <SelectTrigger className="w-full bg-[#060609] border-white/10 rounded-xl"><SelectValue placeholder="Link to a saved prompt" /></SelectTrigger>
                  <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200">
                    <SelectItem value="none" className="text-slate-500">None</SelectItem>
                    {activePrompts.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                {outputForm.prompt_id !== 'none' && (
                  <p className="text-[11px] text-green-400 mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Linked to an existing prompt
                  </p>
                )}
              </div>
              
              {/* Notlar */}
              <div>
                <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Notes / Context (Optional)</label>
                <Input 
                  onKeyDown={handleKeyDownOutput} 
                  value={outputForm.notes} 
                  onChange={e => setOutputForm(f => ({ ...f, notes: e.target.value }))} 
                  placeholder="e.g., Used for Q3 marketing campaign... (Press Enter to save)" 
                  className="w-full bg-[#060609] border-white/10 rounded-xl" 
                />
              </div>
            </div>

            {/* Sağ Taraf: Çıktı İçeriği Metin Alanı */}
            <div className="lg:col-span-2 flex flex-col h-full bg-[#060609]">
              <div className="p-6 pb-2">
                <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider block">Generated Output Content</label>
              </div>
              <div className="flex-1 px-6 pb-6 flex flex-col">
                <Textarea 
                  onKeyDown={(e) => handleKeyDownTextarea(e, handleAddOutput)} 
                  value={outputForm.content} 
                  onChange={e => setOutputForm(f => ({ ...f, content: e.target.value }))} 
                  placeholder="The isolated output will appear here... (Press Ctrl+Enter to save)" 
                  className="flex-1 w-full bg-[#0A0A0F] border border-white/5 rounded-2xl p-8 text-[15px] text-slate-200 leading-loose focus-visible:ring-1 focus-visible:ring-pink-500/50 resize-none shadow-inner overflow-y-auto font-serif" 
                />
              </div>
              
              {/* Alt Bar: Kaydet Butonu */}
              <div className="p-6 border-t border-white/5 bg-[#0A0A0F] flex gap-4 shrink-0">
                <button 
                  disabled={submitting} 
                  onClick={() => setShowAddOutput(false)} 
                  className="px-6 py-4 rounded-xl border border-white/10 text-[14px] font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  disabled={submitting} 
                  onClick={handleAddOutput} 
                  className="flex-1 py-4 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-[14px] font-medium text-white flex items-center justify-center gap-2 shadow-[0_0_15px_-3px_rgba(236,72,153,0.5)] transition-all"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Save to Swipe File</>}
                </button>
              </div>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* FULL WORKSPACE MODAL (PROMPT EKLEME/DÜZENLEME) */}
      <Dialog open={showAddPrompt} onOpenChange={(open) => { if (!submitting) { setShowAddPrompt(open); if(!open){ setEditingPrompt(null); setForm(emptyForm); setError(''); } } }}>
        <DialogContent className="bg-[#0A0A0F] border-white/10 rounded-2xl sm:max-w-[95vw] w-[95vw] h-[95vh] shadow-2xl p-0 gap-0 overflow-hidden text-white flex flex-col [&>button]:hidden">
          
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-gradient-to-r from-[#0A0A0F] to-[#111118] shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <LayoutGrid className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <DialogTitle className="text-[19px] font-semibold text-white tracking-tight">
                  {editingPrompt ? 'Prompt Workspace' : 'Create New Prompt'}
                </DialogTitle>
                <p className="text-[13px] text-slate-400 mt-0.5">
                  {editingPrompt ? `Managing: ${editingPrompt.title}` : 'Build your custom prompt template'}
                </p>
              </div>
            </div>
            
            {editingPrompt && (
              <div className="flex items-center bg-[#060609] p-1 rounded-xl border border-white/5">
                <button 
                  onClick={() => setActiveTab('editor')} 
                  className={`px-5 py-2.5 rounded-lg text-[13px] font-medium flex items-center gap-2 transition-all ${activeTab === 'editor' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                >
                  <Edit2 className="w-4 h-4" /> Prompt Editor
                </button>
                <button 
                  onClick={() => setActiveTab('history')} 
                  className={`px-5 py-2.5 rounded-lg text-[13px] font-medium flex items-center gap-2 transition-all ${activeTab === 'history' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                >
                  <History className="w-4 h-4" /> Version History
                  <span className="text-[11px] bg-white/10 px-1.5 py-0.5 rounded-md text-slate-300">
                    {promptVersions.length}
                  </span>
                </button>
              </div>
            )}
            
            <button 
              onClick={() => setShowAddPrompt(false)} 
              className="text-slate-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2.5 rounded-xl flex items-center gap-2 text-[13px] font-medium"
            >
              <XCircle className="w-5 h-5" /> Close
            </button>
          </div>

          <div className="flex-1 overflow-hidden bg-[#060609]">
            {activeTab === 'editor' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 h-full overflow-hidden">
                
                {/* Sol Taraf: Prompt Ayarları */}
                <div className="p-8 space-y-6 bg-[#0A0A0F]/50 overflow-y-auto h-full border-r border-white/5">
                  {error && (
                    <div className="flex items-center gap-2 text-[13px] text-red-400 bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" /><p>{error}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Title</label>
                    <Input 
                      onKeyDown={handleKeyDownPrompt} 
                      value={form.title} 
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))} 
                      className="w-full bg-[#060609] border-white/10 rounded-xl px-4 py-6 text-[14px] text-white" 
                    />
                  </div>
                  
                  <div>
                    <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Target Platform</label>
                    <Select value={form.platform} onValueChange={(v) => setForm(f => ({ ...f, platform: v, customPlatform: '' }))}>
                      <SelectTrigger className="w-full bg-[#060609] border-white/10 rounded-xl px-4 py-6 text-[13px] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200">
                        <MenuItems items={PLATFORMS} />
                      </SelectContent>
                    </Select>
                    {form.platform === 'other' && (
                      <Input 
                        onKeyDown={handleKeyDownPrompt} 
                        value={form.customPlatform} 
                        onChange={e => setForm(f => ({ ...f, customPlatform: e.target.value }))} 
                        placeholder="e.g. Midjourney" 
                        className="w-full mt-3 bg-[#060609] border-white/10 rounded-xl px-4 py-5 text-[13px] text-white" 
                      />
                    )}
                  </div>
                  
                  <div>
                    <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Category</label>
                    <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v, customCategory: '' }))}>
                      <SelectTrigger className="w-full bg-[#060609] border-white/10 rounded-xl px-4 py-6 text-[13px] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200">
                        <MenuItems items={CATEGORIES.map(c => ({value: c, label: c}))} />
                      </SelectContent>
                    </Select>
                    {form.category === 'Other' && (
                      <Input 
                        onKeyDown={handleKeyDownPrompt} 
                        value={form.customCategory} 
                        onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))} 
                        placeholder="Enter custom category..." 
                        className="w-full mt-3 bg-[#060609] border-white/10 rounded-xl px-4 py-5 text-[13px] text-white" 
                      />
                    )}
                  </div>
                  
                  {collections.length > 0 && (
                    <div>
                      <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Collection</label>
                      <Select value={form.collection_id || "none"} onValueChange={(v) => setForm(f => ({ ...f, collection_id: v === "none" ? "" : v }))}>
                        <SelectTrigger className="w-full bg-[#060609] border-white/10 rounded-xl px-4 py-6 text-[13px] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200">
                          <SelectItem value="none" className="text-slate-500">None</SelectItem>
                          {collections.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                
                {/* Sağ Taraf: Prompt İçeriği Alanı */}
                <div className="lg:col-span-2 flex flex-col h-full bg-[#060609]">
                  <div className="p-6 pb-2">
                    <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider block">Prompt Template Content</label>
                  </div>
                  <div className="flex-1 px-6 pb-6 flex flex-col">
                    <Textarea 
                      onKeyDown={(e) => handleKeyDownTextarea(e, editingPrompt ? handleEditPrompt : handleAddPrompt)} 
                      value={form.content} 
                      onChange={e => setForm(f => ({ ...f, content: e.target.value }))} 
                      placeholder="Type your prompt... (Press Ctrl+Enter to save)" 
                      className="flex-1 w-full bg-[#0A0A0F] border border-white/5 rounded-2xl p-8 text-[15px] text-slate-200 leading-loose focus-visible:ring-1 focus-visible:ring-violet-500/50 resize-none shadow-inner overflow-y-auto" 
                    />
                  </div>
                  <div className="p-6 border-t border-white/5 bg-[#0A0A0F] flex gap-4 shrink-0">
                    <button 
                      disabled={submitting} 
                      onClick={() => setShowAddPrompt(false)} 
                      className="px-6 py-4 rounded-xl border border-white/10 text-[14px] font-medium text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button 
                      disabled={submitting} 
                      onClick={editingPrompt ? handleEditPrompt : handleAddPrompt} 
                      className="flex-1 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-[14px] font-medium text-white flex items-center justify-center gap-2"
                    >
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> {editingPrompt ? 'Save Modifications' : 'Create Prompt'}</>}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              
              /* Version History Alanı */
              <div className="h-full overflow-hidden p-10">
                {loadingVersions ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
                  </div>
                ) : promptVersions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center">
                    <History className="w-12 h-12 text-slate-600 mb-4" />
                    <p className="text-white">No version logs</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 h-full overflow-y-auto pb-12">
                    {promptVersions.map(v => (
                      <div key={v.id} className="flex flex-col bg-[#0A0A0F] border border-white/5 rounded-2xl p-6 h-[320px]">
                        <div className="flex justify-between mb-3 border-b border-white/5 pb-3">
                          <div><span className="text-[12px] text-violet-400">V{v.version_num}</span></div>
                          <button onClick={() => handleRestoreVersion(v.content)} className="text-[12px] text-violet-400">
                            <RotateCcw className="w-3.5 h-3.5" /> Restore
                          </button>
                        </div>
                        <div className="flex-1 overflow-hidden relative">
                          <p className="text-[13px] text-slate-400 font-mono">{v.content}</p>
                          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0A0A0F] to-transparent" />
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

      {/* AI OPTIMIZE MODAL */}
      <Dialog open={showOptimizeModal} onOpenChange={(open) => { if (!isOptimizing) setShowOptimizeModal(open) }}>
        <DialogContent className="bg-[#0A0A0F] border-white/10 rounded-2xl sm:max-w-[95vw] w-[95vw] h-[95vh] shadow-2xl p-0 gap-0 overflow-hidden text-white flex flex-col [&>button]:hidden">
          
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-gradient-to-r from-[#0A0A0F] to-[#111118] shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Wand2 className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <DialogTitle className="text-[19px] font-semibold text-white tracking-tight">AI Prompt Optimization</DialogTitle>
                <p className="text-[13px] text-violet-400/70 font-medium mt-0.5">Pro Feature Preview</p>
              </div>
            </div>
            {!isOptimizing && (
              <button 
                onClick={() => setShowOptimizeModal(false)} 
                className="text-slate-500 hover:text-white p-2.5 bg-white/5 rounded-xl"
              >
                <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-hidden bg-[#060609] relative">
            {isOptimizing && !optimizeResult ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Loader2 className="w-14 h-14 text-violet-500 animate-spin" />
              </div>
            ) : optimizeResult ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 h-full overflow-hidden divide-x divide-white/5">
                <div className="p-10 overflow-y-auto h-full">
                  <h4 className="text-[12px] font-bold text-slate-500 uppercase mb-4">Original</h4>
                  <div className="bg-black/40 border border-white/5 rounded-xl p-6 text-[14px] text-slate-400 mb-8">
                    {optimizingPrompt?.content}
                  </div>
                  
                  <div className="bg-green-500/5 rounded-2xl p-6 mb-8">
                    <h4 className="text-green-500/90 mb-4 font-bold uppercase">Strengths</h4>
                    <ul className="space-y-3">
                      {optimizeResult.strengths.map(s => <li key={s} className="text-slate-300 text-[14px]">{s}</li>)}
                    </ul>
                  </div>
                  
                  <div className="bg-red-500/5 rounded-2xl p-6">
                    <h4 className="text-red-400/90 mb-4 font-bold uppercase">Weaknesses</h4>
                    <ul className="space-y-3">
                      {optimizeResult.weaknesses.map(w => <li key={w} className="text-slate-300 text-[14px]">{w}</li>)}
                    </ul>
                  </div>
                </div>
                
                <div className="flex flex-col h-full">
                  <div className="p-8 pb-4">
                    <h4 className="text-[12px] font-bold text-violet-400 uppercase">Optimized Version</h4>
                  </div>
                  <div className="flex-1 p-8 pt-0">
                    <Textarea 
                      value={optimizeResult.improved_prompt} 
                      onChange={e => setOptimizeResult(p => p ? {...p, improved_prompt: e.target.value} : null)} 
                      className="h-full bg-violet-500/5 border-violet-500/20 text-[15px]" 
                    />
                  </div>
                  <div className="p-8 pt-4 border-t border-white/5">
                    <button onClick={acceptOptimization} className="w-full py-4 bg-violet-600 rounded-xl">Replace</button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Collection Modal */}
      <Dialog open={showAddCollection} onOpenChange={(open) => { setShowAddCollection(open); setError(''); }}>
        <DialogContent className="bg-[#111118] border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-0 gap-0 text-white [&>button]:hidden">
          
          <div className="flex items-center justify-between p-6 border-b border-white/5">
            <DialogTitle>{editingCollection ? 'Edit Collection' : 'New Collection'}</DialogTitle>
            <button onClick={() => setShowAddCollection(false)} className="text-slate-500"><XCircle className="w-4 h-4" /></button>
          </div>
          
          <div className="p-6 space-y-5">
            {error && <div className="text-red-400 text-[13px]">{error}</div>}
            <div>
              <label className="text-[12px] text-slate-400 block mb-2">Name</label>
              <Input 
                onKeyDown={handleKeyDownCollection} 
                value={collectionForm.name} 
                onChange={e => setCollectionForm(f => ({...f, name: e.target.value}))} 
                className="bg-[#060609] border-white/10" 
                placeholder="(Press Enter to save)" 
              />
            </div>
            <div>
              <label className="text-[12px] text-slate-400 block mb-2">Description</label>
              <Input 
                onKeyDown={handleKeyDownCollection} 
                value={collectionForm.description} 
                onChange={e => setCollectionForm(f => ({...f, description: e.target.value}))} 
                className="bg-[#060609] border-white/10" 
                placeholder="(Press Enter to save)" 
              />
            </div>
          </div>
          
          <div className="flex gap-3 p-6 border-t border-white/5">
            <button 
              onClick={() => setShowAddCollection(false)} 
              className="flex-1 py-3 border border-white/10 rounded-xl"
            >
              Cancel
            </button>
            <button 
              onClick={handleSaveCollection} 
              className="flex-1 py-3 bg-violet-600 rounded-xl"
            >
              {editingCollection ? 'Save' : 'Create'}
            </button>
          </div>
          
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MenuItems({ items }: { items: {value: string, label: string}[] }) {
  return <>{items.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</>
}