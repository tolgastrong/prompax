'use client'

import React, { useEffect, useState, useMemo, DragEvent } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { 
  Copy, Plus, MoreVertical, Edit2, Trash2, Folder, LayoutGrid, AlertCircle, 
  Check, Search, Sparkles, Loader2, Wand2, XCircle, CheckCircle2, History, 
  RotateCcw, Star, Clock, Settings, BookOpen, MessageSquare, Share2, Zap,
  BarChart2, ChevronLeft, ChevronRight, Activity, RefreshCw, PieChart, ShieldAlert,
  ChevronDown, Library, Mail, MessageCircle, Code2, FileText, Lightbulb,
  Workflow, Play, ExternalLink, ArrowRight, GripVertical, CheckCircle, 
  ArrowDown, Save, FastForward, Pin, Layers
} from 'lucide-react'

// ============================================================================
// 1. SHADCN UI BİLEŞENLERİ (UI COMPONENTS)
// ============================================================================
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// ============================================================================
// 2. TİP TANIMLAMALARI (TYPES & INTERFACES)
// ============================================================================
type Prompt = {
  id: string
  title: string
  content: string
  platforms: string[]
  category: string
  use_count: number
  created_at: string
  collection_id: string | null
  similarity?: number
  is_favorite: boolean
  is_pinned: boolean
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
  is_pinned: boolean
  deleted_at: string | null
}

type OptimizeResult = { 
  strengths: string[]
  weaknesses: string[]
  improved_prompt: string 
}

type PromptVersion = { 
  id: string
  prompt_id: string
  content: string
  version_num: number
  created_at: string 
}

// WORKFLOW ENGINE TİPLERİ
type StepIteration = {
  id: string
  version_num: number
  prompt_text: string
  output_text: string
  platform: string
}

type WorkflowStep = {
  id: string
  number: number
  title: string
  goal: string
  platforms: string[]
  prompt_source: 'manual' | 'all_prompts' | 'ai_optimize' | 'favorite'
  linked_prompt_id?: string
  base_prompt: string
  iterations: StepIteration[]
  selected_iteration_id: string | null
}

type AppWorkflow = {
  id: string
  title: string
  description: string
  steps: WorkflowStep[]
  created_at: string
}

