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
  ArrowDown, Save, FastForward, Pin, Layers, Database, MousePointerClick, Edit3,
  Undo2, FileDown, FolderOpen
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
// 2. ORTAK STİL TANIMLAMALARI (GLOBAL STYLES)
// ============================================================================
// Profesyonel ve ince kaydırma çubuğu (Scrollbar) sınıfları. Amatör görünümü engeller.
const scrollbarClasses = "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full transition-colors"

// ============================================================================
// 3. TİP TANIMLAMALARI (TYPES & INTERFACES)
// ============================================================================

/**
 * Kullanıcı tarafından oluşturulan Prompt veri yapısı.
 */
export interface Prompt {
  id: string
  title: string
  description: string 
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

/**
 * Promptları gruplamak için kullanılan Koleksiyon veri yapısı.
 */
export interface Collection {
  id: string
  name: string
  description: string
  is_public: boolean
}

/**
 * Sistemden alınan veya kaydedilen Yapay Zeka Çıktısı (Output) veri yapısı.
 */
export interface Output {
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

/**
 * AI Optimize işlemi sonucunda dönen veriler.
 */
export interface OptimizeResult { 
  strengths: string[]
  weaknesses: string[]
  improved_prompt: string 
}

/**
 * Promptların eski sürümlerini tutan geçmiş veri yapısı.
 */
export interface PromptVersion { 
  id: string
  prompt_id: string
  content: string
  version_num: number
  created_at: string 
  deleted_at: string | null // Restore/Trash için eklendi
}

// ----------------------------------------------------------------------------
// WORKFLOW ENGINE TİPLERİ (TAMAMEN BAĞIMSIZ VERSİYONLAMA İÇİN GELİŞTİRİLDİ)
// ----------------------------------------------------------------------------

/**
 * Workflow yapısının yapı taşı olan adımlar (Steps). Blueprint (Şablon) görevi görür.
 */
export interface WorkflowStep {
  id: string
  number: number
  title: string
  goal: string
  platforms: string[]
  prompt_source: 'manual' | 'all_prompts' | 'ai_optimize' | 'favorite'
  base_prompt: string
}

/**
 * Ana Workflow Şablonu.
 */
export interface AppWorkflow {
  id: string
  title: string
  description: string
  steps: WorkflowStep[]
  created_at: string
}

export interface ExecutionVersion {
  id: string
  step_id: string
  version_num: number
  title: string
  goal: string
  platforms: string[]
  prompt_source: 'manual' | 'all_prompts' | 'ai_optimize' | 'favorite'
  prompt_text: string
  output_text: string
}

export interface OptimizeResult { 
  strengths: string[]
  weaknesses: string[]
  improved_prompt: string 
}

/**
 * WORKFLOW EXECUTION: Çalışma anında üretilen ve Step'ten tamamen bağımsız olan kopya iterasyon (Versiyon).
 * Kullanıcı her "Generate" dediğinde bundan bir tane daha oluşur.
 */
export interface ExecutionVersion {
  id: string
  step_id: string
  version_num: number
  title: string // Örn: Research Phase v1
  goal: string
  platforms: string[]
  prompt_source: 'manual' | 'all_prompts' | 'ai_optimize' | 'favorite'
  prompt_text: string
  output_text: string
}

// ============================================================================
// 4. SABİT VERİLER & YARDIMCI FONKSİYONLAR
// ============================================================================

export const PLATFORMS = [
  { value: 'chatgpt', label: 'ChatGPT', bg: 'bg-[#10a37f]/15 text-[#10a37f] border-[#10a37f]/20', url: 'https://chat.openai.com' },
  { value: 'claude', label: 'Claude', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/20', url: 'https://claude.ai' },
  { value: 'gemini', label: 'Gemini', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/20', url: 'https://gemini.google.com' },
  { value: 'deepseek', label: 'DeepSeek', bg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20', url: 'https://chat.deepseek.com' },
  { value: 'grok', label: 'Grok', bg: 'bg-zinc-100/15 text-zinc-300 border-zinc-500/20', url: 'https://x.com/i/grok' },
  { value: 'other', label: 'Other', bg: 'bg-violet-500/15 text-violet-400 border-violet-500/20', url: '#' },
]

export const CATEGORIES = [
  'General', 
  'Writing', 
  'Coding', 
  'Marketing', 
  'Research', 
  'Design', 
  'Other'
]

export const FORMATS = [
  'email', 
  'tweet', 
  'social_post', 
  'article', 
  'ad_copy', 
  'code', 
  'other'
]

export function getPlatformStyle(value: string): string {
  const found = PLATFORMS.find(p => p.value === value)
  return found ? found.bg : 'bg-violet-500/15 text-violet-400 border-violet-500/20'
}

export function getPlatformLabel(value: string): string {
  const found = PLATFORMS.find(p => p.value === value)
  if (found && value !== 'other') return found.label
  if (value === 'other') return 'Other'
  return value.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export function getPlatformUrl(value: string): string {
  const found = PLATFORMS.find(p => p.value.toLowerCase() === value.toLowerCase())
  return found ? found.url : '#'
}

export function getPlatformDotColor(value: string): string {
  if(value === 'chatgpt') return 'bg-[#10a37f]'
  if(value === 'claude') return 'bg-amber-500'
  if(value === 'gemini') return 'bg-blue-500'
  if(value === 'deepseek') return 'bg-indigo-500'
  if(value === 'grok') return 'bg-zinc-300'
  return 'bg-violet-500'
}

export function getFormatIcon(format: string) {
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

/**
 * Profesyonel CSV Dışa Aktarma Fonksiyonu.
 * Tırnakları ve satır atlamalarını düzgün bir şekilde Excel'e uyumlu hale getirir.
 */
function downloadCSV(filename: string, rows: string[][]) {
  const processRow = (row: string[]) => {
    return row.map(val => {
      let finalVal = val == null ? '' : val.toString()
      if (finalVal.search(/("|,|\n)/g) >= 0) {
        finalVal = `"${finalVal.replace(/"/g, '""')}"`
      }
      return finalVal
    }).join(',')
  }
  
  const csvContent = rows.map(processRow).join('\n')
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const emptyForm = { 
  title: '', 
  description: '', 
  content: '', 
  platforms: ['chatgpt'], 
  category: 'General', 
  collection_id: 'none', 
  customPlatforms: '', 
  customCategory: '' 
}

const emptyOutputForm = { 
  content: '', 
  format: 'other', 
  platform: 'chatgpt', 
  prompt_id: 'none', 
  notes: '', 
  customFormat: '', 
  customPlatform: '', 
  magicPasteContent: '' 
}

export const initialWorkflowsData: AppWorkflow[] = [
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
      },
      {
        id: 'step-2',
        number: 2,
        title: 'Hook Generation',
        goal: 'Create high-retention opening hooks based on research.',
        platforms: ['chatgpt'],
        prompt_source: 'manual',
        base_prompt: 'Using the previous research, generate 10 high-retention YouTube hooks using the "Curiosity Gap" framework.',
      }
    ]
  }
];

// ============================================================================
// 5. ANA BİLEŞEN (MAIN DASHBOARD COMPONENT)
// ============================================================================

export default function Dashboard() {
  const router = useRouter()
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  ))

  const [user, setUser] = useState<{ id?: string, email?: string; user_metadata?: { full_name?: string; avatar_url?: string } } | null>(null)
  
  // -----------------------------------------------------
  // VERİ STATELERİ (DATA STATES)
  // -----------------------------------------------------
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [outputs, setOutputs] = useState<Output[]>([])
  const [workflows, setWorkflows] = useState<AppWorkflow[]>(initialWorkflowsData)
  
  const [loading, setLoading] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // -----------------------------------------------------
  // SIDEBAR AÇILIR/KAPANIR DURUMLARI (ACCORDION STATES)
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
  // MODAL DURUMLARI (MODAL VISIBILITY)
  // -----------------------------------------------------
  const [showAddPrompt, setShowAddPrompt] = useState(false)
  const [showAddCollection, setShowAddCollection] = useState(false)
  const [showAddOutput, setShowAddOutput] = useState(false)
  const [viewingOutput, setViewingOutput] = useState<Output | null>(null)
  
  const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false)
  const [workflowForm, setWorkflowForm] = useState<AppWorkflow>(initialWorkflowsData[0])

  // Dev (95vw) Prompt Seçim Modalları için Stateler
  const [showAllPromptsModal, setShowAllPromptsModal] = useState(false)
  const [showFavoritesModal, setShowFavoritesModal] = useState(false)
  
  // Seçim modallarının içindeki özel arama state'leri
  const [modalSearchQuery, setModalSearchQuery] = useState('')

  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [editingOutput, setEditingOutput] = useState<Output | null>(null)
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null)
  
  // Görünüm (View) Yönetimi
  const [activeView, setActiveView] = useState<'all' | 'favorites' | 'recent' | 'trash' | 'analytics' | 'outputs' | 'platform' | 'collection' | 'workflows' | 'workflow-execution' | 'unified-prompt'>('all')
  const [activeCollection, setActiveCollection] = useState<string | null>(null)
  const [activePlatform, setActivePlatform] = useState<string | null>(null)
  
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  
  // Ana Arama Stateleri
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Prompt[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  const [isPromptDropdownOpen, setIsPromptDropdownOpen] = useState(false)
  const [promptSearchQuery, setPromptSearchQuery] = useState('')

  // -----------------------------------------------------
  // AI OPTİMİZASYON STATELERİ (AI OPTIMIZE)
  // -----------------------------------------------------
  const [showOptimizeModal, setShowOptimizeModal] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null)

  // -----------------------------------------------------
  // PROMPT MODAL SEKMELERİ (TABS)
  // -----------------------------------------------------
  const [activeTab, setActiveTab] = useState<'editor' | 'history' | 'outputs'>('editor')
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)

  // -----------------------------------------------------
  // FORM STATELERİ (FORMS)
  // -----------------------------------------------------
  const [form, setForm] = useState(emptyForm)
  const [outputForm, setOutputForm] = useState(emptyOutputForm)
  const [collectionForm, setCollectionForm] = useState({ name: '', description: '' })
  
  // Unified Prompt Form State
  const [unifiedForm, setUnifiedForm] = useState({
    title: '',
    description: '',
    platforms: [] as string[],
    combinedPrompt: '',
    combinedOutput: ''
  })

  const [submitting, setSubmitting] = useState(false)
  const [isMagicPasting, setIsMagicPasting] = useState(false)
  const [error, setError] = useState('')

  // -----------------------------------------------------
  // DRAG & DROP STATELERİ (DND)
  // -----------------------------------------------------
  const [draggedPromptIdx, setDraggedPromptIdx] = useState<number | null>(null)
  const [draggedOutputIdx, setDraggedOutputIdx] = useState<number | null>(null)
  
  // Workflow step sürükleme için
  const [draggedStepIdx, setDraggedStepIdx] = useState<number | null>(null)
  
  // -----------------------------------------------------
  // WORKFLOW EXECUTION ENGINE STATELERİ (YENİ MİMARİ)
  // -----------------------------------------------------
  const [activeWorkflow, setActiveWorkflow] = useState<AppWorkflow | null>(null)
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  
  // Tüm execution boyunca oluşan bağımsız versiyonlar: Record<stepId, ExecutionVersion[]>
  const [executionVersions, setExecutionVersions] = useState<Record<string, ExecutionVersion[]>>({})
  
  // Hangi step'te, hangi versiyon ID'sinin aktif olarak ekranda göründüğünü tutar.
  const [activeVersionIds, setActiveVersionIds] = useState<Record<string, string>>({})
  
  const [workflowStatus, setWorkflowStatus] = useState<'idle' | 'running' | 'completed'>('idle')

  // ============================================================================
  // MEMOIZED VERİLER (PERFORMANCE OPTIMIZATION)
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

  // Modallar için arama filtreleri
  const modalFilteredPrompts = useMemo(() => {
    if (!modalSearchQuery) return activePrompts
    return activePrompts.filter(p => 
      p.title.toLowerCase().includes(modalSearchQuery.toLowerCase()) || 
      p.content.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(modalSearchQuery.toLowerCase())
    )
  }, [activePrompts, modalSearchQuery])

  const modalFilteredFavorites = useMemo(() => {
    const favs = activePrompts.filter(p => p.is_favorite)
    if (!modalSearchQuery) return favs
    return favs.filter(p => 
      p.title.toLowerCase().includes(modalSearchQuery.toLowerCase()) || 
      p.content.toLowerCase().includes(modalSearchQuery.toLowerCase())
    )
  }, [activePrompts, modalSearchQuery])

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

  // Ana ekran arama mantığı
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      // Eğer all, favorites, collection, platform görünümündeyse promptlarda ara
      if (searchQuery.trim().length > 2 && (activeView === 'all' || activeView === 'favorites' || activeView === 'collection' || activeView === 'platform')) {
        setIsSearching(true)
        try {
          const lowerQuery = searchQuery.toLowerCase()
          let baseList = activePrompts
          if (activeView === 'favorites') baseList = activePrompts.filter(p => p.is_favorite)
          if (activeView === 'collection') baseList = activePrompts.filter(p => p.collection_id === activeCollection)
          if (activeView === 'platform') baseList = activePrompts.filter(p => p.platforms.includes(activePlatform!))
          
          const localMatches = baseList.filter(p => 
            p.title.toLowerCase().includes(lowerQuery) || 
            p.description.toLowerCase().includes(lowerQuery) ||
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
  }, [searchQuery, activePrompts, activeView, activeCollection, activePlatform])

  /**
   * Sayfa yüklendiğinde temel verileri çeker veya mock veri oluşturur.
   */
  const fetchAll = async () => {
    try {
      setPrompts([
        { 
          id: '1', 
          title: 'SEO Optimized Blog Post', 
          description: 'A comprehensive prompt to write full-length articles optimized for search engines.',
          content: 'Write a comprehensive 1500-word blog post about [Topic]...', 
          platforms: ['chatgpt', 'claude'], 
          category: 'Writing', 
          use_count: 5, 
          created_at: new Date().toISOString(), 
          collection_id: 'c1', 
          is_favorite: true, 
          is_pinned: true, 
          deleted_at: null 
        },
        { 
          id: '2', 
          title: 'React Performance Audit', 
          description: 'Analyzes React code to find rendering bottlenecks.',
          content: 'Review the following React code for performance bottlenecks...', 
          platforms: ['claude', 'grok'], 
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
          is_pinned: true, 
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
          content: 'Initial draft version of the prompt...', 
          version_num: 1, 
          created_at: new Date(Date.now() - 86400000).toISOString(),
          deleted_at: null
        },
        { 
          id: `v2-${promptId}`, 
          prompt_id: promptId, 
          content: 'Second improved version...', 
          version_num: 2, 
          created_at: new Date().toISOString(),
          deleted_at: null
        }
      ])
      setLoadingVersions(false)
    }, 500)
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // ============================================================================
  // YARDIMCI FORM FONKSİYONLARI & KAYIT İŞLEMLERİ (CRUD)
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
  
  const getFinalPlatforms = () => {
    let final = form.platforms.filter(p => p !== 'other')
    if (form.platforms.includes('other') && form.customPlatforms.trim()) {
      final.push(form.customPlatforms.trim().toLowerCase().replace(/\s+/g, '-'))
    }
    if (final.length === 0) final = ['chatgpt']
    return final
  }

  const getFinalOutputFormat = () => {
    return outputForm.format === 'other' && outputForm.customFormat.trim() 
      ? outputForm.customFormat.trim().toLowerCase().replace(/\s+/g, '_') 
      : outputForm.format
  }
  
  const getFinalOutputPlatform = () => {
    return outputForm.platform === 'other' && outputForm.customPlatform.trim() 
      ? outputForm.customPlatform.trim().toLowerCase().replace(/\s+/g, '-') 
      : outputForm.platform
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
      description: form.description.trim(),
      content: form.content.trim(), 
      platforms: getFinalPlatforms(),
      category: getFinalCategory(), 
      collection_id: form.collection_id === 'none' ? null : form.collection_id, 
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
      description: form.description.trim(),
      content: form.content.trim(), 
      platforms: getFinalPlatforms(), 
      category: getFinalCategory(), 
      collection_id: form.collection_id === 'none' ? null : form.collection_id
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

  const handleSaveOutput = async () => {
    if (!outputForm.content.trim()) { 
      setError('Output content is required.')
      return 
    }
    
    setSubmitting(true)
    setError('')
    
    const outputData: Output = {
        id: editingOutput ? editingOutput.id : `mock-out-${Date.now()}`, 
        prompt_id: outputForm.prompt_id === 'none' ? null : outputForm.prompt_id,
        content: outputForm.content, 
        format: getFinalOutputFormat(), 
        platform: getFinalOutputPlatform(), 
        notes: outputForm.notes,
        metrics: editingOutput ? editingOutput.metrics : {}, 
        created_at: editingOutput ? editingOutput.created_at : new Date().toISOString(), 
        is_pinned: editingOutput ? editingOutput.is_pinned : false, 
        deleted_at: null
    }
    
    if (editingOutput) {
       setOutputs(prev => prev.map(o => o.id === editingOutput.id ? outputData : o))
    } else {
       setOutputs(prev => [outputData, ...prev])
    }
    
    setOutputForm(emptyOutputForm)
    setEditingOutput(null)
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
        notes: 'Saved directly from Prompt Workspace',
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
  // DURUM YÖNETİMİ (PIN, FAVORITE, TRASH, RESTORE)
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

  const handleMoveToTrash = (id: string, type: 'prompt'|'output'|'version', e?: React.MouseEvent) => {
    if(e) e.stopPropagation()
    const now = new Date().toISOString()
    
    if(type === 'prompt') {
      setPrompts(prev => prev.map(p => p.id === id ? { ...p, deleted_at: now, is_favorite: false, is_pinned: false } : p))
      if (searchResults) {
        setSearchResults(prev => prev ? prev.filter(p => p.id !== id) : null)
      }
    } else if (type === 'output') {
      setOutputs(prev => prev.map(o => o.id === id ? { ...o, deleted_at: now, is_pinned: false } : o))
    } else if (type === 'version') {
      // Version History içindeki silme
      if(window.confirm("Bu versiyonu silmek (çöpe atmak) istediğinize emin misiniz?")) {
        setPromptVersions(prev => prev.map(v => v.id === id ? { ...v, deleted_at: now } : v))
      }
    }
  }

  const handleRestoreFromTrash = (id: string, type: 'prompt'|'output'|'version', e?: React.MouseEvent) => {
    if(e) e.stopPropagation()
    if(type === 'prompt') {
      setPrompts(prev => prev.map(p => p.id === id ? { ...p, deleted_at: null } : p))
    } else if (type === 'output') {
      setOutputs(prev => prev.map(o => o.id === id ? { ...o, deleted_at: null } : o))
    } else if (type === 'version') {
       // Version History içindeki geri yükleme (İçeriği ana form'a aktarır)
       const versionToRestore = promptVersions.find(v => v.id === id)
       if(versionToRestore) {
         if(window.confirm(`Versiyon ${versionToRestore.version_num} düzenleyiciye aktarılacak. Onaylıyor musunuz?`)) {
           setForm(f => ({...f, content: versionToRestore.content}))
           setActiveTab('editor')
         }
       }
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
    const hasCustomPlatform = prompt.platforms.some(p => !PLATFORMS.find(plat => plat.value === p) && p !== 'other')
    
    let finalPlatforms = [...prompt.platforms]
    let cPlatformStr = ''
    if (hasCustomPlatform) {
      cPlatformStr = finalPlatforms.find(p => !PLATFORMS.find(plat => plat.value === p)) || ''
      finalPlatforms = finalPlatforms.filter(p => PLATFORMS.find(plat => plat.value === p))
      if (!finalPlatforms.includes('other')) finalPlatforms.push('other')
    }
    
    setEditingPrompt(prompt)
    setForm({
      title: prompt.title, 
      description: prompt.description || '',
      content: prompt.content, 
      platforms: finalPlatforms.length > 0 ? finalPlatforms : ['chatgpt'],
      category: isCustomCategory ? 'Other' : prompt.category, 
      collection_id: prompt.collection_id || 'none', // Dropdown için none yapıyoruz
      customPlatforms: cPlatformStr, 
      customCategory: isCustomCategory ? prompt.category : '',
    })
    
    setActiveTab('editor')
    fetchVersions(prompt.id)
    setShowAddPrompt(true)
    setError('')
  }

  const openOutputEdit = (output: Output, e?: React.MouseEvent) => {
    if(e) e.stopPropagation();
    
    const isCustomFormat = !FORMATS.includes(output.format)
    const isCustomPlatform = !PLATFORMS.find(p => p.value === output.platform)
    
    setEditingOutput(output)
    setOutputForm({
      content: output.content,
      format: isCustomFormat ? 'other' : output.format,
      platform: isCustomPlatform ? 'other' : output.platform,
      prompt_id: output.prompt_id || 'none',
      notes: output.notes || '',
      customFormat: isCustomFormat ? output.format : '',
      customPlatform: isCustomPlatform ? output.platform : '',
      magicPasteContent: ''
    })
    
    if (output.prompt_id) {
       const linkedP = activePrompts.find(p => p.id === output.prompt_id)
       if(linkedP) setPromptSearchQuery(linkedP.title)
    }
    
    setShowAddOutput(true)
    setError('')
  }

  const copyToClipboard = (text: string, id: string, e?: React.MouseEvent) => {
    if(e) e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const setNav = (view: typeof activeView, colId: string | null = null, plat: string | null = null) => {
    setActiveView(view)
    setActiveCollection(colId)
    setActivePlatform(plat)
    setSearchQuery('')
    setSearchResults(null)
    
    if (view !== 'workflow-execution' && view !== 'unified-prompt') { 
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
  // DRAG & DROP İŞLEMLERİ (NATIVE HTML5 - SÜRÜKLE BIRAK)
  // ============================================================================
  
  const onDragStart = (e: DragEvent<HTMLDivElement>, index: number, type: 'prompt'|'output'|'step') => {
    if(type === 'prompt') setDraggedPromptIdx(index)
    else if(type === 'output') setDraggedOutputIdx(index)
    else if(type === 'step') setDraggedStepIdx(index)
    
    if (e.dataTransfer) { 
      e.dataTransfer.effectAllowed = "move"
      // Firefox için gerekli olabiliyor
      e.dataTransfer.setData("text/plain", index.toString()) 
    }
  }

  // Elementler üzerinde gezinirken sadece drag stili vermek için
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }

  // Drop anında gerçek yer değiştirmeyi yap. (Önceden Enter'da yapılıyordu, bu zıplamalara yol açıyordu).
  const onDrop = (e: DragEvent<HTMLDivElement>, targetIndex: number, type: 'prompt'|'output'|'step') => {
    e.preventDefault()
    
    if(type === 'prompt') {
      if (draggedPromptIdx === null || draggedPromptIdx === targetIndex) return
      if (activeView !== 'all' && activeView !== 'collection' && activeView !== 'favorites' && activeView !== 'recent') return
      
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
      
    } else if (type === 'output') {
      if (draggedOutputIdx === null || draggedOutputIdx === targetIndex) return
      if (activeView !== 'outputs') return
      
      const currentList = [...displayOutputs] 
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

    } else if (type === 'step') {
      if (draggedStepIdx === null || draggedStepIdx === targetIndex) return
      
      setWorkflowForm(prev => {
        const newSteps = [...prev.steps]
        const item = newSteps[draggedStepIdx]
        newSteps.splice(draggedStepIdx, 1)
        newSteps.splice(targetIndex, 0, item)
        // Numaraları yeniden sırala
        newSteps.forEach((s, i) => s.number = i + 1)
        return {...prev, steps: newSteps}
      })
    }
    
    setDraggedPromptIdx(null)
    setDraggedOutputIdx(null)
    setDraggedStepIdx(null)
  }

  const onDragEnd = () => {
    setDraggedPromptIdx(null)
    setDraggedOutputIdx(null)
    setDraggedStepIdx(null)
  }

  // ============================================================================
  // WORKFLOW BUILDER & ENGINE (TAMAMEN BAĞIMSIZ VERSİYON MİMARİSİ)
  // ============================================================================

  const saveWorkflowBuilder = () => {
    if(!workflowForm.title.trim()) return
    
    const finalizedSteps = workflowForm.steps.map(step => {
      let finalPlats = step.platforms.filter(p => p !== 'other')
      return {...step, platforms: step.platforms.length > 0 ? step.platforms : ['chatgpt']}
    })

    const finalWf = {...workflowForm, steps: finalizedSteps}

    const existing = workflows.find(w => w.id === workflowForm.id)
    if(existing) {
      setWorkflows(prev => prev.map(w => w.id === workflowForm.id ? finalWf : w))
    } else {
      setWorkflows(prev => [...prev, finalWf])
    }
    
    setShowWorkflowBuilder(false)
  }

  const startWorkflow = (workflow: AppWorkflow) => {
    setActiveWorkflow(workflow)
    setCurrentStepIdx(0)
    
    // Workflow başlatıldığında, her step için "Blueprint"ten (Şablondan) 1. Versiyonu kopyalayarak oluştururuz.
    // Artık ana şablon ve çalışma kopyası birbirinden tamamen ayrı.
    const initialVersions: Record<string, ExecutionVersion[]> = {}
    const initialActiveIds: Record<string, string> = {}
    
    workflow.steps.forEach(step => {
      const firstVersionId = `v-init-${Date.now()}-${step.id}`
      initialVersions[step.id] = [{
        id: firstVersionId,
        step_id: step.id,
        version_num: 1,
        title: `${step.title} v1`,
        goal: step.goal,
        platforms: [...step.platforms],
        prompt_source: step.prompt_source,
        prompt_text: step.base_prompt,
        output_text: ''
      }]
      initialActiveIds[step.id] = firstVersionId
    })
    
    setExecutionVersions(initialVersions)
    setActiveVersionIds(initialActiveIds)
    setWorkflowStatus('running')
    setActiveView('workflow-execution')
  }

  /**
   * Sağ Sidebar'dan "Generate" butonuna basıldığında ilgili Step için yeni, boş bir versiyon açar.
   */
  const generateNewStepVersion = (stepId: string, baseStep: WorkflowStep) => {
    const currentIters = executionVersions[stepId] || []
    const nextVerNum = currentIters.length + 1
    const newVersionId = `v-gen-${Date.now()}-${stepId}`
    
    const newVersion: ExecutionVersion = {
      id: newVersionId,
      step_id: stepId,
      version_num: nextVerNum,
      title: `${baseStep.title} v${nextVerNum}`,
      goal: baseStep.goal, // Şablondan varsayılanı alır
      platforms: [...baseStep.platforms],
      prompt_source: baseStep.prompt_source,
      prompt_text: baseStep.base_prompt,
      output_text: ''
    }
    
    setExecutionVersions(prev => ({
      ...prev,
      [stepId]: [...currentIters, newVersion]
    }))
    
    setActiveVersionIds(prev => ({
      ...prev,
      [stepId]: newVersionId
    }))
    
    // Kullanıcı otomatik olarak bu step'e odaklansın
    const sIdx = activeWorkflow?.steps.findIndex(s => s.id === stepId)
    if(sIdx !== undefined && sIdx !== -1) {
      setCurrentStepIdx(sIdx)
    }
  }

  /**
   * Çalışma anındaki aktif versiyonun Prompt alanını günceller.
   */
  const handleExecutionPromptChange = (val: string) => {
    if(!activeWorkflow) return
    const currentStepId = activeWorkflow.steps[currentStepIdx].id
    const activeVId = activeVersionIds[currentStepId]
    
    setExecutionVersions(prev => {
      const stepVersions = prev[currentStepId].map(v => 
        v.id === activeVId ? { ...v, prompt_text: val } : v
      )
      return { ...prev, [currentStepId]: stepVersions }
    })
  }
  
  /**
   * Çalışma anındaki aktif versiyonun Output alanını günceller. (Her harf yazıldığında state güncellenir)
   */
  const handleExecutionOutputChange = (val: string) => {
    if(!activeWorkflow) return
    const currentStepId = activeWorkflow.steps[currentStepIdx].id
    const activeVId = activeVersionIds[currentStepId]
    
    setExecutionVersions(prev => {
      const stepVersions = prev[currentStepId].map(v => 
        v.id === activeVId ? { ...v, output_text: val } : v
      )
      return { ...prev, [currentStepId]: stepVersions }
    })
  }

  /**
   * Çalışma anındaki aktif versiyonun Goal alanını günceller.
   */
  const handleExecutionGoalChange = (val: string) => {
    if(!activeWorkflow) return
    const currentStepId = activeWorkflow.steps[currentStepIdx].id
    const activeVId = activeVersionIds[currentStepId]
    
    setExecutionVersions(prev => {
      const stepVersions = prev[currentStepId].map(v => 
        v.id === activeVId ? { ...v, goal: val } : v
      )
      return { ...prev, [currentStepId]: stepVersions }
    })
  }

  /**
   * Çalışma anındaki aktif versiyonun Platform listesini günceller.
   */
  const handleExecutionPlatformsChange = (newPlats: string[]) => {
    if(!activeWorkflow) return
    const currentStepId = activeWorkflow.steps[currentStepIdx].id
    const activeVId = activeVersionIds[currentStepId]
    
    setExecutionVersions(prev => {
      const stepVersions = prev[currentStepId].map(v => 
        v.id === activeVId ? { ...v, platforms: newPlats } : v
      )
      return { ...prev, [currentStepId]: stepVersions }
    })
  }

  /**
   * Çalışma anında Prompt Source değişimi
   */
  const handlePromptSourceChange = (val: string) => {
    if(!activeWorkflow) return
    
    const currentStepId = activeWorkflow.steps[currentStepIdx].id
    const activeVId = activeVersionIds[currentStepId]
    const currentVersions = executionVersions[currentStepId]
    const activeVersion = currentVersions.find(v => v.id === activeVId)
    if(!activeVersion) return
    
    // Sadece kaynağı değiştiriyoruz, metni aşağıda duruma göre dolduracağız.
    const updatedVersion = { ...activeVersion, prompt_source: val as any }
    
    if(val === 'ai_optimize') {
      if(!activeVersion.prompt_text.trim()) {
        alert("Lütfen optimize etmek için önce bir prompt yazın veya seçin!")
        updatedVersion.prompt_source = 'manual'
      } else {
        // AI Optimized yazısını eklemeden, doğrudan temiz prompt
        updatedVersion.prompt_text = activeVersion.prompt_text + "\n\nFormat the output using clear markdown structure and bullet points."
      }
    } else if (val === 'all_prompts') {
      setShowAllPromptsModal(true)
    } else if (val === 'favorite') {
      setShowFavoritesModal(true)
    }
    
    setExecutionVersions(prev => ({
      ...prev,
      [currentStepId]: prev[currentStepId].map(v => v.id === activeVId ? updatedVersion : v)
    }))
  }

  /**
   * Execution Modal'larından prompt seçildiğinde
   */
  const handleSelectPromptForExecution = (promptText: string, source: 'all_prompts'|'favorite') => {
    if(!activeWorkflow) return
    const currentStepId = activeWorkflow.steps[currentStepIdx].id
    const activeVId = activeVersionIds[currentStepId]
    
    setExecutionVersions(prev => {
      const stepVersions = prev[currentStepId].map(v => 
        v.id === activeVId ? { ...v, prompt_text: promptText, prompt_source: source } : v
      )
      return { ...prev, [currentStepId]: stepVersions }
    })
    
    setShowAllPromptsModal(false)
    setShowFavoritesModal(false)
    setModalSearchQuery('')
  }

  const handleNextWorkflowStep = () => {
    if (!activeWorkflow) return
    
    if (currentStepIdx < activeWorkflow.steps.length - 1) {
      setCurrentStepIdx(prev => prev + 1)
    } else {
      setWorkflowStatus('completed')
    }
  }

  // ============================================================================
  // WORKFLOW COMPLETED EKRANI AKSİYONLARI & DIŞA AKTARMA (CSV)
  // ============================================================================
  
  const saveAllWorkflowAssets = () => {
    if(!activeWorkflow) return
    let newPromptsCount = 0
    let newOutputsCount = 0
    
    const newPrompts: Prompt[] = []
    const newOutputs: Output[] = []

    activeWorkflow.steps.forEach(step => {
      const iters = executionVersions[step.id] || []
      iters.forEach(iter => {
        // Promtpu kaydet
        const pId = `wf-p-${Date.now()}-${Math.random()}`
        newPrompts.push({
          id: pId,
          title: `${activeWorkflow.title} - ${iter.title}`,
          description: iter.goal,
          content: iter.prompt_text,
          platforms: iter.platforms,
          category: 'Other',
          use_count: 0,
          created_at: new Date().toISOString(),
          collection_id: null,
          is_favorite: false,
          is_pinned: false,
          deleted_at: null
        })
        newPromptsCount++
        
        // Output boş değilse kaydet
        if(iter.output_text.trim()) {
          newOutputs.push({
            id: `wf-o-${Date.now()}-${Math.random()}`,
            prompt_id: pId,
            content: iter.output_text,
            format: 'other',
            platform: iter.platforms[0] || 'chatgpt',
            notes: `Auto-saved from workflow execution`,
            metrics: {},
            created_at: new Date().toISOString(),
            is_pinned: false,
            deleted_at: null
          })
          newOutputsCount++
        }
      })
    })

    setPrompts(prev => [...newPrompts, ...prev])
    setOutputs(prev => [...newOutputs, ...prev])
    alert(`Başarıyla ${newPromptsCount} prompt ve ${newOutputsCount} çıktı kütüphanenize kaydedildi.`)
  }

  /**
   * Tamamen Düzeltilmiş Profesyonel CSV Dışa Aktarma
   */
  const copyAllWorkflowOutputs = () => {
    if(!activeWorkflow) return
    let combined = `Workflow: ${activeWorkflow.title}\n\n`
    activeWorkflow.steps.forEach(step => {
      const iters = executionVersions[step.id] || []
      const finalIter = iters[iters.length - 1]
      if(finalIter && finalIter.output_text.trim()) {
        combined += `--- Step ${step.number}: ${step.title} ---\n${finalIter.output_text}\n\n`
      }
    })
    navigator.clipboard.writeText(combined)
    alert("All outputs copied to clipboard successfully!")
  }

  /**
   * Generate Unified Prompt Hazırlığı (Düzeltilmiş ve Eksiksiz)
   */
  const prepareUnifiedPrompt = () => {
    if(!activeWorkflow) return
    
    let combinedP = ''
    let combinedO = ''
    let allPlats = new Set<string>()

    activeWorkflow.steps.forEach(step => {
      const iters = executionVersions[step.id] || []
      if(iters.length > 0) {
        // En son/aktif olan iterasyonu baz alalım
        const activeIdForStep = activeVersionIds[step.id]
        const targetIter = iters.find(i => i.id === activeIdForStep) || iters[iters.length - 1]
        
        combinedP += `### [Step ${step.number}: ${step.title}]\n**Goal:** ${targetIter.goal}\n\n${targetIter.prompt_text}\n\n---\n\n`
        
        if (targetIter.output_text.trim()) {
           combinedO += `### [Step ${step.number} Output: ${targetIter.platforms.join(', ')}]\n${targetIter.output_text}\n\n---\n\n`
        }
        
        targetIter.platforms.forEach(p => allPlats.add(p))
      }
    })

    setUnifiedForm({
      title: `Unified Master Prompt: ${activeWorkflow.title}`,
      description: `Auto-generated master prompt covering all steps of the workflow.`,
      platforms: Array.from(allPlats),
      combinedPrompt: combinedP.trim(),
      combinedOutput: combinedO.trim()
    })
    
    setNav('unified-prompt')
  }

  const saveUnifiedPrompt = () => {
    if(!unifiedForm.title.trim() || !unifiedForm.combinedPrompt.trim()) {
      alert("Title and Prompt are required.")
      return
    }

    const pId = `uni-p-${Date.now()}`
    
    const newPrompt: Prompt = {
      id: pId,
      title: unifiedForm.title,
      description: unifiedForm.description,
      content: unifiedForm.combinedPrompt,
      platforms: unifiedForm.platforms.length > 0 ? unifiedForm.platforms : ['chatgpt'],
      category: 'General',
      use_count: 0,
      created_at: new Date().toISOString(),
      collection_id: null,
      is_favorite: true,
      is_pinned: true,
      deleted_at: null
    }

    const newOutput: Output = {
      id: `uni-o-${Date.now()}`,
      prompt_id: pId,
      content: unifiedForm.combinedOutput,
      format: 'other',
      platform: unifiedForm.platforms[0] || 'chatgpt',
      notes: 'Generated via Unified Workflow Engine',
      metrics: {},
      created_at: new Date().toISOString(),
      is_pinned: true,
      deleted_at: null
    }

    setPrompts(prev => [newPrompt, ...prev])
    if(unifiedForm.combinedOutput.trim()) {
      setOutputs(prev => [newOutput, ...prev])
    }
    
    alert("Unified Prompt & Outputs successfully generated and saved!")
    setNav('all')
  }

  // ============================================================================
  // ANA LİSTE FİLTRELEME VE SIRALAMA (PIN MANTIĞI EKLENDİ)
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
  
  /**
   * Sabitlenmiş (Pinned) öğeleri listenin en üstüne alır.
   */
  const sortPinnedFirst = (items: any[]) => {
    return [...items].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1
      if (!a.is_pinned && b.is_pinned) return 1
      return 0
    })
  }
  
  const displayPrompts = searchResults !== null ? searchResults : sortPinnedFirst(filteredPrompts)
  
  // Çıktılarda Arama (Outputs tabındayken)
  const displayOutputs = useMemo(() => {
    let base = sortPinnedFirst(activeOutputs)
    if (activeView === 'outputs' && searchQuery.trim().length > 2) {
       const lower = searchQuery.toLowerCase()
       base = base.filter(o => o.content.toLowerCase().includes(lower) || o.notes?.toLowerCase().includes(lower) || getPlatformLabel(o.platform).toLowerCase().includes(lower))
    }
    return base
  }, [activeOutputs, activeView, searchQuery])

  // Çöpte Arama (Trash tabındayken)
  const displayTrashed = useMemo(() => {
    if (activeView === 'trash' && searchQuery.trim().length > 2) {
       const lower = searchQuery.toLowerCase()
       return trashedItems.filter(item => {
         if (item.type === 'prompt') {
           const p = item as Prompt
           return p.title.toLowerCase().includes(lower) || p.content.toLowerCase().includes(lower)
         } else {
           const o = item as Output
           return o.content.toLowerCase().includes(lower)
         }
       })
    }
    return trashedItems
  }, [trashedItems, activeView, searchQuery])

  // Workflowlarda Arama (Workflows tabındayken)
  const displayWorkflows = useMemo(() => {
    if (activeView === 'workflows' && searchQuery.trim().length > 2) {
       const lower = searchQuery.toLowerCase()
       return workflows.filter(w => w.title.toLowerCase().includes(lower) || w.description.toLowerCase().includes(lower))
    }
    return workflows
  }, [workflows, activeView, searchQuery])


  const totalPrompts = activePrompts.length
  const totalFavorites = activePrompts.filter(p => p.is_favorite).length

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060609] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    )
  }

  // Mevcut çalışan step ve versiyonu kolay almak için değişkenler (Execution Engine)
  const currentStep = activeWorkflow ? activeWorkflow.steps[currentStepIdx] : null
  const currentVersions = currentStep ? (executionVersions[currentStep.id] || []) : []
  const activeVersionId = currentStep ? activeVersionIds[currentStep.id] : null
  const activeVersion = currentVersions.find(v => v.id === activeVersionId)

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

        <div className={`flex-1 overflow-y-auto p-4 space-y-8 ${scrollbarClasses}`}>
          
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

          {/* RESOURCES */}
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
                 activeView === 'unified-prompt' ? 'Unified Master Prompt Generator' :
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
            
            {(activeView !== 'trash' && activeView !== 'analytics' && activeView !== 'workflows' && activeView !== 'workflow-execution' && activeView !== 'unified-prompt') && (
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
                className={`flex items-center gap-2 text-white text-[13px] font-medium px-5 py-2.5 rounded-xl transition-all ${activeView === 'outputs' ? 'bg-pink-600 hover:bg-pink-500 shadow-[0_0_20px_-5px_rgba(236,72,153,0.4)]' : 'bg-violet-600 hover:bg-violet-500 shadow-[0_0_20px_-5px_rgba(139,92,246,0.4)]'}`}
              >
                <Plus className="w-4 h-4" /> 
                {activeView === 'outputs' ? 'Smart Magic Paste' : 'New Prompt'}
              </button>
            )}
          </div>
        </header>

        {/* SEARCH BAR (TÜM LİSTE GÖRÜNÜMLERİ İÇİN YENİDEN TASARLANDI) */}
        {(activeView !== 'analytics' && activeView !== 'workflow-execution' && activeView !== 'unified-prompt') && (
          <div className="px-10 pt-8 pb-2 shrink-0">
            <div className="relative max-w-2xl group mx-auto md:mx-0">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 group-focus-within:bg-violet-500/20 group-focus-within:text-violet-300 transition-colors z-10">
                <Search className="w-5 h-5" />
              </div>
              <Input 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder={`Search in ${activeView === 'outputs' ? 'Saved Outputs' : activeView === 'trash' ? 'Trash' : activeView === 'workflows' ? 'Workflows' : 'Prompts'}...`} 
                className="w-full bg-[#0A0A0F]/90 backdrop-blur-md border border-white/10 rounded-2xl pl-16 pr-12 py-8 text-[15px] text-white placeholder-slate-500 shadow-xl focus-visible:ring-2 focus-visible:ring-violet-500/50 hover:border-white/20 transition-all" 
              />
              {isSearching && (
                 <div className="absolute right-6 top-1/2 -translate-y-1/2">
                   <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                 </div>
              )}
            </div>
          </div>
        )}

        <div className={`flex-1 p-10 pt-6 overflow-y-auto relative ${scrollbarClasses}`}>
          
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

          {/* ============================================================================ */}
          {/* VIEW: 1. UNIFIED PROMPT GENERATOR                                            */}
          {/* ============================================================================ */}
          {activeView === 'unified-prompt' ? (
            <div className="relative z-10 w-full max-w-5xl mx-auto space-y-6 pb-10">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Unified Master Prompt</h2>
                <p className="text-slate-400">Workflow boyunca üretilen her şeyi tek bir optimize prompta dönüştürün.</p>
              </div>

              <div className="bg-[#0A0A0F]/80 border border-white/5 rounded-3xl p-8 shadow-2xl">
                <div className="space-y-6">
                  <div>
                    <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Title</label>
                    <Input value={unifiedForm.title} onChange={e=>setUnifiedForm(f=>({...f, title: e.target.value}))} className="bg-black/40 border-white/10 text-white" />
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Description</label>
                    <Input value={unifiedForm.description} onChange={e=>setUnifiedForm(f=>({...f, description: e.target.value}))} className="bg-black/40 border-white/10 text-white" />
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Target Platforms</label>
                    <div className="flex gap-2">
                      {unifiedForm.platforms.map(p => (
                        <span key={p} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border flex items-center gap-1.5 ${getPlatformStyle(p)}`}>
                          <div className={`w-2 h-2 rounded-full ${getPlatformDotColor(p)}`} />
                          {getPlatformLabel(p)}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Unified Prompt Content</label>
                    <div className="relative group">
                      <Textarea value={unifiedForm.combinedPrompt} onChange={e=>setUnifiedForm(f=>({...f, combinedPrompt: e.target.value}))} className={`w-full min-h-[350px] bg-black/40 border-white/10 text-slate-300 resize-y p-6 pb-20 focus-visible:ring-1 focus-visible:ring-violet-500/50 ${scrollbarClasses}`} />
                      <div className="absolute bottom-4 left-4">
                        <button onClick={(e) => copyToClipboard(unifiedForm.combinedPrompt, 'uni-p', e)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[12px] font-medium flex items-center gap-1.5 backdrop-blur-md">
                          {copiedId === 'uni-p' ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />} Copy Prompt
                        </button>
                      </div>
                      <div className="absolute bottom-4 right-4 flex gap-2">
                        {unifiedForm.platforms.map(p => {
                          const platObj = PLATFORMS.find(pl => pl.value === p)
                          if(!platObj || p === 'other') return null
                          return (
                            <button key={p} onClick={() => window.open(platObj.url, '_blank')} className={`px-4 py-2 ${platObj.bg} hover:opacity-80 rounded-lg text-[12px] font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-md border`}>
                              <ExternalLink className="w-3.5 h-3.5" /> Open {platObj.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-white/5 mt-8">
                    <label className="text-[12px] font-semibold text-pink-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Library className="w-4 h-4"/> Save Output Section</label>
                    <p className="text-[12px] text-slate-500 mb-4">Workflow boyunca üretilen tüm çıktılar burada toplanmıştır.</p>
                    <Textarea value={unifiedForm.combinedOutput} onChange={e=>setUnifiedForm(f=>({...f, combinedOutput: e.target.value}))} className={`w-full min-h-[350px] bg-black/40 border-pink-500/20 text-slate-300 resize-y p-6 focus-visible:ring-1 focus-visible:ring-pink-500/50 ${scrollbarClasses}`} />
                  </div>
                </div>
                
                <div className="mt-8 pt-8 border-t border-white/5 flex justify-end gap-4">
                  <button onClick={() => setNav('workflows')} className="px-8 py-4 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-colors font-medium">Cancel</button>
                  <button onClick={saveUnifiedPrompt} className="px-8 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold flex items-center gap-2 shadow-[0_0_20px_-5px_rgba(139,92,246,0.5)]"><Database className="w-5 h-5" /> Generate & Save All</button>
                </div>
              </div>
            </div>

          // ============================================================================
          // VIEW: 2. WORKFLOW EXECUTION (Bağımsız Versiyonlarla Çalışma)                               
          // ============================================================================
          ) : activeView === 'workflow-execution' && activeWorkflow ? (
            <div className="relative z-10 w-full max-w-[1400px] mx-auto h-full min-h-[700px] flex gap-6 pb-10">
              
              {/* WORKFLOW TAMAMLANDI EKRANI */}
              {workflowStatus === 'completed' ? (<div className="w-full h-[120vh] min-h-[700px] bg-[#0A0A0F]/90 backdrop-blur-lg border border-indigo-500/20 rounded-3xl p-6 lg:p-8 flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
                
                  <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[150px] rounded-full pointer-events-none"/>
                  <div className="absolute bottom-0 left-0 w-96 h-96 bg-green-500/10 blur-[150px] rounded-full pointer-events-none"/>
                  
                  <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mb-8 mt-6 border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.3)] shrink-0">
                    <CheckCircle className="w-12 h-12 text-green-400" />
                  </div>
                  <h2 className="text-4xl font-bold text-white mb-4">Workflow Completed!</h2>
                  <p className="text-slate-400 mb-8 max-w-lg">Great job! You have successfully completed the entire flow. Now you can review, delete, or save the generated outputs.</p>
                  
                  {/* Üretilen Çıktılar Listesi */}
                  <div className="w-full max-w-5xl mt-2 text-left flex flex-col flex-1 min-h-0">
  <h3 className="text-[16px] font-bold text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2 shrink-0"><Database className="w-5 h-5"/> Generated Outputs</h3>
  
  <div className={`bg-black/40 rounded-2xl border border-white/5 p-8 w-full flex-1 overflow-y-auto ${scrollbarClasses}`}>
                      <div className="space-y-8">
                      {activeWorkflow.steps.map(step => {
                        const iters = executionVersions[step.id] || []
                        if(iters.length === 0) return null
                        return (
                          <div key={step.id} className="border border-white/5 rounded-2xl p-6 bg-[#0A0A0F] shadow-lg relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500/30"></div>
                            <h4 className="text-[15px] font-bold text-white mb-5 flex items-center gap-2">
                              <span className="bg-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-md text-[11px] uppercase">Step {step.number}</span>
                              {step.title}
                            </h4>
                            <div className="space-y-4 pl-2">
                              {iters.map(iter => (
                                <div key={iter.id} className="flex items-center justify-between bg-black/60 p-4 rounded-xl border border-white/5 hover:border-white/20 transition-colors group">
                                  <div>
                                    <span className="text-[14px] font-bold text-slate-200 block mb-1">{iter.title}</span>
                                    <div className="flex gap-2">
                                       <span className="text-[11px] text-slate-500 bg-white/5 px-2 py-0.5 rounded">Platform: {iter.platforms.join(', ')}</span>
                                       {iter.output_text.trim() ? (
                                         <span className="text-[11px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded flex items-center gap-1"><Check className="w-3 h-3"/> Output Saved</span>
                                       ) : (
                                         <span className="text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded flex items-center gap-1"><AlertCircle className="w-3 h-3"/> No Output</span>
                                       )}
                                    </div>
                                  </div>
                                  
                                  {/* Görüntüle Butonu: İlgili step ve versiyonu aktif edip çalışma ekranına geri döner */}
                                  <button 
                                    onClick={() => {
                                      const sIdx = activeWorkflow.steps.findIndex(s => s.id === step.id)
                                      if(sIdx !== -1) {
                                        setCurrentStepIdx(sIdx)
                                        setActiveVersionIds(prev => ({...prev, [step.id]: iter.id}))
                                        setWorkflowStatus('running')
                                      }
                                    }} 
                                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[12px] font-bold flex items-center gap-2 transition-colors border border-white/10"
                                  >
                                    <Edit3 className="w-4 h-4"/> Görüntüle
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  </div>

                  <div className="mt-4 flex flex-wrap justify-center gap-4 w-full max-w-5xl border-t border-white/10 pt-6 pb-2 shrink-0">
                    <button onClick={saveAllWorkflowAssets} className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[14px] font-bold transition-all shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)] flex items-center justify-center gap-2"><Save className="w-5 h-5"/> Save All Assets</button>
                    <button onClick={copyAllWorkflowOutputs} className="flex-1 py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl text-[14px] font-bold transition-all shadow-[0_0_20px_-5px_rgba(34,197,94,0.5)] flex items-center justify-center gap-2"><Copy className="w-5 h-5"/> Copy All Outputs</button>
                    <button onClick={prepareUnifiedPrompt} className="flex-1 py-4 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-[14px] font-bold transition-all shadow-[0_0_20px_-5px_rgba(236,72,153,0.5)] flex items-center justify-center gap-2"><Wand2 className="w-5 h-5"/> Generate Unified Prompt</button>
                  </div>
                </div>
              ) : activeVersion ? (
                // AKTİF ÇALIŞMA EKRANI (STEP / VERSİYON)
                <>
                  <div className="flex-1 bg-[#0A0A0F]/90 backdrop-blur-lg border border-white/5 rounded-3xl flex flex-col overflow-hidden shadow-2xl relative">
                    <div className="p-8 border-b border-white/5 bg-gradient-to-r from-[#060609] to-[#0A0A0F]">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-indigo-400 text-[12px] font-bold uppercase tracking-wider bg-indigo-500/10 px-3 py-1 rounded-md">
                          Step {currentStepIdx + 1} of {activeWorkflow.steps.length}
                        </span>
                        <span className="text-slate-500 text-[13px] flex items-center gap-2">
                          {activeWorkflow.title} <ChevronRight className="w-3 h-3" /> {activeVersion.title}
                        </span>
                      </div>
                      <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                        {currentStep?.title}
                      </h2>
                    </div>
                    
                    <div className={`flex-1 overflow-y-auto p-8 space-y-8 ${scrollbarClasses}`}>
                      
                      {/* EDİT EDİLEBİLİR GOAL VE PLATFORMS ALANI */}
                      <div className="grid grid-cols-2 gap-6">
                        <div className="bg-black/40 border border-white/5 rounded-2xl p-6 shadow-inner">
                          <h4 className="text-[12px] font-bold text-slate-500 uppercase mb-3 tracking-wider flex items-center gap-2"><Edit2 className="w-3.5 h-3.5"/> Goal (Editable)</h4>
                          <Textarea 
                            value={activeVersion.goal} 
                            onChange={(e) => handleExecutionGoalChange(e.target.value)}
                            className={`bg-transparent border-white/10 text-[14px] text-slate-300 px-3 focus-visible:ring-1 focus-visible:ring-indigo-500/50 min-h-[100px] resize-y ${scrollbarClasses}`} 
                            placeholder="What do you want to achieve in this version?"
                          />
                        </div>
                        <div className="bg-black/40 border border-white/5 rounded-2xl p-6 shadow-inner">
                          <h4 className="text-[12px] font-bold text-slate-500 uppercase mb-4 tracking-wider flex items-center gap-2"><Layers className="w-3.5 h-3.5"/> Target Platforms (Editable)</h4>
                          <div className="flex items-center gap-2 flex-wrap mb-4 min-h-[30px]">
                            {activeVersion.platforms.map(p => (
                              <span key={p} className={`px-2.5 py-1.5 rounded-lg text-[12px] font-bold border flex items-center gap-1.5 ${getPlatformStyle(p)} shadow-md`}>
                                <div className={`w-2 h-2 rounded-full ${getPlatformDotColor(p)}`} />
                                {getPlatformLabel(p)}
                                <button onClick={() => {
                                   if(activeVersion.platforms.length > 1) {
                                      handleExecutionPlatformsChange(activeVersion.platforms.filter(plat => plat !== p));
                                   }
                                }} className="ml-1"><XCircle className="w-3.5 h-3.5 hover:opacity-70"/></button>
                              </span>
                            ))}
                          </div>
                          <Select onValueChange={(v) => {
                             if(!activeVersion.platforms.includes(v)) {
                               handleExecutionPlatformsChange([...activeVersion.platforms, v])
                             }
                          }}>
                            <SelectTrigger className="bg-[#060609] border-white/10 h-10 text-[13px] font-medium"><SelectValue placeholder="Add Platform..."/></SelectTrigger>
                            <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200"><MenuItems items={PLATFORMS}/></SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* PROMPT ALANI */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-[13px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <LayoutGrid className="w-4 h-4"/> Prompt Source
                          </h4>
                          <div className="flex items-center gap-2">
                             {(activeVersion.prompt_source === 'all_prompts' || activeVersion.prompt_source === 'favorite') && (
                               <button 
                                 onClick={() => activeVersion.prompt_source === 'all_prompts' ? setShowAllPromptsModal(true) : setShowFavoritesModal(true)}
                                 className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-bold text-white flex items-center gap-1.5 transition-colors border border-white/10"
                               >
                                 <FolderOpen className="w-3 h-3"/> Change Prompt
                               </button>
                             )}
                             <Select 
                               value={activeVersion.prompt_source} 
                               onValueChange={handlePromptSourceChange}
                             >
                               <SelectTrigger className="w-56 bg-[#060609] border-white/10 text-[12px] h-9 font-medium">
                                 <SelectValue />
                               </SelectTrigger>
                               <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200 text-[12px]">
                                 <SelectItem value="manual" className="cursor-pointer">Write Manually</SelectItem>
                                 <SelectItem value="all_prompts" className="cursor-pointer">Select from All Prompts</SelectItem>
                                 <SelectItem value="ai_optimize" className="cursor-pointer text-violet-400 font-bold">Use AI Optimize</SelectItem>
                                 <SelectItem value="favorite" className="cursor-pointer text-amber-400 font-bold">Use Favorite Prompt</SelectItem>
                               </SelectContent>
                             </Select>
                          </div>
                        </div>
                        
                        <div className="bg-[#060609] border border-white/10 rounded-2xl p-1 relative shadow-inner">
                          <Textarea 
                            value={activeVersion.prompt_text} 
                            onChange={(e) => handleExecutionPromptChange(e.target.value)}
                            placeholder="Type or paste your prompt here..."
                            className={`text-[15px] text-slate-300 bg-black/40 border-none resize-y focus-visible:ring-1 focus-visible:ring-indigo-500/50 min-h-[250px] p-6 pb-20 rounded-xl ${scrollbarClasses}`}
                          />
                          
                          {/* Copy Butonu (Sol Alt) */}
                          <div className="absolute bottom-5 left-7">
                            <button 
                              onClick={(e) => copyToClipboard(activeVersion.prompt_text, `exec-p-${activeVersion.id}`, e)} 
                              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[12px] font-medium flex items-center gap-1.5 backdrop-blur-md transition-all border border-white/5"
                            >
                              {copiedId === `exec-p-${activeVersion.id}` ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />} Copy Prompt
                            </button>
                          </div>
                          
                          {/* Target Platform Linkleri (Sağ Alt) */}
                          <div className="absolute bottom-5 right-7 flex gap-2">
                            {activeVersion.platforms.map(p => {
                              const platObj = PLATFORMS.find(pl => pl.value === p)
                              if(!platObj || p === 'other') return null
                              return (
                                <button 
                                  key={p} 
                                  onClick={() => window.open(platObj.url, '_blank')} 
                                  className={`px-4 py-2 ${platObj.bg} hover:opacity-80 rounded-lg text-[12px] font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-md border`}
                                >
                                  <ExternalLink className="w-3.5 h-3.5" /> Open {platObj.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>

                      {/* OUTPUT ALANI (Tek ve Temiz) */}
                      <div className="mt-10 pt-10 border-t border-white/5">
                         <h4 className="text-[13px] font-bold text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                           <ArrowDown className="w-4 h-4" /> Save Output
                         </h4>
                         <p className="text-[12px] text-slate-500 mb-4">Paste the result you got from the AI platform here. It will be automatically saved to this version.</p>
                         <Textarea 
                           value={activeVersion.output_text}
                           onChange={(e) => handleExecutionOutputChange(e.target.value)}
                           placeholder="Paste AI response here to save as a new version..." 
                           className={`w-full min-h-[300px] bg-black/40 border border-indigo-500/20 rounded-2xl p-6 text-[14px] text-slate-300 resize-y focus-visible:ring-1 focus-visible:ring-indigo-500/50 mb-4 shadow-inner ${scrollbarClasses}`} 
                         />
                      </div>

                    </div>
                    
                    <div className="p-6 border-t border-white/5 bg-[#060609] flex items-center justify-between shrink-0">
                      <button 
                        onClick={() => { if(currentStepIdx > 0) setCurrentStepIdx(c => c - 1) }} 
                        disabled={currentStepIdx === 0} 
                        className="text-slate-500 hover:text-white disabled:opacity-50 text-[13px] font-medium transition-colors"
                      >
                        Previous Step
                      </button>
                      
                      <div className="flex gap-4">
                        {/* Aktif versiyon için opsiyonel manuel kaydetme (Görsel rahatlama) */}
                        <button 
                          onClick={() => alert('Bu versiyondaki değişiklikler otomatik olarak hafızaya alındı.')} 
                          className="px-6 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[14px] font-bold transition-all flex items-center gap-2 border border-white/10"
                        >
                          <Save className="w-4 h-4" /> Save & Update Version
                        </button>
                        
                        <button 
                          onClick={handleNextWorkflowStep} 
                          className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[14px] font-bold transition-all flex items-center gap-2 shadow-[0_0_15px_-3px_rgba(99,102,241,0.5)]"
                        >
                          {currentStepIdx < activeWorkflow.steps.length - 1 ? 'Continue to Next Step' : 'Finish Workflow'} 
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* SIDEBAR FOR PROGRESS & VERSIONS */}
                  <div className="w-[300px] flex flex-col gap-6 shrink-0 h-full overflow-hidden">
                    <div className={`bg-[#0A0A0F]/90 backdrop-blur-md border border-white/5 rounded-3xl p-6 shadow-2xl h-full flex flex-col`}>
                      <h3 className="text-[14px] font-bold text-white uppercase tracking-wider mb-8 flex items-center gap-2 shrink-0">
                        <Activity className="w-4 h-4 text-indigo-400" /> Workflow & Versions
                      </h3>
                      
                      <div className={`flex-1 overflow-y-auto pr-3 relative ${scrollbarClasses}`}>
                        <div className="absolute top-3 bottom-0 left-[7px] w-[2px] bg-white/10 z-0"></div>
                        
                        <div className="space-y-10 relative z-10">
                          {activeWorkflow.steps.map((step, idx) => {
                            const isCompleted = idx < currentStepIdx
                            const isActive = idx === currentStepIdx
                            const stepVersions = executionVersions[step.id] || []
                            
                            return (
                              <div key={step.id} className="relative flex flex-col gap-4">
                                
                                {/* Step Header */}
                                <div className="flex items-center gap-4">
                                  <div className={`w-4 h-4 rounded-full shrink-0 ${isCompleted ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : isActive ? 'bg-indigo-500 ring-4 ring-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-slate-700'}`}></div>
                                  <h4 className={`text-[15px] font-bold ${isCompleted ? 'text-slate-300' : isActive ? 'text-indigo-400' : 'text-slate-500'}`}>
                                    Step {idx+1}: {step.title}
                                  </h4>
                                </div>
                                
                                {/* Step Versions List (Bağımsız Versiyonlar) */}
                                <div className="pl-8 space-y-3 w-full">
                                  {stepVersions.map(ver => {
                                    const isVerActive = activeVersionIds[step.id] === ver.id
                                    return (
                                      <div 
                                        key={ver.id} 
                                        onClick={() => {
                                          setCurrentStepIdx(idx)
                                          setActiveVersionIds(prev => ({...prev, [step.id]: ver.id}))
                                        }}
                                        className={`p-4 rounded-xl border cursor-pointer transition-all ${isVerActive ? 'bg-indigo-500/10 border-indigo-500/50 shadow-md' : 'bg-black/60 border-white/5 hover:border-white/20'}`}
                                      >
                                        <div className="flex items-center justify-between mb-2">
  <span className={`text-[13px] font-bold ${isVerActive ? 'text-indigo-300' : 'text-slate-300'}`}>{ver.title}</span>
  <div className="flex items-center gap-2">
    {isVerActive && <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_5px_rgba(99,102,241,0.8)]" title="Active"></span>}
    <button onClick={(e) => { 
      e.stopPropagation(); 
      if(stepVersions.length <= 1) { alert("You cannot delete the only version of this step."); return; }
      if(window.confirm("Are you sure you want to delete this version?")) {
        setExecutionVersions(prev => ({...prev, [step.id]: prev[step.id].filter(v => v.id !== ver.id)}));
        if(isVerActive) {
          const remaining = stepVersions.filter(v => v.id !== ver.id);
          setActiveVersionIds(prev => ({...prev, [step.id]: remaining[remaining.length - 1].id}));
        }
      }
    }} className="text-slate-500 hover:text-red-400 transition-colors p-1" title="Delete Version">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
</div>
                                        <p className="text-[11px] text-slate-500 truncate mb-2">Plat: {ver.platforms.join(', ')}</p>
                                        {ver.output_text.trim() ? (
                                          <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded font-semibold inline-block">Has Output</span>
                                        ) : (
                                          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded font-semibold inline-block">Empty Output</span>
                                        )}
                                      </div>
                                    )
                                  })}
                                  
                                  {/* Generate Butonu (Yeni Versiyon Üret) */}
                                  <button 
                                    onClick={() => generateNewStepVersion(step.id, step)}
                                    className="w-full py-3 mt-2 border border-dashed border-white/20 rounded-xl text-[12px] font-bold text-slate-400 hover:text-white hover:bg-white/5 hover:border-white/40 transition-all flex items-center justify-center gap-2"
                                  >
                                    <Plus className="w-4 h-4"/> Generate New Version
                                  </button>
                                </div>

                              </div>
                            )
                          })}
                        </div>
                      </div>
                      
                      {/* Direkt Workflow Completed'a Geçiş */}
                      <div className="pt-6 border-t border-white/5 mt-4 shrink-0">
                         <button 
                           onClick={() => setWorkflowStatus('completed')}
                           className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-[13px] font-bold shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 transition-all"
                         >
                           🏁 Go to Workflow Completed
                         </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
            
          // ============================================================================
          // VIEW: 3. WORKFLOWS LİSTESİ
          // ============================================================================
          ) : activeView === 'workflows' ? (
            <div className="relative z-10 w-full max-w-5xl mx-auto space-y-10 pb-10">
              <div className="grid grid-cols-1 gap-6">
                {displayWorkflows.length === 0 ? (
                  <div className="text-center py-20 bg-[#0A0A0F]/50 rounded-3xl border border-white/5">
                     <Workflow className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                     <p className="text-slate-400 font-medium">No workflows found matching your search.</p>
                  </div>
                  
                ) : workflows.filter(wf => wf.title.toLowerCase().includes(searchQuery.toLowerCase()) || wf.description.toLowerCase().includes(searchQuery.toLowerCase())).map(wf => (
                  <div key={wf.id} className="bg-[#0A0A0F]/80 p-8 rounded-3xl border border-white/5 shadow-2xl relative hover:border-indigo-500/30 transition-colors">
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
  <button onClick={() => { setWorkflowForm(wf); setShowWorkflowBuilder(true); }} className="bg-white/5 hover:bg-white/10 text-white px-5 py-3 rounded-xl flex items-center gap-2 text-[13px] font-semibold transition-all border border-transparent"><Edit2 className="w-4 h-4" /> Edit</button>
  <button onClick={() => { if(window.confirm("Are you sure you want to delete this workflow?")) setWorkflows(prev => prev.filter(w=>w.id!==wf.id)) }} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-5 py-3 rounded-xl flex items-center gap-2 text-[13px] font-semibold transition-all border border-transparent"><Trash2 className="w-4 h-4" /> Delete</button>
  <button onClick={() => startWorkflow(wf)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl flex items-center gap-2 text-[14px] font-bold transition-all shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]"><Play className="w-4 h-4 fill-current" /> Run Workflow</button>
</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          // ============================================================================
          // VIEW: 4. OUTPUTS / SAVED OUTPUTS
          // ============================================================================
          ) : activeView === 'outputs' ? (
            displayOutputs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center relative z-10">
                <div className="w-20 h-20 rounded-3xl bg-pink-500/5 border border-pink-500/10 flex items-center justify-center mb-6 shadow-inner">
                  <Library className="w-10 h-10 text-pink-400/50" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">No Outputs Found</h2>
                <p className="text-[14px] text-slate-500 max-w-md mb-6">Use Smart Magic Paste to archive your best AI outputs directly from the chat.</p>
                <button 
                  onClick={() => setShowAddOutput(true)} 
                  className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-[13px] font-medium transition-colors border border-white/10"
                >
                  Smart Magic Paste
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative z-10 pb-10">
                {displayOutputs.map((output, idx) => {
                  const linkedPrompt = output.prompt_id ? activePrompts.find(p => p.id === output.prompt_id) : null;
                  
                  const handleDragEnd = () => {
    setDraggedPromptIdx(null)
    setDraggedOutputIdx(null)
    setDraggedStepIdx(null)
  }

                  return (
                  <div 
                    key={output.id} 
                    draggable={true} 
                    onDragStart={(e) => onDragStart(e, idx, 'output')} 
                    onDragOver={onDragOver}
                    onDrop={(e) => onDrop(e, idx, 'output')} 
                    onDragEnd={handleDragEnd} 
                    onClick={() => setViewingOutput(output)} 
                    className={`cursor-pointer group flex flex-col bg-[#0A0A0F]/80 backdrop-blur-sm border border-white/5 rounded-3xl p-6 h-[300px] hover:border-pink-500/40 transition-all duration-300 shadow-xl hover:shadow-[0_0_30px_-5px_rgba(236,72,153,0.15)] relative ${draggedOutputIdx === idx ? 'opacity-30 border-dashed border-pink-500 scale-95' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing mr-1">
                          <GripVertical className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                        </div>
                        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300 bg-white/10 px-3 py-1.5 rounded-lg border border-white/5 shadow-sm">
                          {getFormatIcon(output.format)} {output.format.replace('_', ' ')}
                        </span>
                        <span className={`w-3 h-3 rounded-full shadow-lg ${getPlatformDotColor(output.platform)}`} title={getPlatformLabel(output.platform)} />
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
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
                              onClick={(e) => openOutputEdit(output, e as any)} 
                              className="gap-2.5 cursor-pointer hover:bg-white/10 py-2.5 text-[12px] font-medium"
                            >
                              <Edit2 className="h-4 w-4 text-slate-400" /> Edit Output
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/5 my-1" />
                            <DropdownMenuItem 
                              onClick={(e) => handleMoveToTrash(output.id, 'output', e as any)} 
                              className="gap-2.5 cursor-pointer text-red-400 focus:text-red-400 hover:bg-red-500/10 py-2.5 text-[12px] font-medium"
                            >
                              <Trash2 className="h-4 w-4" /> Move to Trash
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    
                    <div className="relative flex-1 overflow-hidden mb-4">
                      <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words text-slate-300 font-serif">{output.content}</p>
                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0A0A0F] to-transparent pointer-events-none group-hover:from-[#0c0c14] transition-colors duration-300" />
                    </div>
                    
                    <div className="flex items-center gap-3 mt-auto pt-4 border-t border-white/5">
                      {linkedPrompt ? (
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Linked Prompt</span>
                          <p className="text-[12px] text-pink-400 font-medium truncate group-hover:text-pink-300 transition-colors">{linkedPrompt.title}</p>
                        </div>
                      ) : (
                        <div className="flex flex-col flex-1">
                          <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider mb-0.5">Linked Prompt</span>
                          <p className="text-[12px] text-slate-600 italic">No linked prompt</p>
                        </div>
                      )}
                      
                      <button 
                        onClick={(e) => copyToClipboard(output.content, output.id, e)} 
                        className="ml-auto flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 hover:bg-pink-500/20 hover:text-pink-300 text-slate-400 transition-all border border-transparent hover:border-pink-500/30 shrink-0 shadow-sm"
                      >
                        {copiedId === output.id ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                )})}
              </div>
            )

          // ============================================================================
          // VIEW: 5. TRASH
          // ============================================================================
          ) : activeView === 'trash' ? (
             <div className="relative z-10 w-full max-w-5xl mx-auto pb-10">
               {displayTrashed.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-[400px] text-center bg-[#0A0A0F]/50 border border-white/5 rounded-3xl">
                    <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-6 shadow-inner">
                      <Trash2 className="w-8 h-8 text-slate-500" />
                    </div>
                    <p className="text-white text-[18px] font-bold">Trash is empty</p>
                    <p className="text-slate-500 text-[14px] mt-2">Items you delete will appear here.</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                   {displayTrashed.map(item => (
                     <div key={item.id} className="flex flex-col bg-red-950/20 border border-red-500/20 rounded-3xl p-6 h-[280px] shadow-lg group relative hover:border-red-500/40 transition-colors">
                       <div className="flex items-start justify-between gap-4 mb-4">
                         <h3 className="text-[15px] font-bold line-clamp-2 text-slate-400 line-through decoration-red-500/50 flex-1">
                           {item.type === 'prompt' ? (item as Prompt).title : 'Output Content'}
                         </h3>
                         <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                           <button 
                             onClick={(e) => handleRestoreFromTrash(item.id, item.type as any, e)} 
                             className="p-2.5 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors shadow-sm"
                             title="Restore"
                           >
                             <RefreshCw className="w-4 h-4" />
                           </button>
                           <button 
                             onClick={(e) => handlePermanentDelete(item.id, item.type as any, e)} 
                             className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors shadow-sm"
                             title="Delete Permanently"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>
                       </div>
                       <div className="relative flex-1 overflow-hidden mb-4">
                         <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-slate-500">{item.content}</p>
                         <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0A0A0F]/90 to-transparent pointer-events-none transition-colors duration-300" />
                       </div>
                       <div className="pt-3 border-t border-red-500/10 text-[11px] font-bold text-red-900/50 uppercase tracking-wider">
                         Type: {item.type}
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>

          // ============================================================================
          // VIEW: 6. ANALYTICS
          // ============================================================================
          ) : activeView === 'analytics' ? (
             <div className="relative z-10 max-w-5xl mx-auto space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="bg-[#0A0A0F]/80 border border-white/5 p-8 rounded-3xl flex items-center gap-6 shadow-xl">
                   <div className="w-16 h-16 rounded-2xl bg-violet-500/10 text-violet-400 flex items-center justify-center border border-violet-500/20 shadow-inner">
                     <LayoutGrid className="w-7 h-7" />
                   </div>
                   <div>
                     <p className="text-slate-400 text-[14px] font-bold uppercase tracking-wider mb-1">Total Prompts</p>
                     <h3 className="text-4xl font-black text-white">{totalPrompts}</h3>
                   </div>
                 </div>
                 <div className="bg-[#0A0A0F]/80 border border-white/5 p-8 rounded-3xl flex items-center gap-6 shadow-xl">
                   <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-inner">
                     <Star className="w-7 h-7" />
                   </div>
                   <div>
                     <p className="text-slate-400 text-[14px] font-bold uppercase tracking-wider mb-1">Favorites</p>
                     <h3 className="text-4xl font-black text-white">{totalFavorites}</h3>
                   </div>
                 </div>
                 <div className="bg-[#0A0A0F]/80 border border-white/5 p-8 rounded-3xl flex items-center gap-6 shadow-xl">
                   <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-inner">
                     <Folder className="w-7 h-7" />
                   </div>
                   <div>
                     <p className="text-slate-400 text-[14px] font-bold uppercase tracking-wider mb-1">Collections</p>
                     <h3 className="text-4xl font-black text-white">{collections.length}</h3>
                   </div>
                 </div>
               </div>
             </div>
             
          // ============================================================================
          // VIEW: 7. PROMPTS GRID (ANA EKRAN)
          // ============================================================================
          ) : displayPrompts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center relative z-10 bg-[#0A0A0F]/50 border border-white/5 rounded-3xl">
              <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-6 shadow-inner">
                <Search className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-white text-[18px] font-bold">No prompts found</p>
              <p className="text-slate-500 text-[14px] mt-2 max-w-sm">Try adjusting your search query or create a new prompt using the button above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative z-10 pb-10">
              {displayPrompts.map((prompt, index) => (
                <div 
                  key={prompt.id} 
                  draggable={activeView === 'all' || activeView === 'collection' || activeView === 'favorites' || activeView === 'recent'} 
                  onDragStart={(e) => onDragStart(e, index, 'prompt')} 
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, index, 'prompt')} 
                  onDragEnd={onDragEnd} 
                  onClick={() => openWorkspace(prompt)} 
                  className={`group cursor-pointer flex flex-col backdrop-blur-sm border rounded-3xl p-6 transition-all duration-300 h-[300px] shadow-xl relative ${draggedPromptIdx === index ? 'opacity-30 border-dashed border-violet-500 scale-95' : ''} bg-[#0A0A0F]/80 border-white/5 hover:border-violet-500/40 hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.15)]`}
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    
                    {(activeView === 'all' || activeView === 'collection') && (
                      <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                        <GripVertical className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[16px] font-bold leading-snug truncate text-slate-100 group-hover:text-violet-300 transition-colors">
                        {prompt.title}
                      </h3>
                      {prompt.description && <p className="text-[12px] text-slate-500 truncate mt-1.5 font-medium">{prompt.description}</p>}
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        onClick={(e) => togglePinPrompt(prompt, e)} 
                        className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-white/10 transition-all outline-none text-slate-500 hover:text-blue-400 opacity-0 group-hover:opacity-100"
                      >
                        <Pin className={`h-4 w-4 ${prompt.is_pinned ? 'fill-blue-400 text-blue-400 opacity-100' : ''}`} />
                      </button>
                      <button 
                        onClick={(e) => toggleFavorite(prompt, e)} 
                        className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-white/10 transition-all outline-none text-slate-500 hover:text-amber-400 opacity-0 group-hover:opacity-100"
                      >
                        <Star className={`h-4 w-4 ${prompt.is_favorite ? 'fill-amber-400 text-amber-400 opacity-100' : ''}`} />
                      </button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button 
                            onClick={(e) => e.stopPropagation()} 
                            className="h-8 w-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all outline-none"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-[#1A1A28] border-white/10 text-slate-200 rounded-2xl shadow-2xl p-1">
                          <DropdownMenuItem 
                            onClick={(e) => handleMoveToTrash(prompt.id, 'prompt', e as any)} 
                            className="gap-2.5 cursor-pointer text-red-400 focus:text-red-400 hover:bg-red-500/10 py-2.5 font-medium"
                          >
                            <Trash2 className="h-4 w-4" /> Move to Trash
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  
                  <div className="relative flex-1 overflow-hidden mb-4">
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words text-slate-400 font-serif">{prompt.content}</p>
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0A0A0F] to-transparent pointer-events-none group-hover:from-[#0c0c14] transition-colors duration-300" />
                  </div>
                  
                  <div className="flex items-center gap-3 mt-auto pt-4 border-t border-white/5">
                    
                    {/* MULTI PLATFORM DOTS */}
                    <div className="flex -space-x-2">
                      {prompt.platforms.slice(0,3).map((p: string) => (
                         <span 
                           key={p} 
                           className={`w-7 h-7 rounded-full border-2 border-[#0A0A0F] flex items-center justify-center text-[9px] font-bold uppercase shadow-md ${getPlatformStyle(p)}`} 
                           title={getPlatformLabel(p)}
                         >
                           {p.substring(0,1)}
                         </span>
                      ))}
                      {prompt.platforms.length > 3 && (
                        <span className="w-7 h-7 rounded-full border-2 border-[#0A0A0F] bg-white/10 flex items-center justify-center text-[9px] font-bold text-slate-300 shadow-md">
                          +{prompt.platforms.length - 3}
                        </span>
                      )}
                    </div>
                    
                    <span className="text-[11px] bg-white/10 border border-white/5 px-3 py-1.5 rounded-lg text-slate-300 ml-1 font-semibold shadow-sm">
                      {prompt.category}
                    </span>
                    
                    <button 
                      onClick={(e) => copyToClipboard(prompt.content, prompt.id, e)} 
                      className="ml-auto flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 hover:bg-violet-500/20 hover:text-violet-300 text-slate-400 transition-all border border-transparent hover:border-violet-500/30 shrink-0 shadow-sm"
                    >
                      {copiedId === prompt.id ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
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

      {/* SELECT FROM ALL PROMPTS MODAL (DEV EKRAN 95vw, 95vh) */}
      <Dialog open={showAllPromptsModal} onOpenChange={setShowAllPromptsModal}>
        <DialogContent className="bg-[#0A0A0F] border-white/10 rounded-3xl sm:max-w-[95vw] w-[95vw] h-[95vh] shadow-2xl p-0 gap-0 overflow-hidden text-white flex flex-col [&>button]:hidden">
          <div className="p-8 border-b border-white/5 bg-[#060609] flex justify-between items-center shrink-0">
            <div>
              <DialogTitle className="text-[22px] font-bold flex items-center gap-3"><LayoutGrid className="w-6 h-6 text-violet-400"/> Select Prompt from Library</DialogTitle>
              <p className="text-slate-400 text-[14px] mt-1">Choose a base prompt to inject into your workflow execution.</p>
            </div>
            <button onClick={() => setShowAllPromptsModal(false)} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"><XCircle className="w-6 h-6 text-slate-400 hover:text-white" /></button>
          </div>
          
          <div className="p-8 bg-[#0A0A0F] border-b border-white/5 shrink-0 relative z-10">
            <div className="relative max-w-3xl mx-auto">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <Input 
                value={modalSearchQuery}
                onChange={e => setModalSearchQuery(e.target.value)}
                placeholder="Search across all your prompts..."
                className="w-full bg-[#060609] border-white/10 rounded-2xl pl-14 pr-6 py-7 text-[15px] text-white focus-visible:ring-2 focus-visible:ring-violet-500/50 transition-all shadow-inner"
              />
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto p-10 bg-[#060609] ${scrollbarClasses}`}>
            {modalFilteredPrompts.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-slate-500 font-medium text-[16px]">No prompts found matching your search.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {modalFilteredPrompts.map(p => (
                  <div key={p.id} onClick={() => handleSelectPromptForExecution(p.content, 'all_prompts')} className="bg-[#0A0A0F]/80 border border-white/5 rounded-2xl p-6 hover:border-violet-500/50 hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.15)] cursor-pointer transition-all group flex flex-col h-[250px] relative overflow-hidden">
                    <div className="flex-1 min-w-0 mb-4 z-10">
                      <h4 className="text-[15px] font-bold text-white group-hover:text-violet-300 transition-colors mb-2 truncate">{p.title}</h4>
                      {p.description && <p className="text-[12px] text-slate-500 truncate mb-3">{p.description}</p>}
                      <p className="text-[13px] text-slate-400 line-clamp-4 leading-relaxed font-serif">{p.content}</p>
                    </div>
                    <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between z-10">
                      <span className="text-[10px] uppercase font-bold text-slate-500 bg-white/5 px-2.5 py-1 rounded-md">{p.category}</span>
                      <div className="flex -space-x-1.5">
                        {p.platforms.slice(0,3).map(plat => <span key={plat} className={`w-5 h-5 rounded-full border border-[#0A0A0F] flex items-center justify-center text-[7px] font-bold ${getPlatformStyle(plat)}`}>{plat.substring(0,1).toUpperCase()}</span>)}
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-violet-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"/>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* USE FAVORITE PROMPT MODAL (DEV EKRAN 95vw, 95vh) */}
      <Dialog open={showFavoritesModal} onOpenChange={setShowFavoritesModal}>
        <DialogContent className="bg-[#0A0A0F] border-white/10 rounded-3xl sm:max-w-[95vw] w-[95vw] h-[95vh] shadow-2xl p-0 gap-0 overflow-hidden text-white flex flex-col [&>button]:hidden">
          <div className="p-8 border-b border-white/5 bg-[#060609] flex justify-between items-center shrink-0">
            <div>
              <DialogTitle className="text-[22px] font-bold flex items-center gap-3"><Star className="w-6 h-6 text-amber-400"/> Select Favorite Prompt</DialogTitle>
              <p className="text-slate-400 text-[14px] mt-1">Choose from your starred templates.</p>
            </div>
            <button onClick={() => setShowFavoritesModal(false)} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"><XCircle className="w-6 h-6 text-slate-400 hover:text-white" /></button>
          </div>
          
          <div className="p-8 bg-[#0A0A0F] border-b border-white/5 shrink-0 relative z-10">
            <div className="relative max-w-3xl mx-auto">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <Input 
                value={modalSearchQuery}
                onChange={e => setModalSearchQuery(e.target.value)}
                placeholder="Search across favorites..."
                className="w-full bg-[#060609] border-white/10 rounded-2xl pl-14 pr-6 py-7 text-[15px] text-white focus-visible:ring-2 focus-visible:ring-amber-500/50 transition-all shadow-inner"
              />
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto p-10 bg-[#060609] ${scrollbarClasses}`}>
            {modalFilteredFavorites.length === 0 ? (
              <div className="text-center py-20">
                <Star className="w-12 h-12 text-slate-600 mx-auto mb-4"/>
                <p className="text-slate-500 font-medium text-[16px]">No favorite prompts found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {modalFilteredFavorites.map(p => (
                  <div key={p.id} onClick={() => handleSelectPromptForExecution(p.content, 'favorite')} className="bg-[#0A0A0F]/80 border border-white/5 rounded-2xl p-6 hover:border-amber-500/50 hover:shadow-[0_0_30px_-5px_rgba(245,158,11,0.15)] cursor-pointer transition-all group flex flex-col h-[250px] relative overflow-hidden">
                    <div className="flex-1 min-w-0 mb-4 z-10">
                      <h4 className="text-[15px] font-bold text-white group-hover:text-amber-300 transition-colors mb-2 truncate flex items-center gap-2"><Star className="w-4 h-4 fill-amber-400 text-amber-400"/> {p.title}</h4>
                      {p.description && <p className="text-[12px] text-slate-500 truncate mb-3">{p.description}</p>}
                      <p className="text-[13px] text-slate-400 line-clamp-4 leading-relaxed font-serif">{p.content}</p>
                    </div>
                    <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between z-10">
                      <span className="text-[10px] uppercase font-bold text-slate-500 bg-white/5 px-2.5 py-1 rounded-md">{p.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>


      {/* WORKFLOW BUILDER MODAL */}
      <Dialog open={showWorkflowBuilder} onOpenChange={(open) => setShowWorkflowBuilder(open)}>
        <DialogContent className="bg-[#0A0A0F] border-white/10 rounded-3xl sm:max-w-[95vw] w-[95vw] h-[95vh] shadow-2xl p-0 gap-0 overflow-hidden text-white flex flex-col [&>button]:hidden">
          <div className="flex items-center justify-between p-8 border-b border-white/5 bg-[#060609] shrink-0">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner">
                <Workflow className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <DialogTitle className="text-[22px] font-bold text-white tracking-tight">
                  Workflow Builder
                </DialogTitle>
                <p className="text-[14px] text-slate-400 mt-1">Design your automated AI pipeline step by step</p>
              </div>
            </div>
            <button 
              onClick={() => setShowWorkflowBuilder(false)} 
              className="text-slate-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-3 rounded-xl flex items-center gap-2 text-[14px] font-bold"
            >
              <XCircle className="w-5 h-5" /> Close Builder
            </button>
          </div>
          
          <div className={`flex-1 overflow-y-auto p-10 bg-[#0A0A0F] space-y-10 ${scrollbarClasses}`}>
            <div className="grid grid-cols-2 gap-10 bg-black/40 p-8 rounded-3xl border border-white/5">
              <div>
                <label className="text-[13px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">
                  Workflow Title
                </label>
                <Input 
                  value={workflowForm.title} 
                  onChange={e => setWorkflowForm(prev => ({...prev, title: e.target.value}))} 
                  className="bg-[#0A0A0F] border-white/10 text-white h-14 text-[16px] font-semibold focus-visible:ring-2 focus-visible:ring-indigo-500/50" 
                  placeholder="Enter a descriptive title..."
                />
              </div>
              <div>
                <label className="text-[13px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">
                  Description
                </label>
                <Input 
                  value={workflowForm.description} 
                  onChange={e => setWorkflowForm(prev => ({...prev, description: e.target.value}))} 
                  className="bg-[#0A0A0F] border-white/10 text-white h-14 text-[15px] focus-visible:ring-2 focus-visible:ring-indigo-500/50" 
                  placeholder="What does this workflow do?"
                />
              </div>
            </div>
            
            <div className="pt-4">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-[18px] font-bold text-white flex items-center gap-3">
                  <Layers className="w-6 h-6 text-indigo-400" /> Workflow Steps 
                  <span className="text-[12px] font-normal text-slate-500 bg-white/5 px-3 py-1 rounded-full">(Drag from handle to reorder)</span>
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
                      }
                    ]
                  }))} 
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[14px] font-bold flex items-center gap-2 border border-white/10 shadow-sm transition-colors"
                >
                  <Plus className="w-5 h-5" /> Add Step
                </button>
              </div>
              
              <div className="space-y-6 relative">
                {workflowForm.steps.map((step, sIdx) => (
                  <div 
                    key={step.id} 
                    draggable={true}
                    onDragStart={(e) => onDragStart(e, sIdx, 'step')}
                    onDragOver={onDragOver}
                    onDrop={(e) => onDrop(e, sIdx, 'step')}
                    onDragEnd={onDragEnd}
                    className={`bg-[#060609] border border-white/5 rounded-3xl p-8 relative group transition-all shadow-lg ${draggedStepIdx === sIdx ? 'opacity-30 border-dashed border-indigo-500 scale-[0.98]' : 'hover:border-indigo-500/30 hover:shadow-indigo-500/10'}`}
                  >
                    
                    {/* Sürükle Bırak Tutamacı */}
                    <div className="absolute left-[-20px] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-lg z-10 transition-opacity">
                      <GripVertical className="w-5 h-5 text-indigo-400" />
                    </div>

                    <button 
                      onClick={() => setWorkflowForm(prev => { 
                        const n = {...prev}
                        n.steps.splice(sIdx, 1)
                        n.steps.forEach((s, i) => s.number = i + 1)
                        return n 
                      })} 
                      className="absolute top-6 right-6 text-red-400 hover:text-red-300 p-2.5 bg-red-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete Step"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    
                    <div className="flex items-center gap-5 mb-8 border-b border-white/5 pb-6">
                      <span className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-black text-[16px] shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                        {sIdx+1}
                      </span>
                      <Input 
                        value={step.title} 
                        onChange={e => { 
                          const n = {...workflowForm}
                          n.steps[sIdx].title = e.target.value
                          setWorkflowForm(n) 
                        }} 
                        placeholder="Step Name (e.g. Research Phase)" 
                        className="max-w-md bg-black/40 border-white/10 text-white font-bold text-[18px] h-12 focus-visible:ring-2 focus-visible:ring-indigo-500/50" 
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div>
                        <label className="text-[12px] text-slate-400 uppercase mb-3 block font-bold tracking-wider">Goal</label>
                        {/* Goal kutusu Textarea'ya çevrildi ve büyütüldü */}
                        <Textarea 
                          value={step.goal} 
                          onChange={e => { 
                            const n = {...workflowForm}
                            n.steps[sIdx].goal = e.target.value
                            setWorkflowForm(n) 
                          }} 
                          placeholder="Describe the objective of this step in detail..."
                          className={`bg-black/40 border-white/10 text-white text-[14px] min-h-[120px] resize-y p-5 focus-visible:ring-1 focus-visible:ring-indigo-500/50 ${scrollbarClasses}`} 
                        />
                      </div>
                      <div>
                        <label className="text-[12px] text-slate-400 uppercase mb-3 block font-bold tracking-wider">Default Platforms</label>
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-5 min-h-[120px]">
                          <div className="flex items-center gap-2 flex-wrap mb-4">
                             {step.platforms.map(p => {
                               if(p === 'other') return null
                               return (
                               <span key={p} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border flex items-center gap-1.5 shadow-sm ${getPlatformStyle(p)}`}>
                                 <div className={`w-2 h-2 rounded-full ${getPlatformDotColor(p)}`} />
                                 {getPlatformLabel(p)}
                                 <button onClick={() => {
                                    const n = {...workflowForm};
                                    if(n.steps[sIdx].platforms.length > 1) {
                                       n.steps[sIdx].platforms = n.steps[sIdx].platforms.filter(plat => plat !== p);
                                       setWorkflowForm(n);
                                    }
                                 }}><XCircle className="w-3.5 h-3.5 hover:opacity-70 ml-1"/></button>
                               </span>
                             )})}
                          </div>
                          <Select 
                            onValueChange={v => { 
                              const n = {...workflowForm}
                              if(!n.steps[sIdx].platforms.includes(v)) {
                                 n.steps[sIdx].platforms.push(v)
                              }
                              setWorkflowForm(n) 
                            }}
                          >
                            <SelectTrigger className="bg-[#060609] border-white/10 text-white text-[13px] h-12 w-full font-medium">
                              <SelectValue placeholder="Add another platform..." />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200">
                              <MenuItems items={PLATFORMS} />
                            </SelectContent>
                          </Select>
                          
                          {/* Other seçildiyse manual platform girme kutusu (Builder ekranında) */}
                          {step.platforms.includes('other') && (
                            <Input 
                              placeholder="Type custom platform name..."
                              className="bg-[#060609] border-white/10 text-white text-[13px] mt-3 h-12 w-full"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="p-8 border-t border-white/5 bg-[#060609] flex gap-5 shrink-0 justify-end">
            <button 
              onClick={() => setShowWorkflowBuilder(false)} 
              className="px-8 py-4 rounded-xl border border-white/10 text-[15px] font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={saveWorkflowBuilder} 
              className="px-10 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-[15px] font-bold text-white flex items-center gap-2 shadow-[0_0_20px_-5px_rgba(99,102,241,0.6)] transition-all"
            >
              <CheckCircle2 className="w-5 h-5" /> Save Workflow
            </button>
          </div>
        </DialogContent>
      </Dialog>


      {/* ÇIKTI GÖRÜNTÜLEME MODALI (SPLIT VIEW) */}
      <Dialog open={!!viewingOutput} onOpenChange={(open) => { if(!open) setViewingOutput(null) }}>
        <DialogContent className="bg-[#0A0A0F] border-white/10 rounded-3xl sm:max-w-[85vw] lg:max-w-[1200px] w-[95vw] h-[85vh] shadow-2xl p-0 gap-0 overflow-hidden text-white flex flex-col [&>button]:hidden">
          <div className="flex items-center justify-between p-8 border-b border-white/5 bg-[#111118] shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-400 flex items-center justify-center border border-pink-500/20 shadow-inner">
                {viewingOutput ? getFormatIcon(viewingOutput.format) : <Library className="w-6 h-6" />}
              </div>
              <div>
                <DialogTitle className="text-[20px] font-bold text-white capitalize tracking-tight">
                  {viewingOutput?.format.replace('_', ' ')} Output
                </DialogTitle>
                <p className="text-[13px] text-slate-400 mt-0.5">
                  Generated via {viewingOutput && getPlatformLabel(viewingOutput.platform)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                   if(viewingOutput) {
                      openOutputEdit(viewingOutput);
                      setViewingOutput(null);
                   }
                }} 
                className="text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-5 py-3 rounded-xl transition-colors flex items-center gap-2 text-[13px] font-bold border border-white/10"
              >
                <Edit2 className="w-4 h-4" /> Edit Output
              </button>
              <button 
                onClick={() => viewingOutput && handleMoveToTrash(viewingOutput.id, 'output')} 
                className="text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500 p-3 rounded-xl transition-colors border border-red-500/10"
                title="Move to Trash"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setViewingOutput(null)} 
                className="text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 p-3 rounded-xl transition-colors"
                title="Close"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#060609]">
            <div className={`w-full lg:w-[35%] bg-[#0A0A0F]/50 border-b lg:border-b-0 lg:border-r border-white/5 p-10 overflow-y-auto space-y-10 ${scrollbarClasses}`}>
              
              {viewingOutput?.prompt_id && activePrompts.find(p => p.id === viewingOutput.prompt_id) ? (
                <div>
                  <h4 className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4 text-pink-400" /> Parent Prompt</h4>
                  <div className="bg-black/40 border border-white/10 rounded-2xl p-6 cursor-pointer hover:border-pink-500/40 transition-colors shadow-lg group" onClick={() => openWorkspace(activePrompts.find(p => p.id === viewingOutput.prompt_id)!)}>
                    <h5 className="text-[15px] font-bold text-slate-200 mb-2 group-hover:text-pink-300 transition-colors">{activePrompts.find(p => p.id === viewingOutput.prompt_id)?.title}</h5>
                    <p className="text-[13px] text-slate-500 line-clamp-5 leading-relaxed">{activePrompts.find(p => p.id === viewingOutput.prompt_id)?.content}</p>
                    <div className="mt-4 pt-4 border-t border-white/5 flex justify-end">
                       <span className="text-[10px] bg-pink-500/10 text-pink-400 px-2 py-1 rounded font-bold uppercase">Click to open workspace</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 border border-white/10 border-dashed rounded-2xl p-8 text-center">
                  <p className="text-[14px] text-slate-500 font-medium">No prompt linked to this output.</p>
                </div>
              )}

              {viewingOutput?.notes && (
                <div>
                  <h4 className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><BookOpen className="w-4 h-4"/> Notes / Context</h4>
                  <p className="text-[14px] text-slate-300 leading-relaxed p-6 bg-black/40 rounded-2xl border border-white/10 shadow-inner">{viewingOutput.notes}</p>
                </div>
              )}
            </div>
            
            <div className="flex-1 flex flex-col relative h-full">
              <div className={`flex-1 p-12 overflow-y-auto ${scrollbarClasses}`}>
                <p className="text-[16px] text-slate-200 leading-[1.8] whitespace-pre-wrap font-serif">
                  {viewingOutput?.content}
                </p>
              </div>
              
              <div className="p-8 border-t border-white/5 bg-[#0A0A0F] flex justify-end">
                <button 
                  onClick={(e) => viewingOutput && copyToClipboard(viewingOutput.content, viewingOutput.id, e)} 
                  className="px-8 py-4 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold flex items-center gap-2 shadow-[0_0_20px_-5px_rgba(236,72,153,0.5)] transition-all"
                >
                  {copiedId === viewingOutput?.id ? <CheckCircle2 className="w-5 h-5"/> : <Copy className="w-5 h-5" />} Copy Content
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* SMART MAGIC PASTE MODAL (OUTPUT EKLEME/DÜZENLEME) */}
      <Dialog open={showAddOutput} onOpenChange={(open) => { if (!submitting) { setShowAddOutput(open); if (!open) { setPromptSearchQuery(''); setIsPromptDropdownOpen(false); setError(''); setEditingOutput(null); } } }}>
        <DialogContent className="bg-[#0A0A0F] border-white/10 rounded-3xl sm:max-w-[95vw] w-[95vw] h-[95vh] shadow-2xl p-0 gap-0 overflow-hidden text-white flex flex-col [&>button]:hidden">
          <div className="flex items-center justify-between p-8 border-b border-white/5 bg-[#060609] shrink-0">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shadow-inner">
                <Library className="w-7 h-7 text-pink-400" />
              </div>
              <div>
                <DialogTitle className="text-[22px] font-bold text-white tracking-tight">
                  {editingOutput ? 'Edit Saved Output' : 'Smart Magic Paste'}
                </DialogTitle>
                <p className="text-[14px] text-slate-400 mt-1">
                  {editingOutput ? 'Modify your archived generation' : 'Auto-extract prompt and output from raw chat logs'}
                </p>
              </div>
            </div>
            <button 
              onClick={() => setShowAddOutput(false)} 
              className="text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 p-3 rounded-xl flex items-center gap-2 text-[14px] font-bold transition-colors"
            >
              <XCircle className="w-5 h-5" /> Close
            </button>
          </div>
          
          <div className="flex-1 overflow-hidden bg-[#060609] grid grid-cols-1 lg:grid-cols-3 relative">
            <div className={`p-10 space-y-8 bg-[#0A0A0F]/80 overflow-y-auto h-full border-r border-white/5 relative z-20 ${scrollbarClasses}`}>
              
              {!editingOutput && (
                <div className="bg-gradient-to-b from-pink-500/10 to-violet-500/5 border border-pink-500/20 rounded-3xl p-1.5 shadow-xl">
                  <div className="bg-[#060609]/90 backdrop-blur-md rounded-2xl p-6 space-y-5">
                    <Textarea 
                      value={outputForm.magicPasteContent} 
                      onChange={e => setOutputForm(f => ({ ...f, magicPasteContent: e.target.value }))} 
                      placeholder="Paste your raw chat transcript here (including the AI's response)..." 
                      className={`w-full bg-black/60 border-white/10 rounded-xl p-4 text-[14px] text-slate-300 h-32 resize-y focus-visible:ring-2 focus-visible:ring-pink-500/50 ${scrollbarClasses}`} 
                    />
                    <button 
                      onClick={handleMagicPaste} 
                      disabled={isMagicPasting || !outputForm.magicPasteContent.trim()} 
                      className="w-full py-3.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-[14px] font-bold shadow-[0_0_15px_-3px_rgba(236,72,153,0.5)] transition-all disabled:opacity-50"
                    >
                      {isMagicPasting ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : 'Auto-Extract & Fill Content'}
                    </button>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[12px] font-bold text-slate-400 block mb-3 uppercase tracking-wider">Format</label>
                  <Select value={outputForm.format} onValueChange={(v) => setOutputForm(f => ({...f, format: v, customFormat: ''}))}>
                    <SelectTrigger className="bg-[#060609] border-white/10 text-[14px] h-12 font-medium">
                      <SelectValue/>
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200">
                      <MenuItems items={FORMATS.map(f=>({value:f,label:f.replace('_',' ')}))}/>
                    </SelectContent>
                  </Select>
                  {outputForm.format === 'other' && (
                    <Input 
                      value={outputForm.customFormat} 
                      onChange={e => setOutputForm(f => ({...f, customFormat: e.target.value}))} 
                      placeholder="Custom Format Name..." 
                      className="bg-[#060609] border-white/10 mt-3 h-12" 
                    />
                  )}
                </div>
                <div>
                  <label className="text-[12px] font-bold text-slate-400 block mb-3 uppercase tracking-wider">Platform</label>
                  <Select value={outputForm.platform} onValueChange={(v) => setOutputForm(f => ({...f, platform: v, customPlatform: ''}))}>
                    <SelectTrigger className="bg-[#060609] border-white/10 text-[14px] h-12 font-medium">
                      <SelectValue/>
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200">
                      <MenuItems items={PLATFORMS}/>
                    </SelectContent>
                  </Select>
                  {outputForm.platform === 'other' && (
                    <Input 
                      value={outputForm.customPlatform} 
                      onChange={e => setOutputForm(f => ({...f, customPlatform: e.target.value}))} 
                      placeholder="Custom Platform Name..." 
                      className="bg-[#060609] border-white/10 mt-3 h-12" 
                    />
                  )}
                </div>
              </div>
              
              {/* Linked Prompt Search */}
              <div className="relative z-50">
                <label className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">Linked Prompt (Optional)</label>
                <div className="relative group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-pink-400 transition-colors z-10" />
                  <Input 
                    value={promptSearchQuery}
                    onChange={(e) => { setPromptSearchQuery(e.target.value); setIsPromptDropdownOpen(true); }}
                    onFocus={() => setIsPromptDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsPromptDropdownOpen(false), 250)}
                    placeholder="Search and link a parent prompt..."
                    className="w-full bg-[#060609] border-white/10 rounded-2xl pl-14 pr-12 py-7 text-[14px] text-white shadow-inner focus-visible:ring-2 focus-visible:ring-pink-500/50 transition-all hover:border-white/20"
                  />
                  {outputForm.prompt_id && outputForm.prompt_id !== 'none' && (
                    <button onClick={() => { setOutputForm(f => ({...f, prompt_id: 'none'})); setPromptSearchQuery(''); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 p-1 rounded-md transition-colors"><XCircle className="w-5 h-5" /></button>
                  )}
                </div>

                {isPromptDropdownOpen && (
                  <div className={`absolute top-full mt-3 left-0 w-full bg-[#1A1A28] border border-white/10 rounded-2xl shadow-2xl max-h-72 overflow-y-auto py-2 z-50 ${scrollbarClasses}`}>
                    <div className="px-5 py-4 border-b border-white/5 text-[14px] text-slate-400 hover:bg-white/5 cursor-pointer flex items-center gap-2 font-medium" onClick={() => { setOutputForm(f => ({ ...f, prompt_id: 'none' })); setPromptSearchQuery(''); setIsPromptDropdownOpen(false); }}>
                      <XCircle className="w-4 h-4" /> Clear link (No parent prompt)
                    </div>
                    {filteredLinkPrompts.length > 0 ? filteredLinkPrompts.map(p => (
                        <div key={p.id} className="px-5 py-4 border-b border-white/5 last:border-0 hover:bg-white/5 cursor-pointer transition-colors group flex items-center justify-between" onClick={() => { setOutputForm(f => ({ ...f, prompt_id: p.id })); setPromptSearchQuery(p.title); setIsPromptDropdownOpen(false); }}>
                          <div className="flex-1 min-w-0 pr-4"><p className="text-[14px] text-slate-200 font-bold group-hover:text-pink-400 transition-colors truncate">{p.title}</p></div>
                          <span className="text-[10px] bg-[#060609] border border-white/10 text-slate-400 px-2.5 py-1 rounded-md shrink-0 uppercase tracking-wider font-bold shadow-sm">{p.platforms[0] || 'chatgpt'}</span>
                        </div>
                      )) : <div className="px-5 py-8 text-center text-slate-500 text-[14px] font-medium">No matching prompts found.</div>
                    }
                  </div>
                )}
                {outputForm.prompt_id !== 'none' && outputForm.prompt_id && (
                  <p className="text-[12px] text-green-400 mt-3 flex items-center gap-1.5 font-bold bg-green-500/10 p-2.5 rounded-lg border border-green-500/20"><CheckCircle2 className="w-4 h-4" /> Successfully linked to prompt</p>
                )}
              </div>

              <div className="relative z-0">
                <label className="text-[12px] font-bold text-slate-400 block mb-3 uppercase tracking-wider">Additional Notes</label>
                <Textarea 
                  value={outputForm.notes || ''} 
                  onChange={e => setOutputForm(f => ({...f, notes: e.target.value}))} 
                  className={`bg-[#060609] border-white/10 text-white min-h-[100px] text-[14px] p-4 resize-y focus-visible:ring-1 focus-visible:ring-pink-500/50 ${scrollbarClasses}`} 
                  placeholder="Any context or thoughts about this output..."
                />
              </div>
            </div>
            
            <div className="lg:col-span-2 flex flex-col h-full bg-[#060609] min-h-0">
              <div className="flex-1 px-8 pt-8 pb-8 min-h-0 flex flex-col">
                <Textarea 
                  value={outputForm.content} 
                  onChange={e => setOutputForm(f => ({ ...f, content: e.target.value }))} 
                  className={`w-full h-full bg-[#0A0A0F] border border-white/5 rounded-3xl p-10 text-[16px] text-slate-200 resize-none shadow-inner focus-visible:ring-2 focus-visible:ring-pink-500/50 font-serif leading-relaxed ${scrollbarClasses}`} 
                  placeholder="Paste your generated AI output content here..."
                />
              </div>
              <div className="p-8 border-t border-white/5 bg-[#0A0A0F] flex gap-5">
                <button 
                  onClick={() => setShowAddOutput(false)} 
                  className="px-8 py-4 rounded-xl border border-white/10 text-[15px] font-bold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveOutput} 
                  className="flex-1 py-4 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_-5px_rgba(236,72,153,0.5)] text-[15px] transition-all"
                >
                  <Save className="w-5 h-5"/> {editingOutput ? 'Save Modifications' : 'Save Output'}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* FULL WORKSPACE MODAL (PROMPT EKLEME/DÜZENLEME & ÇIKTI SEKME DESTEĞİ) */}
      <Dialog open={showAddPrompt} onOpenChange={(open) => { if (!submitting) { setShowAddPrompt(open); if(!open){ setEditingPrompt(null); setForm(emptyForm); setError(''); } } }}>
        <DialogContent className="bg-[#0A0A0F] border-white/10 rounded-3xl sm:max-w-[95vw] w-[95vw] h-[95vh] shadow-2xl p-0 gap-0 overflow-hidden text-white flex flex-col [&>button]:hidden">
          <div className="flex items-center justify-between p-8 border-b border-white/5 bg-[#060609] shrink-0">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shadow-inner">
                <LayoutGrid className="w-7 h-7 text-violet-400" />
              </div>
              <div>
                <DialogTitle className="text-[22px] font-bold text-white tracking-tight">
                  {editingPrompt ? 'Prompt Workspace' : 'Create New Prompt'}
                </DialogTitle>
                <p className="text-[14px] text-slate-400 mt-1">
                  {editingPrompt ? `Managing template: ${editingPrompt.title}` : 'Build your custom prompt template from scratch'}
                </p>
              </div>
            </div>
            
            {/* TABS */}
            <div className="flex items-center bg-black/50 p-1.5 rounded-2xl border border-white/5 shadow-inner">
              <button 
                onClick={() => setActiveTab('editor')} 
                className={`px-6 py-3 rounded-xl text-[14px] font-bold flex items-center gap-2 transition-all ${activeTab === 'editor' ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <Edit2 className="w-4 h-4" /> Prompt Editor
              </button>
              
              {editingPrompt && (
                <button 
                  onClick={() => setActiveTab('history')} 
                  className={`px-6 py-3 rounded-xl text-[14px] font-bold flex items-center gap-2 transition-all ${activeTab === 'history' ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <History className="w-4 h-4" /> Version History
                  <span className={`text-[11px] px-2 py-0.5 rounded-lg font-black ${activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-300'}`}>
                    {promptVersions.filter(v => !v.deleted_at).length}
                  </span>
                </button>
              )}
              
              {editingPrompt && (
                <button 
                  onClick={() => setActiveTab('outputs')} 
                  className={`px-6 py-3 rounded-xl text-[14px] font-bold flex items-center gap-2 transition-all ${activeTab === 'outputs' ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Library className="w-4 h-4" /> Saved Outputs
                  <span className={`text-[11px] px-2 py-0.5 rounded-lg font-black ${activeTab === 'outputs' ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-300'}`}>
                    {activeOutputs.filter(o => o.prompt_id === editingPrompt.id).length}
                  </span>
                </button>
              )}
            </div>
            
            <button 
              onClick={() => setShowAddPrompt(false)} 
              className="text-slate-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-3.5 rounded-xl flex items-center gap-2 text-[14px] font-bold"
            >
              <XCircle className="w-5 h-5" /> Close
            </button>
          </div>

          <div className="flex-1 overflow-hidden bg-[#060609]">
            {activeTab === 'editor' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 h-full overflow-hidden">
                <div className={`p-10 space-y-8 bg-[#0A0A0F]/80 overflow-y-auto h-full border-r border-white/5 relative ${scrollbarClasses}`}>
                  {error && (
                    <div className="flex items-center gap-3 text-[14px] font-medium text-red-400 bg-red-500/10 p-5 rounded-2xl border border-red-500/20 shadow-lg">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <p>{error}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-[12px] font-bold text-slate-400 uppercase block mb-3 tracking-wider">Title</label>
                    <Input 
                      value={form.title} 
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))} 
                      className="bg-[#060609] border-white/10 text-white h-14 text-[16px] font-semibold focus-visible:ring-2 focus-visible:ring-violet-500/50" 
                      placeholder="Enter a clear title for your prompt..."
                    />
                  </div>

                  <div>
                    <label className="text-[12px] font-bold text-slate-400 uppercase block mb-3 tracking-wider flex items-center gap-2">
                      Description <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-1 rounded border border-white/5">Optional</span>
                    </label>
                    <Textarea 
                      value={form.description} 
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
                      className={`bg-[#060609] border-white/10 text-white text-[14px] min-h-[100px] resize-y p-4 focus-visible:ring-1 focus-visible:ring-violet-500/50 ${scrollbarClasses}`} 
                      placeholder="Briefly explain what this prompt does..."
                    />
                  </div>

                  {/* COLLECTION SEÇİMİ GERİ GETİRİLDİ */}
                  <div>
                    <label className="text-[12px] font-bold text-slate-400 uppercase block mb-3 tracking-wider flex items-center gap-2">
                      <Folder className="w-4 h-4"/> Collection
                    </label>
                    <Select 
                      value={form.collection_id || 'none'} 
                      onValueChange={(v) => setForm(f => ({ ...f, collection_id: v }))}
                    >
                      <SelectTrigger className="bg-[#060609] border-white/10 text-white h-14 font-medium text-[14px]">
                        <SelectValue placeholder="Select a collection..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200">
                        <SelectItem value="none" className="italic text-slate-500">No Collection</SelectItem>
                        {collections.map(c => (
                          <SelectItem key={c.id} value={c.id} className="font-medium">{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* MULTI-SELECT PLATFORM ALANI */}
                  <div>
                    <label className="text-[12px] font-bold text-slate-400 uppercase block mb-4 tracking-wider">
                      Target Platforms (Multi-Select)
                    </label>
                    <div className="flex flex-wrap gap-3 bg-[#060609] border border-white/5 p-4 rounded-2xl shadow-inner">
                      {PLATFORMS.filter(p => p.value !== 'other').map(p => (
                        <button 
                          key={p.value} 
                          onClick={() => togglePlatformSelection(p.value)}
                          className={`px-4 py-2.5 rounded-xl text-[13px] font-bold border transition-all flex items-center gap-2 ${form.platforms.includes(p.value) ? getPlatformStyle(p.value) + ' ring-2 ring-white/10 shadow-lg' : 'bg-[#0A0A0F] text-slate-400 border-white/10 hover:border-white/30 hover:text-slate-200'}`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${getPlatformDotColor(p.value)}`} />
                          {p.label}
                        </button>
                      ))}
                      <button 
                        onClick={() => togglePlatformSelection('other')}
                        className={`px-4 py-2.5 rounded-xl text-[13px] font-bold border transition-all flex items-center gap-2 ${form.platforms.includes('other') ? getPlatformStyle('other') + ' ring-2 ring-white/10 shadow-lg' : 'bg-[#0A0A0F] text-slate-400 border-white/10 hover:border-white/30 hover:text-slate-200'}`}
                      >
                         <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${getPlatformDotColor('other')}`} />
                         Other
                      </button>
                    </div>
                    {form.platforms.includes('other') && (
                      <Input 
                        value={form.customPlatforms}
                        onChange={e => setForm(f => ({ ...f, customPlatforms: e.target.value }))}
                        placeholder="Type custom platform name..."
                        className="mt-4 bg-[#060609] border-white/10 text-white text-[14px] h-12"
                      />
                    )}
                  </div>
                  
                  <div>
                    <label className="text-[12px] font-bold text-slate-400 uppercase block mb-3 tracking-wider">Category</label>
                    <Select 
                      value={form.category} 
                      onValueChange={(v) => setForm(f => ({ ...f, category: v, customCategory: '' }))}
                    >
                      <SelectTrigger className="bg-[#060609] border-white/10 text-white h-14 font-medium text-[14px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1A1A28] border-white/10 text-slate-200">
                        <MenuItems items={CATEGORIES.map(c => ({value: c, label: c}))} />
                      </SelectContent>
                    </Select>
                    {form.category === 'Other' && (
                      <Input 
                        value={form.customCategory}
                        onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))}
                        placeholder="Type custom category name..."
                        className="mt-4 bg-[#060609] border-white/10 text-white text-[14px] h-12"
                      />
                    )}
                  </div>
                </div>
                
                <div className="lg:col-span-2 flex flex-col h-full bg-[#060609] min-h-0 overflow-hidden relative">
                  
                  {/* DIŞ BAĞLANTI BUTONLARI */}
                  <div className="absolute top-6 right-8 z-10 flex gap-3">
                    {form.platforms.map(platValue => {
                      const platObj = PLATFORMS.find(p => p.value === platValue)
                      if(!platObj || platObj.value === 'other') return null
                      return (
                        <button 
                          key={platValue} 
                          onClick={() => window.open(platObj.url, '_blank')} 
                          className={`px-5 py-2.5 ${platObj.bg} hover:opacity-80 rounded-xl text-[13px] font-bold transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(0,0,0,0.2)] backdrop-blur-md border border-white/10`}
                        >
                          <ExternalLink className="w-4 h-4" /> Open {platObj.label}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex-1 px-8 pt-8 pb-8 min-h-0 flex flex-col relative mt-16">
                    <Textarea 
                      value={form.content} 
                      onChange={e => setForm(f => ({ ...f, content: e.target.value }))} 
                      placeholder="Start typing your main prompt structure here..." 
                      className={`w-full h-full bg-[#0A0A0F] border border-white/5 rounded-3xl p-10 text-[16px] text-slate-200 resize-none shadow-inner focus-visible:ring-2 focus-visible:ring-violet-500/50 leading-relaxed font-serif ${scrollbarClasses}`} 
                    />
                  </div>
                  
                  <div className="p-8 border-t border-white/5 bg-[#0A0A0F] flex gap-5 shrink-0 justify-end">
                    <button 
                      disabled={submitting} 
                      onClick={() => setShowAddPrompt(false)} 
                      className="px-8 py-4 rounded-xl border border-white/10 text-[15px] font-bold text-slate-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    
                    <button 
                      onClick={triggerAIOptimize} 
                      className="px-8 py-4 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/30 text-[15px] font-bold flex items-center gap-2 hover:bg-violet-500/20 transition-all shadow-[0_0_15px_-3px_rgba(139,92,246,0.3)]"
                    >
                      <Wand2 className="w-5 h-5"/> Optimize with AI
                    </button>
                    
                    <button 
                      disabled={submitting} 
                      onClick={editingPrompt ? handleEditPrompt : handleAddPrompt} 
                      className="px-10 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_-5px_rgba(139,92,246,0.6)] text-[15px] transition-all"
                    >
                      <CheckCircle2 className="w-5 h-5" /> {editingPrompt ? 'Save Modifications' : 'Create Prompt'}
                    </button>
                  </div>
                </div>
              </div>
            ) : activeTab === 'history' ? (
              // VERSİYON GEÇMİŞİ (RESTORE VE TRASH EKLENDİ)
              <div className={`h-full overflow-y-auto p-12 bg-[#060609] ${scrollbarClasses}`}>
                <h3 className="text-[18px] font-bold text-white mb-8 flex items-center gap-3"><History className="w-6 h-6 text-violet-400"/> Prompt Version History</h3>
                
                {promptVersions.filter(v => !v.deleted_at).length === 0 ? (
                  <div className="text-center py-20 bg-[#0A0A0F]/50 border border-white/5 rounded-3xl">
                     <History className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                     <p className="text-slate-400 font-medium text-[16px]">No versions saved yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {promptVersions.filter(v => !v.deleted_at).map(v => (
                      <div key={v.id} className="bg-[#0A0A0F]/90 border border-white/5 rounded-3xl p-8 h-[380px] flex flex-col shadow-xl hover:border-violet-500/30 transition-all group relative overflow-hidden">
                        <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-4 shrink-0">
                          <span className="text-[14px] font-black text-violet-400 bg-violet-500/10 px-3 py-1.5 rounded-lg border border-violet-500/20">Version {v.version_num}</span>
                          
                          {/* YENİ EKLENEN: RESTORE VE TRASH BUTONLARI */}
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleRestoreFromTrash(v.id, 'version')} 
                              className="p-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg transition-colors border border-green-500/10"
                              title="Restore to Editor"
                            >
                              <Undo2 className="w-4 h-4"/>
                            </button>
                            <button 
                              onClick={() => handleMoveToTrash(v.id, 'version')} 
                              className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/10"
                              title="Move to Trash"
                            >
                              <Trash2 className="w-4 h-4"/>
                            </button>
                          </div>
                        </div>
                        <div className={`relative flex-1 overflow-y-auto ${scrollbarClasses} pr-2`}>
                          <p className="text-[14px] text-slate-300 leading-relaxed font-serif whitespace-pre-wrap">{v.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // SAVED OUTPUTS TAB İÇERİĞİ (PROMPT İÇİNDEN ÇIKTI EKLEME VE DÜZENLEME)
              <div className="flex h-full">
                <div className={`w-1/3 bg-[#0A0A0F]/50 border-r border-white/5 p-10 flex flex-col h-full overflow-y-auto ${scrollbarClasses}`}>
                  <h4 className="text-[16px] font-bold text-white mb-8 uppercase tracking-wider flex items-center gap-3">
                    <Plus className="w-5 h-5 text-pink-400"/> Add Output to this Prompt
                  </h4>
                  
                  <Textarea 
                    id="inlineOutputText" 
                    placeholder="Paste AI result here to attach it directly to this template..." 
                    className={`flex-1 bg-black/40 border-white/10 mb-8 text-[14px] resize-none focus-visible:ring-2 focus-visible:ring-pink-500/50 p-6 shadow-inner ${scrollbarClasses}`} 
                  />
                  
                  <label className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">
                    Source Platform
                  </label>
                  <Select 
                    defaultValue="chatgpt" 
                    onValueChange={(v) => { (window as any).tempPlat = v; }}
                  >
                    <SelectTrigger className="bg-[#060609] border-white/10 mb-8 h-14 text-[14px] font-medium">
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
                      } else {
                        alert("Please paste the output text first.")
                      }
                    }} 
                    className="w-full py-4 bg-pink-600 hover:bg-pink-500 rounded-xl text-white font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_-5px_rgba(236,72,153,0.5)] transition-all text-[15px]"
                  >
                    <Save className="w-5 h-5"/> Save Linked Output
                  </button>
                </div>
                
                <div className={`flex-1 p-12 overflow-y-auto bg-[#060609] ${scrollbarClasses}`}>
                   <h4 className="text-[20px] font-bold text-white mb-10 flex items-center gap-3">
                     <Library className="w-6 h-6 text-pink-400" /> Linked Outputs Archive
                   </h4>
                   
                   {activeOutputs.filter(o => o.prompt_id === editingPrompt?.id).length === 0 ? (
                     <div className="text-center py-24 border border-white/5 border-dashed rounded-3xl bg-black/20">
                       <p className="text-slate-500 text-[16px] font-medium">No outputs have been linked to this prompt yet.</p>
                     </div>
                   ) : (
                     <div className="grid grid-cols-2 gap-8">
                       {activeOutputs.filter(o => o.prompt_id === editingPrompt?.id).map(out => (
                         <div key={out.id} className="bg-[#0A0A0F]/90 border border-white/5 rounded-3xl p-8 group hover:border-pink-500/40 transition-all relative shadow-xl">
                           
                           <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button 
                               onClick={() => openOutputEdit(out)} 
                               className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors"
                               title="Edit Output"
                             >
                               <Edit2 className="w-4 h-4" />
                             </button>
                             <button 
                               onClick={() => handleMoveToTrash(out.id, 'output')} 
                               className="p-2.5 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-400 hover:text-red-300 transition-colors"
                               title="Delete Output"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                           </div>

                           <div className="flex items-center gap-2 mb-6">
                             <span className={`text-[11px] uppercase px-3 py-1.5 rounded-lg font-black border border-white/5 ${getPlatformStyle(out.platform)}`}>
                               {getPlatformLabel(out.platform)}
                             </span>
                           </div>
                           
                           <p className="text-[14px] text-slate-300 line-clamp-6 leading-relaxed font-serif">{out.content}</p>
                         </div>
                       ))}
                     </div>
                   )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI OPTIMIZE MODAL */}
      <Dialog open={showOptimizeModal} onOpenChange={setShowOptimizeModal}>
        <DialogContent className="bg-[#0A0A0F] border-white/10 rounded-3xl sm:max-w-[80vw] w-[80vw] h-[80vh] shadow-2xl p-0 gap-0 overflow-hidden text-white flex flex-col [&>button]:hidden">
          <div className="p-8 border-b border-white/5 bg-[#060609] flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shadow-inner">
                <Wand2 className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <DialogTitle className="text-[20px] font-bold">AI Prompt Optimization</DialogTitle>
                <p className="text-[13px] text-slate-400 mt-0.5">Enhance your prompt for better structural clarity and results.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowOptimizeModal(false)}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
            >
              <XCircle className="w-5 h-5 text-slate-400 hover:text-white" />
            </button>
          </div>
          
          <div className="flex-1 overflow-hidden relative bg-[#060609]">
            {isOptimizing ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-[#0A0A0F]/50 backdrop-blur-sm z-10">
                <div className="relative">
                   <div className="absolute inset-0 bg-violet-500/20 blur-xl rounded-full"></div>
                   <Loader2 className="w-16 h-16 text-violet-500 animate-spin relative z-10" />
                </div>
                <p className="text-[16px] text-violet-300 font-bold tracking-wide">Analyzing and rewriting your prompt...</p>
              </div>
            ) : optimizeResult ? (
              <div className="flex h-full p-10 gap-10">
                <div className="w-1/2 space-y-8 flex flex-col h-full">
                  <div>
                    <h4 className="text-[14px] font-bold text-slate-400 uppercase tracking-wider mb-4">Original Prompt</h4>
                    <div className={`p-6 bg-black/40 border border-white/5 rounded-3xl text-[14px] text-slate-300 whitespace-pre-wrap h-[300px] overflow-y-auto ${scrollbarClasses}`}>
                      {form.content}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-green-500/5 border border-green-500/20 p-6 rounded-3xl">
                      <h5 className="text-[13px] font-bold text-green-400 uppercase tracking-wider mb-3">Strengths</h5>
                      <ul className="list-disc pl-5 text-[13px] text-slate-300 space-y-2">
                        {optimizeResult.strengths.map(s => <li key={s}>{s}</li>)}
                      </ul>
                    </div>
                    <div className="bg-red-500/5 border border-red-500/20 p-6 rounded-3xl">
                      <h5 className="text-[13px] font-bold text-red-400 uppercase tracking-wider mb-3">Weaknesses</h5>
                      <ul className="list-disc pl-5 text-[13px] text-slate-300 space-y-2">
                        {optimizeResult.weaknesses.map(w => <li key={w}>{w}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="w-1/2 flex flex-col h-full border-l border-white/5 pl-10">
                  <h4 className="text-[15px] font-bold text-violet-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5"/> Optimized Prompt</h4>
                  <Textarea value={optimizeResult.improved_prompt} onChange={e => setOptimizeResult(prev => ({...prev!, improved_prompt: e.target.value}))} className={`flex-1 bg-violet-500/5 border border-violet-500/20 text-[15px] p-8 resize-none focus-visible:ring-2 focus-visible:ring-violet-500/50 rounded-3xl text-slate-200 leading-relaxed font-serif ${scrollbarClasses}`} />
                  <div className="mt-8 flex gap-5">
                    <button onClick={() => setShowOptimizeModal(false)} className="px-8 py-4 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-colors text-[15px] font-bold">Discard Changes</button>
                    <button onClick={acceptOptimization} className="flex-1 py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_-5px_rgba(139,92,246,0.5)] transition-all text-[15px]"><CheckCircle2 className="w-5 h-5"/> Replace Original Prompt</button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddCollection} onOpenChange={setShowAddCollection}>
        <DialogContent className="bg-[#111118] border-white/10 rounded-3xl w-full max-w-md shadow-2xl p-0 gap-0 text-white [&>button]:hidden">
          <div className="flex justify-between items-center p-8 border-b border-white/5">
            <DialogTitle className="text-[18px] font-bold flex items-center gap-3"><Folder className="w-6 h-6 text-violet-400"/> {editingCollection ? 'Edit Collection' : 'Create Collection'}</DialogTitle>
            <button onClick={() => setShowAddCollection(false)} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"><XCircle className="w-5 h-5 text-slate-500 hover:text-white"/></button>
          </div>
          <div className="p-8 space-y-8">
            <div>
              <label className="text-[13px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Collection Name</label>
              <Input value={collectionForm.name} onChange={e => setCollectionForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Sales & Marketing Prompts" className="bg-[#060609] border-white/10 h-14 text-[15px] focus-visible:ring-2 focus-visible:ring-violet-500/50" />
            </div>
            <div>
              <label className="text-[13px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Description (Optional)</label>
              <Input value={collectionForm.description} onChange={e => setCollectionForm(f => ({...f, description: e.target.value}))} placeholder="What is this collection for?" className="bg-[#060609] border-white/10 h-14 text-[15px] focus-visible:ring-2 focus-visible:ring-violet-500/50" />
            </div>
          </div>
          <div className="p-8 border-t border-white/5 flex gap-4">
            <button onClick={() => setShowAddCollection(false)} className="flex-1 py-4 border border-white/10 hover:bg-white/5 rounded-xl text-[15px] font-bold transition-colors">Cancel</button>
            <button onClick={handleSaveCollection} disabled={submitting || !collectionForm.name.trim()} className="flex-1 py-4 bg-violet-600 hover:bg-violet-500 rounded-xl font-bold transition-colors disabled:opacity-50 text-[15px] shadow-[0_0_15px_-3px_rgba(139,92,246,0.5)]">Save Collection</button>
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
        <SelectItem key={i.value} value={i.value} className="cursor-pointer font-bold hover:bg-white/5 text-[13px] py-2.5">
          {i.label}
        </SelectItem>
      ))}
    </>
  )
}