// ============================================================================
// 3. SABİT VERİLER & YARDIMCI FONKSİYONLAR
// ============================================================================
const PLATFORMS = [
  { value: 'chatgpt', label: 'ChatGPT', bg: 'bg-[#10a37f]/15 text-[#10a37f] border-[#10a37f]/20', url: 'https://chat.openai.com' },
  { value: 'claude', label: 'Claude', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/20', url: 'https://claude.ai' },
  { value: 'gemini', label: 'Gemini', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/20', url: 'https://gemini.google.com' },
  { value: 'deepseek', label: 'DeepSeek', bg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20', url: 'https://chat.deepseek.com' },
  { value: 'other', label: 'Other', bg: 'bg-violet-500/15 text-violet-400 border-violet-500/20', url: '#' },
]

const CATEGORIES = [
  'General', 
  'Writing', 
  'Coding', 
  'Marketing', 
  'Research', 
  'Design', 
  'Other'
]

const FORMATS = [
  'email', 
  'tweet', 
  'social_post', 
  'article', 
  'ad_copy', 
  'code', 
  'other'
]

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

function getPlatformUrl(value: string) {
  const found = PLATFORMS.find(p => p.value.toLowerCase() === value.toLowerCase())
  return found ? found.url : '#'
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
    case 'email': 
      return <Mail className="w-3.5 h-3.5" />
    case 'tweet': 
    case 'social_post': 
      return <MessageCircle className="w-3.5 h-3.5" />
    case 'code': 
      return <Code2 className="w-3.5 h-3.5" />
    case 'article': 
      return <FileText className="w-3.5 h-3.5" />
    default: 
      return <Lightbulb className="w-3.5 h-3.5" />
  }
}

const emptyForm = { 
  title: '', 
  content: '', 
  platforms: ['chatgpt'], 
  category: 'General', 
  collection_id: '', 
  customPlatforms: '', 
  customCategory: '' 
}

const emptyOutputForm = { 
  content: '', 
  format: 'email', 
  platform: 'chatgpt', 
  prompt_id: 'none', 
  notes: '', 
  customFormat: '', 
  customPlatform: '', 
  magicPasteContent: '' 
}

// ============================================================================
// 4. MOCK WORKFLOW VERİSİ
// ============================================================================
const initialWorkflowsData: AppWorkflow[] = [
  {
    id: 'wf-1',
    title: 'YouTube Viral Workflow',
    description: 'Standardized process for creating high-converting YouTube videos with multi-step generation.',
    created_at: new Date().toISOString(),
    steps: [
      {
        id: 'step-1',
        number: 1,
        title: 'Research Phase',
        goal: 'Research the topic deeply and find unique angles.',
        platforms: ['claude'],
        prompt_source: 'manual',
        base_prompt: 'Act as an expert YouTube strategist. Research the following topic: [Topic] and provide 5 unique angles that haven\'t been overdone in the niche.',
        iterations: [],
        selected_iteration_id: null
      },
      {
        id: 'step-2',
        number: 2,
        title: 'Hook Generation',
        goal: 'Create high-retention opening hooks based on research.',
        platforms: ['chatgpt'],
        prompt_source: 'manual',
        base_prompt: 'Using the following research:\n\n{{STEP_1_OUTPUT}}\n\nGenerate 10 high-retention YouTube hooks using the "Curiosity Gap" framework.',
        iterations: [],
        selected_iteration_id: null
      }
    ]
  }
];

// ============================================================================
// 5. ANA BİLEŞEN (MAIN DASHBOARD)
// ============================================================================
export default function Dashboard() {
  const router = useRouter()
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  ))

  const [user, setUser] = useState<{ id?: string, email?: string; user_metadata?: { full_name?: string; avatar_url?: string } } | null>(null)
  
  // -----------------------------------------------------
  // VERİ STATELERİ
  // -----------------------------------------------------
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [outputs, setOutputs] = useState<Output[]>([])
  const [workflows, setWorkflows] = useState<AppWorkflow[]>(initialWorkflowsData)
  
  const [loading, setLoading] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // -----------------------------------------------------
  // SIDEBAR AÇILIR/KAPANIR DURUMLARI
  // -----------------------------------------------------
  const [expandedSections, setExpandedSections] = useState({
    workspace: true, 
    workflows: true, 
    insights: true, 
    collections: true, 
    platforms: true, 
    resources: true
  })

  // -----------------------------------------------------
  // MODAL DURUMLARI
  // -----------------------------------------------------
  const [showAddPrompt, setShowAddPrompt] = useState(false)
  const [showAddCollection, setShowAddCollection] = useState(false)
  const [showAddOutput, setShowAddOutput] = useState(false)
  const [viewingOutput, setViewingOutput] = useState<Output | null>(null)
  
  const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false)
  const [workflowForm, setWorkflowForm] = useState<AppWorkflow>(initialWorkflowsData[0])

  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null)
  
  const [activeView, setActiveView] = useState<'all' | 'favorites' | 'recent' | 'trash' | 'analytics' | 'outputs' | 'platform' | 'collection' | 'workflows' | 'workflow-execution'>('all')
  const [activeCollection, setActiveCollection] = useState<string | null>(null)
  const [activePlatform, setActivePlatform] = useState<string | null>(null)
  
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Prompt[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  const [isPromptDropdownOpen, setIsPromptDropdownOpen] = useState(false)
  const [promptSearchQuery, setPromptSearchQuery] = useState('')

  // -----------------------------------------------------
  // AI OPTİMİZASYON STATELERİ
  // -----------------------------------------------------
  const [showOptimizeModal, setShowOptimizeModal] = useState(false)
  const [optimizingPrompt, setOptimizingPrompt] = useState<Prompt | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null)

  // -----------------------------------------------------
  // PROMPT MODAL SEKMELERİ (TABS)
  // -----------------------------------------------------
  const [activeTab, setActiveTab] = useState<'editor' | 'history' | 'outputs'>('editor')
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)

  // -----------------------------------------------------
  // FORM STATELERİ
  // -----------------------------------------------------
  const [form, setForm] = useState(emptyForm)
  const [outputForm, setOutputForm] = useState(emptyOutputForm)
  const [collectionForm, setCollectionForm] = useState({ name: '', description: '' })
  
  const [submitting, setSubmitting] = useState(false)
  const [isMagicPasting, setIsMagicPasting] = useState(false)
  const [error, setError] = useState('')

  // -----------------------------------------------------
  // DRAG & DROP STATELERİ
  // -----------------------------------------------------
  const [draggedPromptIdx, setDraggedPromptIdx] = useState<number | null>(null)
  const [draggedOutputIdx, setDraggedOutputIdx] = useState<number | null>(null)
  
  // -----------------------------------------------------
  // WORKFLOW EXECUTION ENGINE STATELERİ
  // -----------------------------------------------------
  const [activeWorkflow, setActiveWorkflow] = useState<AppWorkflow | null>(null)
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [currentStepOutput, setCurrentStepOutput] = useState('')
  const [workflowStatus, setWorkflowStatus] = useState<'idle' | 'running' | 'completed'>('idle')
  const [isSavingWorkflowOutputs, setIsSavingWorkflowOutputs] = useState(false)

  // ============================================================================
  // MEMOIZED VERİLER
  // ============================================================================
  const activePrompts = useMemo(() => {
    return prompts.filter(p => !p.deleted_at)
  }, [prompts])

  const trashedItems = useMemo(() => {
    const pTrash = prompts.filter(p => p.deleted_at).map(p => ({...p, type: 'prompt'}))
    const oTrash = outputs.filter(o => o.deleted_at).map(o => ({...o, type: 'output'}))
    return [...pTrash, ...oTrash].sort((a,b) => new Date(b.deleted_at!).getTime() - new Date(a.deleted_at!).getTime())
  }, [prompts, outputs])

  const activeOutputs = useMemo(() => {
    return outputs.filter(o => !o.deleted_at)
  }, [outputs])
  
  const filteredLinkPrompts = useMemo(() => {
    if (!promptSearchQuery) return activePrompts
    return activePrompts.filter(p => 
      p.title.toLowerCase().includes(promptSearchQuery.toLowerCase()) || 
      p.content.toLowerCase().includes(promptSearchQuery.toLowerCase())
    )
  }, [activePrompts, promptSearchQuery])

  // ============================================================================
  // LIFECYCLE (USE EFFECTS)
  // ============================================================================
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { 
          router.push('/login')
          return 
        }
        setUser(user)
      } catch (e) {
        console.warn("Supabase auth check failed. Continuing in local dev mode.")
        setUser({ id: 'dev-user', email: 'tolga@prompax.com', user_metadata: { full_name: 'Tolga' } })
      }
      await fetchAll()
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 2 && activeView !== 'outputs' && activeView !== 'workflows' && activeView !== 'workflow-execution') {
        setIsSearching(true)
        try {
          const lowerQuery = searchQuery.toLowerCase()
          const localMatches = activePrompts.filter(p => 
            p.title.toLowerCase().includes(lowerQuery) || 
            p.content.toLowerCase().includes(lowerQuery) || 
            p.category.toLowerCase().includes(lowerQuery)
          )
          setSearchResults(localMatches)
        } catch (error) { 
          console.error(error) 
        } finally { 
          setIsSearching(false) 
        }
      } else { 
        setSearchResults(null) 
      }
    }, 500)
    
    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery, activePrompts, activeView])

  const fetchAll = async () => {
    try {
      setPrompts([
        { 
          id: '1', 
          title: 'SEO Optimized Blog Post', 
          content: 'Write a comprehensive 1500-word blog post about [Topic]...', 
          platforms: ['chatgpt', 'claude'], 
          category: 'Writing', 
          use_count: 5, 
          created_at: new Date().toISOString(), 
          collection_id: null, 
          is_favorite: true, 
          is_pinned: true, 
          deleted_at: null 
        },
        { 
          id: '2', 
          title: 'React Performance Audit', 
          content: 'Review the following React code for performance bottlenecks...', 
          platforms: ['claude'], 
          category: 'Coding', 
          use_count: 12, 
          created_at: new Date().toISOString(), 
          collection_id: null, 
          is_favorite: false, 
          is_pinned: false, 
          deleted_at: null 
        }
      ])
      
      setCollections([
        { 
          id: 'c1', 
          name: 'SEO Templates', 
          description: 'Best SEO prompts', 
          is_public: false 
        }
      ])
      
      setOutputs([
        { 
          id: 'o1', 
          prompt_id: '1', 
          content: 'Here is your highly optimized blog post about React Native...', 
          format: 'article', 
          platform: 'chatgpt', 
          notes: 'Great result for medium.com', 
          metrics: {}, 
          created_at: new Date().toISOString(), 
          is_pinned: false, 
          deleted_at: null 
        }
      ])
    } catch (e) { 
      console.error("Fetch error, using fallbacks")
    }
  }

  const fetchVersions = async (promptId: string) => {
    setLoadingVersions(true)
    setTimeout(() => {
      setPromptVersions([
        { 
          id: `v1-${promptId}`, 
          prompt_id: promptId, 
          content: 'Initial draft version...', 
          version_num: 1, 
          created_at: new Date().toISOString() 
        }
      ])
      setLoadingVersions(false)
    }, 500)
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // ============================================================================
  // YARDIMCI FORM FONKSİYONLARI & KAYIT İŞLEMLERİ
  // ============================================================================
  const togglePlatformSelection = (platformValue: string) => {
    setForm(prev => {
      const isSelected = prev.platforms.includes(platformValue)
      if (isSelected) {
        if (prev.platforms.length === 1) return prev
        return { ...prev, platforms: prev.platforms.filter(p => p !== platformValue) }
      } else {
        return { ...prev, platforms: [...prev.platforms, platformValue] }
      }
    })
  }

  const getFinalCategory = () => {
    return form.category === 'Other' && form.customCategory.trim() 
      ? form.customCategory.trim() 
      : form.category
  }
  
  const getFinalOutputFormat = () => {
    return outputForm.format === 'other' && outputForm.customFormat.trim() 
      ? outputForm.customFormat.trim().toLowerCase().replace(/\s+/g, '_') 
      : outputForm.format
  }

  const handleAddPrompt = async () => {
    if (!form.title.trim() || !form.content.trim()) { 
      setError('Title and content are required.')
      return 
    }
    
    setSubmitting(true)
    setError('')
    
    const newPrompt: Prompt = {
      id: `mock-id-${Date.now()}`, 
      title: form.title.trim(), 
      content: form.content.trim(), 
      platforms: form.platforms,
      category: getFinalCategory(), 
      collection_id: form.collection_id || null, 
      use_count: 0,
      created_at: new Date().toISOString(), 
      is_favorite: false, 
      is_pinned: false, 
      deleted_at: null
    }
    
    setPrompts(prev => [newPrompt, ...prev])
    setForm(emptyForm)
    setShowAddPrompt(false)
    setSubmitting(false)
  }

  const handleEditPrompt = async () => {
    if (!editingPrompt) return
    
    setSubmitting(true)
    setError('')
    
    const updatedData = { 
      ...editingPrompt, 
      title: form.title.trim(), 
      content: form.content.trim(), 
      platforms: form.platforms, 
      category: getFinalCategory(), 
      collection_id: form.collection_id || null 
    }
    
    setPrompts(prev => prev.map(p => p.id === editingPrompt.id ? updatedData : p))
    
    if (searchResults) {
      setSearchResults(prev => prev ? prev.map(p => p.id === editingPrompt.id ? updatedData : p) : null)
    }
    
    setEditingPrompt(null)
    setShowAddPrompt(false)
    setForm(emptyForm)
    setSubmitting(false)
  }

  const handleAddOutput = async () => {
    if (!outputForm.content.trim()) { 
      setError('Output content is required.')
      return 
    }
    
    setSubmitting(true)
    setError('')
    
    const newOutput: Output = {
        id: `mock-out-${Date.now()}`, 
        prompt_id: outputForm.prompt_id === 'none' ? null : outputForm.prompt_id,
        content: outputForm.content, 
        format: getFinalOutputFormat(), 
        platform: outputForm.platform, 
        notes: outputForm.notes,
        metrics: {}, 
        created_at: new Date().toISOString(), 
        is_pinned: false, 
        deleted_at: null
    }
    
    setOutputs(prev => [newOutput, ...prev])
    setOutputForm(emptyOutputForm)
    setShowAddOutput(false)
    setPromptSearchQuery('')
    setSubmitting(false) 
  }

  const handleAddOutputInline = async (content: string, platform: string) => {
    if (!editingPrompt) return
    
    const newOutput: Output = {
        id: `mock-out-inline-${Date.now()}`, 
        prompt_id: editingPrompt.id,
        content: content, 
        format: 'other', 
        platform: platform, 
        notes: 'Saved from Prompt Workspace',
        metrics: {}, 
        created_at: new Date().toISOString(), 
        is_pinned: false, 
        deleted_at: null
    }
    
    setOutputs(prev => [newOutput, ...prev])
    alert("Output successfully saved and linked to this prompt!")
  }

  const handleMagicPaste = async () => {
    if (!outputForm.magicPasteContent.trim()) { 
      setError('Please paste your full chat log first.')
      return 
    }
    
    setIsMagicPasting(true)
    setError('')
    
    setTimeout(() => {
      setOutputForm(prev => ({ 
        ...prev, 
        content: "This is the auto-extracted clean output from the AI.", 
        notes: "Auto-extracted via Magic Paste", 
        magicPasteContent: '' 
      }))
      setIsMagicPasting(false)
    }, 1500)
  }

  // ============================================================================
  // DURUM YÖNETİMİ (PIN, FAVORITE, TRASH)
  // ============================================================================
  const toggleFavorite = (prompt: Prompt, e: React.MouseEvent) => {
    e.stopPropagation() 
    const newStatus = !prompt.is_favorite
    setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, is_favorite: newStatus } : p))
  }

  const togglePinPrompt = (prompt: Prompt, e: React.MouseEvent) => {
    e.stopPropagation() 
    const newStatus = !prompt.is_pinned
    setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, is_pinned: newStatus } : p))
  }
  
  const togglePinOutput = (output: Output, e: React.MouseEvent) => {
    e.stopPropagation() 
    const newStatus = !output.is_pinned
    setOutputs(prev => prev.map(o => o.id === output.id ? { ...o, is_pinned: newStatus } : o))
  }

  const handleMoveToTrash = (id: string, type: 'prompt'|'output', e?: React.MouseEvent) => {
    if(e) e.stopPropagation()
    const now = new Date().toISOString()
    
    if(type === 'prompt') {
      setPrompts(prev => prev.map(p => p.id === id ? { ...p, deleted_at: now, is_favorite: false, is_pinned: false } : p))
      if (searchResults) {
        setSearchResults(prev => prev ? prev.filter(p => p.id !== id) : null)
      }
    } else {
      setOutputs(prev => prev.map(o => o.id === id ? { ...o, deleted_at: now, is_pinned: false } : o))
    }
  }

  const handleRestoreFromTrash = (id: string, type: 'prompt'|'output', e: React.MouseEvent) => {
    e.stopPropagation()
    if(type === 'prompt') {
      setPrompts(prev => prev.map(p => p.id === id ? { ...p, deleted_at: null } : p))
    } else {
      setOutputs(prev => prev.map(o => o.id === id ? { ...o, deleted_at: null } : o))
    }
  }

  const handlePermanentDelete = (id: string, type: 'prompt'|'output', e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm("This action is permanent. Are you sure?")) return
    
    if(type === 'prompt') {
      setPrompts(prev => prev.filter(p => p.id !== id))
    } else {
      setOutputs(prev => prev.filter(o => o.id !== id))
    }
  }

  const handleSaveCollection = async () => {
    if (!collectionForm.name.trim()) return
    
    setSubmitting(true)
    setError('')
    
    const newColl = { 
      id: editingCollection ? editingCollection.id : `c-${Date.now()}`, 
      name: collectionForm.name, 
      description: collectionForm.description, 
      is_public: false 
    }
    
    if (editingCollection) {
      setCollections(prev => prev.map(c => c.id === editingCollection.id ? newColl : c))
    } else {
      setCollections(prev => [...prev, newColl])
    }
    
    setShowAddCollection(false)
    setEditingCollection(null)
    setCollectionForm({ name: '', description: '' })
    setSubmitting(false)
  }

  const openWorkspace = (prompt: Prompt) => {
    const isCustomCategory = !CATEGORIES.includes(prompt.category)
    
    setEditingPrompt(prompt)
    setForm({
      title: prompt.title, 
      content: prompt.content, 
      platforms: prompt.platforms || ['chatgpt'],
      category: isCustomCategory ? 'Other' : prompt.category, 
      collection_id: prompt.collection_id || '',
      customPlatforms: '', 
      customCategory: isCustomCategory ? prompt.category : '',
    })
    
    setActiveTab('editor')
    fetchVersions(prompt.id)
    setShowAddPrompt(true)
    setError('')
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
    
    if (view !== 'workflow-execution') { 
      setActiveWorkflow(null)
      setWorkflowStatus('idle') 
    }
  }

  // ============================================================================
  // AI OPTIMIZE
  // ============================================================================
  const triggerAIOptimize = (e?: React.MouseEvent) => {
    if(e) e.preventDefault()
    
    setIsOptimizing(true)
    setOptimizeResult(null)
    setShowOptimizeModal(true)
    
    setTimeout(() => {
      setOptimizeResult({
        strengths: ["Clear objective", "Good tone"],
        weaknesses: ["Lacks constraints", "Vague formatting"],
        improved_prompt: form.content + "\n\nFormat the output in markdown with clear headings."
      })
      setIsOptimizing(false)
    }, 2000)
  }

  const acceptOptimization = () => {
    if(optimizeResult) {
      setForm(prev => ({...prev, content: optimizeResult.improved_prompt}))
      setShowOptimizeModal(false)
    }
  }

  // ============================================================================
  // DRAG & DROP İŞLEMLERİ
  // ============================================================================
  const onDragStart = (e: DragEvent<HTMLDivElement>, index: number, type: 'prompt'|'output') => {
    if(type === 'prompt') {
      setDraggedPromptIdx(index)
    } else {
      setDraggedOutputIdx(index)
    }
    
    if (e.dataTransfer) { 
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData("text/plain", index.toString()) 
    }
  }

  const onDragEnter = (e: DragEvent<HTMLDivElement>, targetIndex: number, type: 'prompt'|'output') => {
    e.preventDefault()
    
    if(type === 'prompt') {
      if (draggedPromptIdx === null || draggedPromptIdx === targetIndex) return
      if (activeView !== 'all' && activeView !== 'collection') return
      
      const currentList = [...displayPrompts]
      const item = currentList[draggedPromptIdx]
      currentList.splice(draggedPromptIdx, 1)
      currentList.splice(targetIndex, 0, item)
      
      const activeIds = currentList.map(p => p.id)
      const updatedPrompts = [...prompts].sort((a, b) => {
        const idxA = activeIds.indexOf(a.id)
        const idxB = activeIds.indexOf(b.id)
        if (idxA !== -1 && idxB !== -1) return idxA - idxB
        return 0
      })
      
      setPrompts(updatedPrompts)
      setDraggedPromptIdx(targetIndex)
      
    } else {
      
      if (draggedOutputIdx === null || draggedOutputIdx === targetIndex) return
      if (activeView !== 'outputs') return
      
      const currentList = [...activeOutputs]
      const item = currentList[draggedOutputIdx]
      currentList.splice(draggedOutputIdx, 1)
      currentList.splice(targetIndex, 0, item)
      
      const activeIds = currentList.map(o => o.id)
      const updatedOutputs = [...outputs].sort((a, b) => {
        const idxA = activeIds.indexOf(a.id)
        const idxB = activeIds.indexOf(b.id)
        if (idxA !== -1 && idxB !== -1) return idxA - idxB
        return 0
      })
      
      setOutputs(updatedOutputs)
      setDraggedOutputIdx(targetIndex)
    }
  }

  const onDragEnd = (type: 'prompt'|'output') => {
    if(type === 'prompt') setDraggedPromptIdx(null)
    else setDraggedOutputIdx(null)
  }

  // ============================================================================
  // WORKFLOW BUILDER & ENGINE
  // ============================================================================
  const startWorkflow = (workflow: AppWorkflow) => {
    setActiveWorkflow(workflow)
    setCurrentStepIdx(0)
    setCurrentStepOutput('')
    setWorkflowStatus('running')
    setActiveView('workflow-execution')
  }

  const generateNewWorkflowIteration = () => {
    if(!activeWorkflow) return
    
    if(!currentStepOutput.trim()) { 
      alert("Please provide output to save iteration")
      return 
    }
    
    const newIteration: StepIteration = {
      id: `iter-${Date.now()}`,
      version_num: activeWorkflow.steps[currentStepIdx].iterations.length + 1,
      prompt_text: renderDynamicPrompt(activeWorkflow.steps[currentStepIdx].base_prompt),
      output_text: currentStepOutput,
      platform: activeWorkflow.steps[currentStepIdx].platforms[0] || 'chatgpt'
    }

    const updatedWorkflow = {...activeWorkflow}
    updatedWorkflow.steps[currentStepIdx].iterations.push(newIteration)
    updatedWorkflow.steps[currentStepIdx].selected_iteration_id = newIteration.id
    
    setActiveWorkflow(updatedWorkflow)
    
    setWorkflows(prev => prev.map(w => w.id === updatedWorkflow.id ? updatedWorkflow : w))
    setCurrentStepOutput('')
  }

  const handleNextWorkflowStep = () => {
    if (!activeWorkflow) return
    
    const currentStep = activeWorkflow.steps[currentStepIdx]
    
    if (currentStep.iterations.length === 0 && !currentStepOutput) {
      alert("Please generate at least one iteration output before continuing.")
      return
    }
    
    if(currentStepOutput.trim() && currentStep.iterations.length === 0) {
      generateNewWorkflowIteration()
    }

    if (currentStepIdx < activeWorkflow.steps.length - 1) {
      setCurrentStepIdx(prev => prev + 1)
      setCurrentStepOutput('')
    } else {
      setWorkflowStatus('completed')
    }
  }

  const renderDynamicPrompt = (promptText: string) => {
    if (!activeWorkflow) return promptText
    
    let processedPrompt = promptText
    const regex = /\{\{STEP_(\d+)_OUTPUT\}\}/g
    
    processedPrompt = processedPrompt.replace(regex, (match, stepNum) => {
      const targetStepIdx = parseInt(stepNum) - 1
      if (targetStepIdx >= 0 && targetStepIdx < activeWorkflow.steps.length) {
        const targetStep = activeWorkflow.steps[targetStepIdx]
        const selectedIter = targetStep.iterations.find(i => i.id === targetStep.selected_iteration_id)
        return selectedIter ? selectedIter.output_text : '[Awaiting Output]'
      }
      return match
    })
    
    return processedPrompt
  }

  const handlePromptSourceChange = (val: string) => {
    if(!activeWorkflow) return
    
    const updated = {...activeWorkflow}
    updated.steps[currentStepIdx].prompt_source = val as any
    
    if(val === 'ai_optimize') {
      updated.steps[currentStepIdx].base_prompt = "AI Optimized: " + updated.steps[currentStepIdx].base_prompt
    } else if (val === 'all_prompts' && activePrompts.length > 0) {
      updated.steps[currentStepIdx].base_prompt = activePrompts[0].content 
    }
    
    setActiveWorkflow(updated)
  }

  const saveWorkflowBuilder = () => {
    if(!workflowForm.title.trim()) return
    
    const existing = workflows.find(w => w.id === workflowForm.id)
    
    if(existing) {
      setWorkflows(prev => prev.map(w => w.id === workflowForm.id ? workflowForm : w))
    } else {
      setWorkflows(prev => [...prev, workflowForm])
    }
    
    setShowWorkflowBuilder(false)
  }

  // ============================================================================
  // FİLTRELEME VE SIRALAMA (PIN MANTIĞI EKLENDİ)
  // ============================================================================
  let filteredPrompts = activePrompts
  
  if (activeView === 'favorites') {
    filteredPrompts = activePrompts.filter(p => p.is_favorite)
  } else if (activeView === 'recent') {
    filteredPrompts = [...activePrompts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  } else if (activeView === 'collection') {
    filteredPrompts = activePrompts.filter(p => p.collection_id === activeCollection)
  } else if (activeView === 'platform') {
    filteredPrompts = activePrompts.filter(p => p.platforms.includes(activePlatform!))
  }
  
  const sortPinnedFirst = (items: any[]) => {
    return [...items].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1
      if (!a.is_pinned && b.is_pinned) return 1
      return 0
    })
  }
  
  const displayPrompts = searchResults !== null ? searchResults : sortPinnedFirst(filteredPrompts)
  const displayOutputs = sortPinnedFirst(activeOutputs)

  const totalPrompts = activePrompts.length
  const totalFavorites = activePrompts.filter(p => p.is_favorite).length
  
  const platformCounts = activePrompts.reduce((acc, p) => { 
    p.platforms.forEach(plat => {
      acc[plat] = (acc[plat] || 0) + 1
    })
    return acc 
  }, {} as Record<string, number>)
  
  const sortedPlatforms = Object.entries(platformCounts).sort(([,a], [,b]) => b - a).slice(0, 4)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060609] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#060609] text-slate-200 font-sans selection:bg-violet-500/30 flex overflow-hidden">
      
      {/* ============================================================================ */}
      {/* 6. SIDEBAR                                                                   */}
      {/* ============================================================================ */}
      <aside className={`h-screen bg-[#0A0A0F]/95 backdrop-blur-xl border-r border-white/5 flex flex-col z-20 shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-[80px]' : 'w-72'}`}>
        <div className={`p-6 border-b border-white/5 shrink-0 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_-5px_rgba(139,92,246,0.5)] shrink-0">
              <LayoutGrid className="w-4 h-4 text-white" />
            </div>
            {!isCollapsed && (
              <span className="font-semibold text-[18px] tracking-tight text-white transition-opacity duration-300">
                Prompax
              </span>
            )}
          </div>
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className={`p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all ${isCollapsed ? 'absolute -right-3 top-7 border border-white/10 bg-[#0A0A0F] shadow-lg z-50' : ''}`}
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-8 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full transition-colors">
          
          {/* WORKSPACE */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-4 mb-3 cursor-pointer group" onClick={() => toggleSection('workspace')}>
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">
                  Workspace
                </h3>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${expandedSections.workspace ? '' : '-rotate-90'}`} />
              </div>
            )}
            
            {(expandedSections.workspace || isCollapsed) && (
              <>
                <button 
                  onClick={() => setNav('all')} 
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'all' ? 'bg-violet-500/10 text-violet-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                >
                  <LayoutGrid className="w-4 h-4 shrink-0" />
                  {!isCollapsed && (
                    <>
                      All Prompts 
                      <span className="ml-auto text-[11px] bg-white/5 px-2 py-0.5 rounded-md font-medium text-slate-300">
                        {activePrompts.length}
                      </span>
                    </>
                  )}
                </button>
                
                <button 
                  onClick={() => setNav('outputs')} 
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'outputs' ? 'bg-pink-500/10 text-pink-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                >
                  <Library className="w-4 h-4 shrink-0" />
                  {!isCollapsed && (
                    <>
                      Saved Outputs 
                      <span className="ml-auto text-[11px] bg-white/5 px-2 py-0.5 rounded-md font-medium text-slate-300">
                        {activeOutputs.length}
                      </span>
                    </>
                  )}
                </button>
                
                <button 
                  onClick={() => setNav('favorites')} 
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'favorites' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                >
                  <Star className="w-4 h-4 shrink-0" />
                  {!isCollapsed && (
                    <>
                      Favorites 
                      <span className="ml-auto text-[11px] bg-white/5 px-2 py-0.5 rounded-md font-medium text-slate-300">
                        {totalFavorites}
                      </span>
                    </>
                  )}
                </button>
                
                <button 
                  onClick={() => setNav('recent')} 
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'recent' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                >
                  <Clock className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span>Recently Used</span>}
                </button>
                
                <button 
                  onClick={() => setNav('trash')} 
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'trash' ? 'bg-red-500/10 text-red-400' : 'text-slate-400 hover:text-red-400 hover:bg-white/5'}`}
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  {!isCollapsed && (
                    <>
                      Trash 
                      {trashedItems.length > 0 && (
                        <span className="ml-auto text-[11px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-md font-medium">
                          {trashedItems.length}
                        </span>
                      )}
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* WORKFLOWS */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-4 mb-3">
                <div className="flex items-center gap-2 cursor-pointer group flex-1" onClick={() => toggleSection('workflows')}>
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">
                    Workflows
                  </h3>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${expandedSections.workflows ? '' : '-rotate-90'}`} />
                </div>
                <button 
                  onClick={() => { 
                    setWorkflowForm({...initialWorkflowsData[0], id: `wf-${Date.now()}`, title: 'New Workflow'}); 
                    setShowWorkflowBuilder(true); 
                  }} 
                  className="text-slate-400 hover:text-indigo-400 transition-colors outline-none"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
            
            {isCollapsed && (
              <button 
                onClick={() => { 
                  setWorkflowForm({...initialWorkflowsData[0], id: `wf-${Date.now()}`, title: 'New Workflow'}); 
                  setShowWorkflowBuilder(true); 
                }} 
                title="Add Workflow" 
                className="w-full flex justify-center py-2 text-slate-400 hover:text-indigo-400"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            
            {(expandedSections.workflows || isCollapsed) && workflows.map(wf => (
              <div key={wf.id} className="relative group/wf flex items-center">
                <button 
                  onClick={() => setNav('workflows')} 
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4 pr-10'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'workflows' || activeWorkflow?.id === wf.id ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                >
                  <Workflow className="w-4 h-4 shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span className="truncate">{wf.title}</span>
                      <span className="ml-auto text-[11px] text-slate-500">{wf.steps.length}</span>
                    </>
                  )}
                </button>
                
                {!isCollapsed && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="absolute right-2 p-1.5 rounded-md text-slate-500 opacity-0 group-hover/wf:opacity-100 hover:bg-white/10 hover:text-slate-200 transition-all outline-none">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36 bg-[#1A1A28] border-white/10 text-slate-200 rounded-xl shadow-2xl p-1">
                      <DropdownMenuItem 
                        onClick={() => { setWorkflowForm(wf); setShowWorkflowBuilder(true); }} 
                        className="gap-2.5 cursor-pointer hover:bg-white/10 py-2 text-[12px] font-medium"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-400" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/5 my-1" />
                      <DropdownMenuItem 
                        onClick={() => { if(window.confirm("Delete Workflow?")) setWorkflows(prev => prev.filter(w=>w.id!==wf.id)) }} 
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

          {/* COLLECTIONS */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-4 mb-3">
                <div className="flex items-center gap-2 cursor-pointer group flex-1" onClick={() => toggleSection('collections')}>
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">
                    Collections
                  </h3>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${expandedSections.collections ? '' : '-rotate-90'}`} />
                </div>
                <button 
                  onClick={() => { 
                    setShowAddCollection(true); 
                    setError(''); 
                    setEditingCollection(null); 
                    setCollectionForm({name: '', description: ''}) 
                  }} 
                  className="text-slate-400 hover:text-violet-400 transition-colors outline-none"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
            
            {(expandedSections.collections || isCollapsed) && collections.map(col => (
              <div key={col.id} className="relative group/col flex items-center">
                <button 
                  onClick={() => setNav('collection', col.id)} 
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4 pr-10'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeCollection === col.id ? 'bg-violet-500/10 text-violet-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                >
                  <Folder className="w-4 h-4 shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span className="truncate">{col.name}</span>
                      <span className="ml-auto text-[11px] text-slate-500">
                        {activePrompts.filter(p => p.collection_id === col.id).length}
                      </span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* INSIGHTS */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-4 mb-3 cursor-pointer group" onClick={() => toggleSection('insights')}>
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">
                  Insights
                </h3>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${expandedSections.insights ? '' : '-rotate-90'}`} />
              </div>
            )}
            
            {(expandedSections.insights || isCollapsed) && (
              <button 
                onClick={() => setNav('analytics')} 
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'analytics' ? 'bg-green-500/10 text-green-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
              >
                <BarChart2 className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Analytics & Usage</span>}
              </button>
            )}
          </div>

          {/* PLATFORMS */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-4 mb-3 cursor-pointer group" onClick={() => toggleSection('platforms')}>
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">
                  Platforms
                </h3>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${expandedSections.platforms ? '' : '-rotate-90'}`} />
              </div>
            )}
            
            {(expandedSections.platforms || isCollapsed) && PLATFORMS.filter(p => p.value !== 'other').map(plat => (
              <button 
                key={plat.value} 
                onClick={() => setNav('platform', null, plat.value)} 
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activePlatform === plat.value ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${getPlatformDotColor(plat.value)}`} />
                {!isCollapsed && <span>{plat.label}</span>}
              </button>
            ))}
          </div>

          {/* RESOURCES (GERİ GELDİ) */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-4 mb-3 cursor-pointer group" onClick={() => toggleSection('resources')}>
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">
                  Resources
                </h3>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${expandedSections.resources ? '' : '-rotate-90'}`} />
              </div>
            )}
            
            {(expandedSections.resources || isCollapsed) && (
              <>
                <button className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all`}>
                  <BookOpen className="w-4 h-4 shrink-0" /> 
                  {!isCollapsed && <span>Prompt Guide</span>}
                </button>
                <button className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all`}>
                  <MessageSquare className="w-4 h-4 shrink-0" /> 
                  {!isCollapsed && <span>Submit Feedback</span>}
                </button>
                <button className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-[13px] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all`}>
                  <Settings className="w-4 h-4 shrink-0" /> 
                  {!isCollapsed && <span>Settings & API</span>}
                </button>
              </>
            )}
          </div>
        </div>

        {/* BOTTOM USER PROFILE */}
        <div className="p-4 border-t border-white/5 bg-[#060609]/50 shrink-0 space-y-3">
          <button className={`w-full flex items-center justify-center ${isCollapsed ? 'p-3' : 'gap-2 py-3'} bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[13px] font-semibold rounded-xl transition-all`}>
            <Zap className="w-4 h-4 fill-current shrink-0" /> 
            {!isCollapsed && <span>Upgrade to Pro</span>}
          </button>
          
          <div className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer`}>
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} className="w-8 h-8 rounded-full shrink-0" alt="Avatar" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-300 text-[12px] font-semibold shrink-0">
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

      {/* ============================================================================ */}
      {/* 7. MAIN CONTENT AREA                                                         */}
      {/* ============================================================================ */}
      <main className="flex-1 flex flex-col relative h-screen overflow-hidden">
        
        {/* HEADER */}
        <header className="sticky top-0 z-10 bg-[#060609]/80 backdrop-blur-xl border-b border-white/5 px-10 py-6 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[22px] font-bold text-white tracking-tight flex items-center gap-2">
                {activeView === 'workflow-execution' ? 'Workflow Execution Engine' : 
                 searchResults !== null ? 'Search Results' : 
                 activeView === 'workflows' ? 'Automated Workflows' : 
                 activeView === 'outputs' ? 'Saved Outputs' : 
                 activeView === 'trash' ? 'Trash' : 
                 activeView === 'analytics' ? 'Analytics & Usage' : 
                 activeView === 'collection' ? collections.find(c => c.id === activeCollection)?.name : 'All Prompts'}
              </h1>
            </div>
          </div>
          
          <div className="flex gap-3">
            {activeView === 'workflows' && (
              <button 
                onClick={() => { 
                  setWorkflowForm({...initialWorkflowsData[0], id: `wf-${Date.now()}`, title: 'New Workflow'}) 
                  setShowWorkflowBuilder(true) 
                }} 
                className="flex items-center gap-2 text-white text-[13px] font-medium px-5 py-2.5 rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(99,102,241,0.4)] bg-indigo-600 hover:bg-indigo-500"
              >
                <Plus className="w-4 h-4" /> Create Workflow
              </button>
            )}
            
            {(activeView !== 'trash' && activeView !== 'analytics' && activeView !== 'workflows' && activeView !== 'workflow-execution') && (
              <button 
                onClick={() => { 
                  if(activeView === 'outputs') { 
                    setShowAddOutput(true)
                    setOutputForm(emptyOutputForm) 
                  } else { 
                    setShowAddPrompt(true)
                    setEditingPrompt(null)
                    setForm(emptyForm) 
                  } 
                }} 
                className={`flex items-center gap-2 text-white text-[13px] font-medium px-5 py-2.5 rounded-xl transition-all ${activeView === 'outputs' ? 'bg-pink-600 hover:bg-pink-500' : 'bg-violet-600 hover:bg-violet-500'}`}
              >
                <Plus className="w-4 h-4" /> 
                {activeView === 'outputs' ? 'Smart Magic Paste' : 'New Prompt'}
              </button>
            )}
          </div>
        </header>

        {/* SEARCH BAR */}
        {(activeView !== 'trash' && activeView !== 'analytics' && activeView !== 'outputs' && activeView !== 'workflows' && activeView !== 'workflow-execution') && (
          <div className="px-10 pt-8 pb-2 shrink-0">
            <div className="relative max-w-2xl group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <Input 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="Search prompts..." 
                className="w-full bg-[#0A0A0F]/80 backdrop-blur-md border border-white/5 rounded-2xl pl-14 pr-12 py-7 text-[14px] text-white placeholder-slate-500" 
              />
            </div>
          </div>
        )}

        <div className="flex-1 p-10 pt-6 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/5 relative">
          
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

          {/* ============================================================================ */}
          {/* VIEW: 1. WORKFLOW EXECUTION                                                  */}
          {/* ============================================================================ */}
          {activeView === 'workflow-execution' && activeWorkflow ? (
            <div className="relative z-10 w-full max-w-6xl mx-auto h-full min-h-[600px] flex gap-6 pb-10">
              
              {workflowStatus === 'completed' ? (
                <div className="w-full bg-[#0A0A0F]/90 backdrop-blur-lg border border-indigo-500/20 rounded-3xl p-12 flex flex-col items-center justify-center text-center">
                  <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mb-8 border border-green-500/30">
                    <CheckCircle className="w-12 h-12 text-green-400" />
                  </div>
                  <h2 className="text-4xl font-bold text-white mb-4">Workflow Completed!</h2>
                  <button 
                    onClick={() => setNav('workflows')} 
                    className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-[15px] font-medium transition-all"
                  >
                    Return to Dashboard
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 bg-[#0A0A0F]/80 border border-white/5 rounded-3xl flex flex-col overflow-hidden shadow-2xl relative">
                    <div className="p-8 border-b border-white/5 bg-gradient-to-r from-[#060609] to-[#0A0A0F]">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-indigo-400 text-[12px] font-bold uppercase tracking-wider bg-indigo-500/10 px-3 py-1 rounded-md">
                          Step {currentStepIdx + 1} of {activeWorkflow.steps.length}
                        </span>
                        <span className="text-slate-500 text-[13px]">
                          {activeWorkflow.title}
                        </span>
                      </div>
                      <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                        {activeWorkflow.steps[currentStepIdx].title}
                      </h2>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-8 space-y-8">
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div className="bg-black/40 border border-white/5 rounded-2xl p-5">
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase mb-2">Goal</h4>
                          <p className="text-[14px] text-slate-300">
                            {activeWorkflow.steps[currentStepIdx].goal}
                          </p>
                        </div>
                        <div className="bg-black/40 border border-white/5 rounded-2xl p-5">
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase mb-2">Target Platforms</h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            {activeWorkflow.steps[currentStepIdx].platforms.map(p => (
                              <span key={p} className={`px-2 py-1 rounded text-[11px] font-semibold border ${getPlatformStyle(p)}`}>
                                {getPlatformLabel(p)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">
                            Prompt Source
                          </h4>
                          <Select 
                            value={activeWorkflow.steps[currentStepIdx].prompt_source} 
                            onValueChange={handlePromptSourceChange}
                          >
                            <SelectTrigger className="w-48 bg-[#060609] border-white/10 text-[12px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200 text-[12px]">
                              <SelectItem value="manual">Write Manually</SelectItem>
                              <SelectItem value="all_prompts">Select from All Prompts</SelectItem>
                              <SelectItem value="ai_optimize">Use AI Optimize</SelectItem>
                              <SelectItem value="favorite">Use Favorite Prompt</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="bg-[#060609] border border-white/10 rounded-2xl p-6 relative">
                          <Textarea 
                            value={activeWorkflow.steps[currentStepIdx].base_prompt} 
                            onChange={(e) => {
                              const updated = {...activeWorkflow}
                              updated.steps[currentStepIdx].base_prompt = e.target.value
                              setActiveWorkflow(updated)
                            }}
                            className="text-[15px] text-slate-300 bg-transparent border-none resize-none focus-visible:ring-0 min-h-[100px] p-0"
                          />
                        </div>
                      </div>

                      {/* OUTPUT CAPTURE & ITERATIONS */}
                      <div className="mt-8 pt-8 border-t border-white/5">
                         <h4 className="text-[12px] font-bold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                           <ArrowDown className="w-4 h-4" /> Save Step Iteration Output
                         </h4>
                         <Textarea 
                           value={currentStepOutput} 
                           onChange={(e) => setCurrentStepOutput(e.target.value)} 
                           placeholder="Paste AI response here to save as a new iteration..." 
                           className="w-full min-h-[100px] bg-black/40 border border-indigo-500/20 rounded-2xl p-4 text-[13px] text-slate-200 resize-y focus-visible:ring-1 focus-visible:ring-indigo-500/50 mb-3" 
                         />
                         <button 
                           onClick={generateNewWorkflowIteration} 
                           className="px-5 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 rounded-lg text-[12px] font-bold transition-colors"
                         >
                           Save Output as Iteration
                         </button>
                      </div>

                      {activeWorkflow.steps[currentStepIdx].iterations.length > 0 && (
                        <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
                          <h4 className="text-[12px] font-bold text-slate-400 uppercase mb-4">Step Iterations</h4>
                          <div className="space-y-3">
                            {activeWorkflow.steps[currentStepIdx].iterations.map(iter => (
                              <div 
                                key={iter.id} 
                                className={`p-4 rounded-xl border cursor-pointer transition-colors ${activeWorkflow.steps[currentStepIdx].selected_iteration_id === iter.id ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-black/30 border-white/5 hover:border-white/20'}`} 
                                onClick={() => { 
                                  const up = {...activeWorkflow}
                                  up.steps[currentStepIdx].selected_iteration_id = iter.id
                                  setActiveWorkflow(up) 
                                }}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[13px] font-bold text-slate-200">Iteration v{iter.version_num}</span>
                                  {activeWorkflow.steps[currentStepIdx].selected_iteration_id === iter.id && (
                                    <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded font-bold uppercase">
                                      Selected for Next Step
                                    </span>
                                  )}
                                </div>
                                <p className="text-[12px] text-slate-400 line-clamp-2">{iter.output_text}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="p-6 border-t border-white/5 bg-[#060609] flex items-center justify-between shrink-0">
                      <button 
                        onClick={() => { if(currentStepIdx > 0) setCurrentStepIdx(c => c - 1) }} 
                        disabled={currentStepIdx === 0} 
                        className="text-slate-500 hover:text-white disabled:opacity-50 text-[13px] font-medium transition-colors"
                      >
                        Previous Step
                      </button>
                      
                      <button 
                        onClick={handleNextWorkflowStep} 
                        className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-[14px] font-bold transition-all flex items-center gap-2"
                      >
                        {currentStepIdx < activeWorkflow.steps.length - 1 ? 'Continue' : 'Finish Workflow'} 
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* SIDEBAR FOR PROGRESS */}
                  <div className="w-[320px] flex flex-col gap-6 shrink-0">
                    <div className="bg-[#0A0A0F]/80 border border-white/5 rounded-3xl p-6 shadow-xl">
                      <h3 className="text-[13px] font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-indigo-400" /> Workflow Progress
                      </h3>
                      
                      <div className="relative pl-3 space-y-8 before:absolute before:inset-y-3 before:left-[19px] before:w-[2px] before:bg-white/10">
                        {activeWorkflow.steps.map((step, idx) => {
                          const isCompleted = idx < currentStepIdx
                          const isActive = idx === currentStepIdx
                          return (
                            <div key={step.id} className="relative flex gap-4 z-10">
                              <div className={`w-4 h-4 rounded-full mt-1 shrink-0 ${isCompleted ? 'bg-green-500' : isActive ? 'bg-indigo-500 ring-4 ring-indigo-500/20' : 'bg-slate-700'}`}></div>
                              <div>
                                <h4 className={`text-[14px] font-bold ${isCompleted ? 'text-slate-300' : isActive ? 'text-indigo-400' : 'text-slate-500'}`}>
                                  {step.title}
                                </h4>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            
          // ============================================================================
          // VIEW: 2. WORKFLOWS LIST
          // ============================================================================
          ) : activeView === 'workflows' ? (
            <div className="relative z-10 w-full max-w-5xl mx-auto space-y-10 pb-10">
              <div className="grid grid-cols-1 gap-6">
                {workflows.map(wf => (
                  <div key={wf.id} className="bg-[#0A0A0F]/80 p-8 rounded-3xl border border-white/5 shadow-2xl relative">
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-3">
                          <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400 border border-indigo-500/30">
                            <Workflow className="w-6 h-6"/>
                          </div>
                          <h2 className="text-2xl font-bold text-white tracking-tight">{wf.title}</h2>
                          <span className="bg-white/10 text-slate-300 text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md">
                            {wf.steps.length} Steps
                          </span>
                        </div>
                        <p className="text-slate-400 text-[14px] ml-16 max-w-2xl">{wf.description}</p>
                      </div>
                      
                      <div className="mt-6 md:mt-0 flex gap-3 shrink-0">
                        <button 
                          onClick={() => { setWorkflowForm(wf); setShowWorkflowBuilder(true); }} 
                          className="bg-white/5 hover:bg-white/10 text-white px-5 py-3 rounded-xl flex items-center gap-2 text-[13px] font-semibold transition-all border border-transparent"
                        >
                          <Edit2 className="w-4 h-4" /> Edit
                        </button>
                        
                        <button 
                          onClick={() => startWorkflow(wf)} 
                          className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl flex items-center gap-2 text-[14px] font-bold transition-all shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]"
                        >
                          <Play className="w-4 h-4 fill-current" /> Run Workflow
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          // ============================================================================
          // VIEW: 3. OUTPUTS / SAVED OUTPUTS
          // ============================================================================
          ) : activeView === 'outputs' ? (
            displayOutputs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center relative z-10">
                <div className="w-20 h-20 rounded-3xl bg-pink-500/5 border border-pink-500/10 flex items-center justify-center mb-6 shadow-inner">
                  <Library className="w-10 h-10 text-pink-400/50" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Saved Outputs Empty</h2>
                <p className="text-[14px] text-slate-500 max-w-md mb-6">Use Smart Magic Paste to archive your best AI outputs directly from the chat.</p>
                <button 
                  onClick={() => setShowAddOutput(true)} 
                  className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-[13px] font-medium transition-colors border border-white/10"
                >
                  Smart Magic Paste
                </button>
              </div>
            ) : (
              <div className="columns-1 md:columns-2 xl:columns-3 gap-6 space-y-6 relative z-10 pb-10">
                {displayOutputs.map((output, idx) => (
                  <div 
                    key={output.id} 
                    draggable={true} 
                    onDragStart={(e) => onDragStart(e, idx, 'output')} 
                    onDragEnter={(e) => onDragEnter(e, idx, 'output')} 
                    onDragEnd={() => onDragEnd('output')} 
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => setViewingOutput(output)} 
                    className={`break-inside-avoid cursor-pointer group flex flex-col bg-[#0A0A0F]/80 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-pink-500/40 transition-all duration-300 shadow-lg hover:shadow-[0_0_30px_-5px_rgba(236,72,153,0.15)] relative ${draggedOutputIdx === idx ? 'opacity-30 border-dashed border-pink-500 scale-95' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing mr-1">
                          <GripVertical className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                        </div>
                        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-white/5 px-2.5 py-1 rounded-md">
                          {getFormatIcon(output.format)} {output.format.replace('_', ' ')}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${getPlatformDotColor(output.platform)}`} title={getPlatformLabel(output.platform)} />
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => togglePinOutput(output, e)} 
                          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all outline-none text-slate-500 hover:text-blue-400 opacity-0 group-hover:opacity-100"
                        >
                          <Pin className={`h-4 w-4 ${output.is_pinned ? 'fill-blue-400 text-blue-400 opacity-100' : ''}`} />
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
                              onClick={(e) => handleMoveToTrash(output.id, 'output', e as any)} 
                              className="gap-2.5 cursor-pointer text-red-400 focus:text-red-400 hover:bg-red-500/10 py-2.5"
                            >
                              <Trash2 className="h-4 w-4" /> Move to Trash
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden">
                      <p className="text-[14px] text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-6">{output.content}</p>
                      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0A0A0F] to-transparent pointer-events-none group-hover:from-[#0d0d16] transition-colors duration-300" />
                    </div>
                  </div>
                ))}
              </div>
            )

          // ============================================================================
          // VIEW: 4. TRASH
          // ============================================================================
          ) : activeView === 'trash' ? (
             <div className="relative z-10 w-full max-w-5xl mx-auto pb-10">
               {trashedItems.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-[400px] text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-5">
                      <Trash2 className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-white text-[16px] font-medium">Trash is empty</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                   {trashedItems.map(item => (
                     <div key={item.id} className="flex flex-col bg-red-950/10 border border-red-500/10 rounded-2xl p-6 h-[280px] shadow-lg group relative">
                       <div className="flex items-start justify-between gap-4 mb-3">
                         <h3 className="text-[15px] font-semibold line-clamp-2 text-slate-400 line-through decoration-red-500/50">
                           {item.type === 'prompt' ? (item as Prompt).title : 'Output Content'}
                         </h3>
                         <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button 
                             onClick={(e) => handleRestoreFromTrash(item.id, item.type as any, e)} 
                             className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                           >
                             <RefreshCw className="w-4 h-4" />
                           </button>
                           <button 
                             onClick={(e) => handlePermanentDelete(item.id, item.type as any, e)} 
                             className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>
                       </div>
                       <div className="relative flex-1 overflow-hidden mb-4">
                         <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-slate-600">{item.content}</p>
                         <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0A0A0F]/80 to-transparent pointer-events-none transition-colors duration-300" />
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>

          // ============================================================================
          // VIEW: 5. ANALYTICS
          // ============================================================================
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
             </div>
             
          // ============================================================================
          // VIEW: 6. PROMPTS GRID
          // ============================================================================
          ) : displayPrompts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-5">
                <Search className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-white text-[16px] font-medium">No prompts found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative z-10 pb-10">
              {displayPrompts.map((prompt, index) => (
                <div 
                  key={prompt.id} 
                  draggable={activeView === 'all' || activeView === 'collection'} 
                  onDragStart={(e) => onDragStart(e, index, 'prompt')} 
                  onDragEnter={(e) => onDragEnter(e, index, 'prompt')} 
                  onDragEnd={() => onDragEnd('prompt')} 
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => openWorkspace(prompt)} 
                  className={`group cursor-pointer flex flex-col backdrop-blur-sm border rounded-2xl p-6 transition-all duration-300 h-[280px] shadow-lg relative ${draggedPromptIdx === index ? 'opacity-30 border-dashed border-violet-500 scale-95' : ''} bg-[#0A0A0F]/80 border-white/5 hover:border-violet-500/40 hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.15)]`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    
                    {(activeView === 'all' || activeView === 'collection') && (
                      <div className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                        <GripVertical className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                      </div>
                    )}
                    
                    <h3 className="text-[15px] font-semibold leading-snug line-clamp-2 flex-1 text-slate-100 group-hover:text-violet-100 transition-colors">
                      {prompt.title}
                    </h3>
                    
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => togglePinPrompt(prompt, e)} 
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all outline-none text-slate-500 hover:text-blue-400 opacity-0 group-hover:opacity-100"
                      >
                        <Pin className={`h-4 w-4 ${prompt.is_pinned ? 'fill-blue-400 text-blue-400 opacity-100' : ''}`} />
                      </button>
                      <button 
                        onClick={(e) => toggleFavorite(prompt, e)} 
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all outline-none text-slate-500 hover:text-amber-400 opacity-0 group-hover:opacity-100"
                      >
                        <Star className={`h-4 w-4 ${prompt.is_favorite ? 'fill-amber-400 text-amber-400 opacity-100' : ''}`} />
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
                            onClick={(e) => handleMoveToTrash(prompt.id, 'prompt', e as any)} 
                            className="gap-2.5 cursor-pointer text-red-400 focus:text-red-400 hover:bg-red-500/10 py-2.5"
                          >
                            <Trash2 className="h-4 w-4" /> Move to Trash
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  
                  <div className="relative flex-1 overflow-hidden mb-4">
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-slate-400">{prompt.content}</p>
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0A0A0F] to-transparent pointer-events-none group-hover:from-[#0d0d16] transition-colors duration-300" />
                  </div>
                  
                  <div className="flex items-center gap-2 mt-auto pt-4 border-t border-white/5">
                    
                    {/* MULTI PLATFORM DOTS */}
<div className="flex -space-x-2">
  {prompt.platforms.slice(0,3).map((p: string) => (
     <span 
       key={p} 
       className={`w-6 h-6 rounded-full border border-[#0A0A0F] flex items-center justify-center text-[8px] font-bold uppercase ${getPlatformStyle(p)}`} 
       title={getPlatformLabel(p)}
     >
       {p.substring(0,1)}
     </span>
  ))}
</div>
                    
                    <span className="text-[11px] bg-white/5 border border-white/5 px-2.5 py-1 rounded-md text-slate-400 ml-2">
                      {prompt.category}
                    </span>
                    
                    <button 
                      onClick={(e) => copyToClipboard(prompt.content, prompt.id, e)} 
                      className="ml-auto flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-violet-500/20 hover:text-violet-300 text-slate-400 transition-all border border-transparent hover:border-violet-500/30"
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

      {/* ============================================================================ */}
      {/* 8. MODALLAR (OVERLAYS)                                                       */}
      {/* ============================================================================ */}

      {/* WORKFLOW BUILDER MODAL */}
      <Dialog open={showWorkflowBuilder} onOpenChange={(open) => setShowWorkflowBuilder(open)}>
        <DialogContent className="bg-[#0A0A0F] border-white/10 rounded-2xl sm:max-w-[95vw] w-[95vw] h-[95vh] shadow-2xl p-0 gap-0 overflow-hidden text-white flex flex-col [&>button]:hidden">
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-gradient-to-r from-[#0A0A0F] to-[#111118] shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Workflow className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <DialogTitle className="text-[19px] font-semibold text-white tracking-tight">
                  Workflow Builder
                </DialogTitle>
                <p className="text-[13px] text-slate-400 mt-0.5">Design your automated AI pipeline</p>
              </div>
            </div>
            <button 
              onClick={() => setShowWorkflowBuilder(false)} 
              className="text-slate-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2.5 rounded-xl flex items-center gap-2 text-[13px] font-medium"
            >
              <XCircle className="w-5 h-5" /> Close
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 bg-[#060609] space-y-8">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                  Workflow Title
                </label>
                <Input 
                  value={workflowForm.title} 
                  onChange={e => setWorkflowForm(prev => ({...prev, title: e.target.value}))} 
                  className="bg-[#0A0A0F] border-white/10 text-white" 
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                  Description
                </label>
                <Input 
                  value={workflowForm.description} 
                  onChange={e => setWorkflowForm(prev => ({...prev, description: e.target.value}))} 
                  className="bg-[#0A0A0F] border-white/10 text-white" 
                />
              </div>
            </div>
            
            <div className="border-t border-white/5 pt-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[16px] font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" /> Workflow Steps
                </h3>
                <button 
                  onClick={() => setWorkflowForm(prev => ({
                    ...prev, 
                    steps: [
                      ...prev.steps, 
                      {
                        id: `step-${Date.now()}`, 
                        number: prev.steps.length + 1, 
                        title: 'New Step', 
                        goal: '', 
                        platforms: ['chatgpt'], 
                        prompt_source: 'manual', 
                        base_prompt: '', 
                        iterations: [], 
                        selected_iteration_id: null
                      }
                    ]
                  }))} 
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-[13px] font-medium flex items-center gap-2 border border-white/10"
                >
                  <Plus className="w-4 h-4" /> Add Step
                </button>
              </div>
              
              <div className="space-y-4">
                {workflowForm.steps.map((step, sIdx) => (
                  <div key={step.id} className="bg-[#0A0A0F] border border-white/5 rounded-2xl p-6 relative">
                    <button 
                      onClick={() => setWorkflowForm(prev => { 
                        const n = {...prev}
                        n.steps.splice(sIdx, 1)
                        return n 
                      })} 
                      className="absolute top-4 right-4 text-red-400 hover:text-red-300 p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    
                    <div className="flex items-center gap-4 mb-4">
                      <span className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                        {sIdx+1}
                      </span>
                      <Input 
                        value={step.title} 
                        onChange={e => { 
                          const n = {...workflowForm}
                          n.steps[sIdx].title = e.target.value
                          setWorkflowForm(n) 
                        }} 
                        placeholder="Step Name" 
                        className="w-64 bg-black/40 border-white/10 text-white" 
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] text-slate-500 uppercase mb-1 block">Goal</label>
                        <Input 
                          value={step.goal} 
                          onChange={e => { 
                            const n = {...workflowForm}
                            n.steps[sIdx].goal = e.target.value
                            setWorkflowForm(n) 
                          }} 
                          className="bg-black/40 border-white/10 text-white text-[13px]" 
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 uppercase mb-1 block">Platform (Main)</label>
                        <Select 
                          value={step.platforms[0]} 
                          onValueChange={v => { 
                            const n = {...workflowForm}
                            n.steps[sIdx].platforms = [v]
                            setWorkflowForm(n) 
                          }}
                        >
                          <SelectTrigger className="bg-black/40 border-white/10 text-white text-[13px] h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200">
                            <MenuItems items={PLATFORMS} />
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="p-6 border-t border-white/5 bg-[#0A0A0F] flex gap-4 shrink-0 justify-end">
            <button 
              onClick={() => setShowWorkflowBuilder(false)} 
              className="px-6 py-3 rounded-xl border border-white/10 text-[14px] font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={saveWorkflowBuilder} 
              className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-[14px] font-medium text-white flex items-center gap-2 shadow-[0_0_15px_-3px_rgba(99,102,241,0.5)] transition-all"
            >
              <CheckCircle2 className="w-5 h-5" /> Save Workflow
            </button>
          </div>
        </DialogContent>
      </Dialog>


      {/* ÇIKTI GÖRÜNTÜLEME MODALI (SPLIT VIEW) */}
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
                  {viewingOutput && getPlatformLabel(viewingOutput.platform)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => viewingOutput && handleMoveToTrash(viewingOutput.id, 'output')} 
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
            <div className="w-full lg:w-[35%] bg-[#0A0A0F]/50 border-b lg:border-b-0 lg:border-r border-white/5 p-8 overflow-y-auto space-y-8">
              <div className="bg-white/5 border border-white/5 border-dashed rounded-xl p-6 text-center text-[13px] text-slate-500">
                Output Detail View
              </div>
            </div>
            
            <div className="flex-1 flex flex-col relative h-full">
              <div className="flex-1 p-10 overflow-y-auto">
                <p className="text-[15px] text-slate-200 leading-loose whitespace-pre-wrap font-serif">
                  {viewingOutput?.content}
                </p>
              </div>
              
              <div className="p-6 border-t border-white/5 bg-[#0A0A0F] flex justify-end">
                <button 
                  onClick={(e) => viewingOutput && copyToClipboard(viewingOutput.content, viewingOutput.id, e)} 
                  className="px-8 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-medium flex items-center gap-2"
                >
                  <Copy className="w-5 h-5" /> Copy Asset
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* SMART MAGIC PASTE MODAL */}
      <Dialog open={showAddOutput} onOpenChange={(open) => { if (!submitting) { setShowAddOutput(open); if (!open) { setPromptSearchQuery(''); setIsPromptDropdownOpen(false); setError(''); } } }}>
        <DialogContent className="bg-[#0A0A0F] border-white/10 rounded-2xl sm:max-w-[95vw] w-[95vw] h-[95vh] shadow-2xl p-0 gap-0 overflow-hidden text-white flex flex-col [&>button]:hidden">
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-gradient-to-r from-[#0A0A0F] to-[#111118] shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
                <Library className="w-6 h-6 text-pink-400" />
              </div>
              <div>
                <DialogTitle className="text-[19px] font-semibold text-white tracking-tight">
                  Smart Magic Paste
                </DialogTitle>
                <p className="text-[13px] text-slate-400 mt-0.5">
                  Auto-extract prompt and output from chat logs
                </p>
              </div>
            </div>
            <button 
              onClick={() => setShowAddOutput(false)} 
              className="text-slate-500 hover:text-white bg-white/5 p-2.5 rounded-xl"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-hidden bg-[#060609] grid grid-cols-1 lg:grid-cols-3 relative">
            <div className="p-8 space-y-6 bg-[#0A0A0F]/50 overflow-y-auto h-full border-r border-white/5 relative z-20">
              <div className="bg-gradient-to-b from-pink-500/10 to-violet-500/5 border border-pink-500/20 rounded-2xl p-1 shadow-lg">
                <div className="bg-[#060609]/80 backdrop-blur rounded-xl p-5 space-y-4">
                  <Textarea 
                    value={outputForm.magicPasteContent} 
                    onChange={e => setOutputForm(f => ({ ...f, magicPasteContent: e.target.value }))} 
                    placeholder="Paste raw chat transcript here..." 
                    className="w-full bg-black/40 border-white/10 rounded-xl p-3 text-[13px] text-slate-300 h-24 resize-none" 
                  />
                  <button 
                    onClick={handleMagicPaste} 
                    disabled={isMagicPasting || !outputForm.magicPasteContent.trim()} 
                    className="w-full py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-[13px] font-medium"
                  >
                    {isMagicPasting ? 'Parsing...' : 'Auto-Extract & Fill'}
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] text-slate-400 block mb-2">Format</label>
                  <Select value={outputForm.format} onValueChange={(v) => setOutputForm(f => ({...f, format: v}))}>
                    <SelectTrigger className="bg-[#060609] border-white/10 text-[13px]">
                      <SelectValue/>
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200">
                      <MenuItems items={FORMATS.map(f=>({value:f,label:f}))}/>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[12px] text-slate-400 block mb-2">Platform</label>
                  <Select value={outputForm.platform} onValueChange={(v) => setOutputForm(f => ({...f, platform: v}))}>
                    <SelectTrigger className="bg-[#060609] border-white/10 text-[13px]">
                      <SelectValue/>
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200">
                      <MenuItems items={PLATFORMS}/>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="relative z-0">
                <label className="text-[12px] text-slate-400 block mb-2">Notes</label>
                <Input 
                  value={outputForm.notes || ''} 
                  onChange={e => setOutputForm(f => ({...f, notes: e.target.value}))} 
                  className="bg-[#060609] border-white/10" 
                />
              </div>
            </div>
            
            <div className="lg:col-span-2 flex flex-col h-full bg-[#060609] min-h-0">
              <div className="flex-1 px-6 pt-6 min-h-0 flex flex-col">
                <Textarea 
                  value={outputForm.content} 
                  onChange={e => setOutputForm(f => ({ ...f, content: e.target.value }))} 
                  className="w-full h-full bg-[#0A0A0F] border border-white/5 rounded-2xl p-8 text-[15px] text-slate-200 resize-none" 
                />
              </div>
              <div className="p-6 border-t border-white/5 bg-[#0A0A0F] flex gap-4">
                <button 
                  onClick={() => setShowAddOutput(false)} 
                  className="px-6 py-4 rounded-xl border border-white/10 text-[14px] text-slate-400"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddOutput} 
                  className="flex-1 py-4 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-medium flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5"/> Save Output
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* FULL WORKSPACE MODAL (PROMPT EKLEME/DÜZENLEME & ÇIKTI SEKME DESTEĞİ) */}
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
            
            {/* TABS */}
            <div className="flex items-center bg-[#060609] p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => setActiveTab('editor')} 
                className={`px-5 py-2.5 rounded-lg text-[13px] font-medium flex items-center gap-2 transition-all ${activeTab === 'editor' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                <Edit2 className="w-4 h-4" /> Prompt Editor
              </button>
              
              {editingPrompt && (
                <button 
                  onClick={() => setActiveTab('history')} 
                  className={`px-5 py-2.5 rounded-lg text-[13px] font-medium flex items-center gap-2 transition-all ${activeTab === 'history' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                >
                  <History className="w-4 h-4" /> Version History
                  <span className="text-[11px] bg-white/10 px-1.5 py-0.5 rounded-md text-slate-300">
                    {promptVersions.length}
                  </span>
                </button>
              )}
              
              {editingPrompt && (
                <button 
                  onClick={() => setActiveTab('outputs')} 
                  className={`px-5 py-2.5 rounded-lg text-[13px] font-medium flex items-center gap-2 transition-all ${activeTab === 'outputs' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                >
                  <Library className="w-4 h-4" /> Saved Outputs
                </button>
              )}
            </div>
            
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
                <div className="p-8 space-y-6 bg-[#0A0A0F]/50 overflow-y-auto h-full border-r border-white/5">
                  {error && (
                    <div className="flex items-center gap-2 text-[13px] text-red-400 bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <p>{error}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-[12px] font-semibold text-slate-400 uppercase block mb-2">Title</label>
                    <Input 
                      value={form.title} 
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))} 
                      className="bg-[#060609] border-white/10 text-white" 
                    />
                  </div>
                  
                  {/* MULTI-SELECT PLATFORM ALANI */}
                  <div>
                    <label className="text-[12px] font-semibold text-slate-400 uppercase block mb-2">
                      Target Platforms (Multi-Select)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORMS.filter(p => p.value !== 'other').map(p => (
                        <button 
                          key={p.value} 
                          onClick={() => togglePlatformSelection(p.value)}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${form.platforms.includes(p.value) ? getPlatformStyle(p.value) + ' ring-2 ring-white/10' : 'bg-[#060609] text-slate-500 border-white/10 hover:border-white/30'}`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[12px] font-semibold text-slate-400 uppercase block mb-2">Category</label>
                    <Select 
                      value={form.category} 
                      onValueChange={(v) => setForm(f => ({ ...f, category: v }))}
                    >
                      <SelectTrigger className="bg-[#060609] border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200">
                        <MenuItems items={CATEGORIES.map(c => ({value: c, label: c}))} />
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="lg:col-span-2 flex flex-col h-full bg-[#060609] min-h-0 overflow-hidden relative">
                  
                  {/* DIŞ BAĞLANTI BUTONLARI (OPEN IN CHATGPT VS) */}
                  <div className="absolute top-4 right-4 z-10 flex gap-2">
                    {form.platforms.map(platValue => {
                      const platObj = PLATFORMS.find(p => p.value === platValue)
                      if(!platObj || platObj.value === 'other') return null
                      return (
                        <button 
                          key={platValue} 
                          onClick={() => window.open(platObj.url, '_blank')} 
                          className={`px-4 py-2 ${platObj.bg} hover:opacity-80 rounded-lg text-[12px] font-bold transition-colors flex items-center gap-1.5 shadow-lg backdrop-blur-md border`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Open {platObj.label}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex-1 px-6 pt-6 pb-6 min-h-0 flex flex-col relative mt-10">
                    <Textarea 
                      value={form.content} 
                      onChange={e => setForm(f => ({ ...f, content: e.target.value }))} 
                      placeholder="Type your prompt..." 
                      className="w-full h-full bg-[#0A0A0F] border border-white/5 rounded-2xl p-8 text-[15px] text-slate-200 resize-none" 
                    />
                  </div>
                  
                  <div className="p-6 border-t border-white/5 bg-[#0A0A0F] flex gap-4 shrink-0 justify-end">
                    <button 
                      disabled={submitting} 
                      onClick={() => setShowAddPrompt(false)} 
                      className="px-6 py-4 rounded-xl border border-white/10 text-[14px] text-slate-400"
                    >
                      Cancel
                    </button>
                    
                    {/* AI OPTIMIZE BUTONU */}
                    <button 
                      onClick={triggerAIOptimize} 
                      className="px-6 py-4 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30 text-[14px] font-bold flex items-center gap-2 hover:bg-violet-500/30 transition-colors"
                    >
                      <Wand2 className="w-4 h-4"/> AI Optimize
                    </button>
                    
                    <button 
                      disabled={submitting} 
                      onClick={editingPrompt ? handleEditPrompt : handleAddPrompt} 
                      className="px-8 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" /> {editingPrompt ? 'Save Modifications' : 'Create Prompt'}
                    </button>
                  </div>
                </div>
              </div>
            ) : activeTab === 'history' ? (
              <div className="h-full overflow-y-auto p-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {promptVersions.map(v => (
                    <div key={v.id} className="bg-[#0A0A0F] border border-white/5 rounded-2xl p-6 h-[320px]">
                      <div className="flex justify-between border-b border-white/5 pb-3 mb-3">
                        <span className="text-[12px] text-violet-400">V{v.version_num}</span>
                      </div>
                      <p className="text-[13px] text-slate-400">{v.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // SAVED OUTPUTS TAB İÇERİĞİ (PROMPT İÇİNDEN ÇIKTI EKLEME)
              <div className="flex h-full">
                <div className="w-1/3 bg-[#0A0A0F]/50 border-r border-white/5 p-6 flex flex-col">
                  <h4 className="text-[13px] font-bold text-white mb-4">Add Output to this Prompt</h4>
                  
                  <Textarea 
                    id="inlineOutputText" 
                    placeholder="Paste result here..." 
                    className="flex-1 bg-black/40 border-white/10 mb-4 text-[13px]" 
                  />
                  
                  <Select 
                    defaultValue="chatgpt" 
                    onValueChange={(v) => { (window as any).tempPlat = v; }}
                  >
                    <SelectTrigger className="bg-[#060609] border-white/10 mb-4">
                      <SelectValue/>
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1A28] text-white">
                      <MenuItems items={PLATFORMS}/>
                    </SelectContent>
                  </Select>
                  
                  <button 
                    onClick={() => {
                      const el = document.getElementById('inlineOutputText') as HTMLTextAreaElement
                      const val = el?.value
                      const plat = (window as any).tempPlat || 'chatgpt'
                      if(val) { 
                        handleAddOutputInline(val, plat)
                        el.value = '' 
                      }
                    }} 
                    className="w-full py-3 bg-pink-600 hover:bg-pink-500 rounded-xl text-white font-bold"
                  >
                    Save Output
                  </button>
                </div>
                
                <div className="flex-1 p-8 overflow-y-auto bg-[#060609]">
                   <h4 className="text-[16px] font-bold text-white mb-6 flex items-center gap-2">
                     <Library className="w-5 h-5 text-pink-400" /> Linked Outputs
                   </h4>
                   <div className="grid grid-cols-2 gap-6">
                     {activeOutputs.filter(o => o.prompt_id === editingPrompt?.id).map(out => (
                       <div key={out.id} className="bg-[#0A0A0F] border border-white/5 rounded-2xl p-5">
                         <span className={`text-[10px] uppercase px-2 py-1 rounded font-bold ${getPlatformStyle(out.platform)}`}>
                           {out.platform}
                         </span>
                         <p className="text-[13px] text-slate-300 mt-3 line-clamp-4">{out.content}</p>
                       </div>
                     ))}
                   </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI OPTIMIZE MODAL */}
      <Dialog open={showOptimizeModal} onOpenChange={setShowOptimizeModal}>
        <DialogContent className="bg-[#0A0A0F] border-white/10 rounded-2xl sm:max-w-[80vw] w-[80vw] h-[80vh] shadow-2xl p-0 gap-0 overflow-hidden text-white flex flex-col [&>button]:hidden">
          <div className="p-6 border-b border-white/5 bg-gradient-to-r from-[#0A0A0F] to-[#111118] flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Wand2 className="w-6 h-6 text-violet-400" />
              <DialogTitle>AI Optimization</DialogTitle>
            </div>
            <button onClick={() => setShowOptimizeModal(false)}>
              <XCircle className="w-5 h-5 text-slate-500 hover:text-white" />
            </button>
          </div>
          
          <div className="flex-1 overflow-hidden relative">
            {isOptimizing ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
              </div>
            ) : optimizeResult ? (
              <div className="flex h-full p-8 gap-8">
                <div className="w-1/2 space-y-6">
                  <h4 className="text-[13px] text-slate-400">Original</h4>
                  <div className="p-4 bg-black/40 rounded-xl text-[14px] text-slate-300 whitespace-pre-wrap">
                    {form.content}
                  </div>
                </div>
                <div className="w-1/2 flex flex-col">
                  <h4 className="text-[13px] text-violet-400 mb-4">Optimized</h4>
                  <Textarea 
                    value={optimizeResult.improved_prompt} 
                    onChange={e => setOptimizeResult(prev => ({...prev!, improved_prompt: e.target.value}))} 
                    className="flex-1 bg-violet-500/5 border-violet-500/20 text-[15px] p-4 resize-none" 
                  />
                  <button 
                    onClick={acceptOptimization} 
                    className="mt-4 py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold"
                  >
                    Replace Prompt
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* COLLECTION MODAL */}
      <Dialog open={showAddCollection} onOpenChange={setShowAddCollection}>
        <DialogContent className="bg-[#111118] border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-0 gap-0 text-white [&>button]:hidden">
          <div className="flex justify-between p-6 border-b border-white/5">
            <DialogTitle>Collection</DialogTitle>
            <button onClick={() => setShowAddCollection(false)}>
              <XCircle className="w-5 h-5 text-slate-500"/>
            </button>
          </div>
          <div className="p-6 space-y-5">
            <Input 
              value={collectionForm.name} 
              onChange={e => setCollectionForm(f => ({...f, name: e.target.value}))} 
              placeholder="Name" 
              className="bg-[#060609] border-white/10" 
            />
          </div>
          <div className="p-6 border-t border-white/5">
            <button 
              onClick={handleSaveCollection} 
              className="w-full py-3 bg-violet-600 hover:bg-violet-500 rounded-xl"
            >
              Save
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MenuItems({ items }: { items: {value: string, label: string}[] }) {
  return (
    <>
      {items.map(i => (
        <SelectItem key={i.value} value={i.value} className="cursor-pointer">
          {i.label}
        </SelectItem>
      ))}
    </>
  )
}