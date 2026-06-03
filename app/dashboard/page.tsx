'use client'

import React, { useEffect, useState, useMemo, DragEvent } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { 
  Bell, Copy, Plus, MoreVertical, Edit2, Trash2, Folder, LayoutGrid, AlertCircle, 
  Check, Search, Sparkles, Loader2, Wand2, Camera, XCircle, CheckCircle2, History, 
  RotateCcw, Star, Clock, Settings, BookOpen, MessageSquare, Share2, Zap,
  BarChart2, ChevronLeft, ChevronRight, Activity, RefreshCw, PieChart, ShieldAlert,
  ChevronDown, Library, Mail, MessageCircle, Code2, FileText, Lightbulb,
  Workflow, Play, ExternalLink, ArrowRight, GripVertical, CheckCircle, 
  ArrowDown, Save, FastForward, Pin, Layers, Database, MousePointerClick, Edit3,
  Undo2, FileDown, FolderOpen, User, CreditCard, LogOut, AlertTriangle, Moon, Command,
  Key 
} from 'lucide-react'

// ============================================================================
// 1. SHADCN UI BİLEŞENLERİ (UI COMPONENTS)
// ============================================================================
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import SettingsView from "@/components/SettingsView"
import OpenAI from 'openai';

// ============================================================================
// 2. ORTAK STİL TANIMLAMALARI (GLOBAL STYLES)
// ============================================================================
// Profesyonel ve ince kaydırma çubuğu (Scrollbar) sınıfları. Amatör görünümü engeller.
const scrollbarClasses = "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full transition-colors"

// import'ların hemen altına ekle:
const MenuItems = ({ items }: { items: any[] }) => {
  return (
    <>
      {items.map((item, index) => {
        // Platform objesi geliyorsa item.value, direkt string geliyorsa item kullanır
        const value = item.value || item;
        const label = item.label || item;
        return (
          <SelectItem key={index} value={value} className="cursor-pointer">
            {label}
          </SelectItem>
        );
      })}
    </>
  );
};

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
  const [workflows, setWorkflows] = useState<AppWorkflow[]>(initialWorkflowsData);
  
  const [loading, setLoading] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // --- WORKSPACE YÖNETİM SİSTEMİ ---
  const [workspaces, setWorkspaces] = useState([
    { id: '1', name: "Tolga's Workspace", icon: '🚀' },
    { id: '2', name: "Agency Workspace", icon: '💼' }
  ]);
  const [activeWsId, setActiveWsId] = useState('1');
  const activeWorkspace = workspaces.find(w => w.id === activeWsId) || workspaces[0];

  // Modallar ve Geçici Stateler
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsIcon, setNewWsIcon] = useState('✨');
  const [showNewIconPicker, setShowNewIconPicker] = useState(false);

  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false);
  const [editWsName, setEditWsName] = useState('');
  const [selectedWorkspaceIcon, setSelectedWorkspaceIcon] = useState('🚀');
  const [showIconPicker, setShowIconPicker] = useState(false);

  const [showDeleteWorkspace, setShowDeleteWorkspace] = useState(false);

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

  // ============================================================================
  // WORKSPACE VERİLERİNİ ÇEKME (ISOLATION)
  // ============================================================================
  useEffect(() => {
    const fetchWorkspaceData = async () => {
      // Kullanıcı veya aktif çalışma alanı yoksa işlemi durdur
      if (!user?.id || !activeWsId) return;

      setLoading(true);

      try {
        // 1. Sadece aktif Workspace'e ait Promtları çek
        const { data: promptsData, error: promptsError } = await supabase
          .from('prompts')
          .select('*')
          .eq('user_id', user?.id)
          .eq('workspace_id', activeWsId)
          .order('created_at', { ascending: false });
        
        if (!promptsError && promptsData) {
          const normalized = promptsData.map((p: any) => ({
            ...p,
            platforms: Array.isArray(p.platforms) && p.platforms.length > 0
              ? p.platforms 
              : typeof p.platform === 'string' && p.platform
                ? [p.platform] 
                : ['chatgpt']
          }))
          setPrompts(normalized)
        }

        // 2. Sadece aktif Workspace'e ait Koleksiyonları çek
        const { data: collectionsData, error: collectionsError } = await supabase
          .from('collections')
          .select('*')
          .eq('user_id', user?.id)
          .eq('workspace_id', activeWsId)
          .order('created_at', { ascending: false });
        
        if (!collectionsError && collectionsData) setCollections(collectionsData);

        // 3. Sadece aktif Workspace'e ait Çıktıları (Outputs) çek
        const { data: outputsData, error: outputsError } = await supabase
          .from('outputs')
          .select('*')
          .eq('user_id', user?.id)
          .eq('workspace_id', activeWsId)
          .order('created_at', { ascending: false });
        
        if (!outputsError && outputsData) setOutputs(outputsData);

        // 4. Sadece aktif Workspace'e ait Workflow'ları çek
        const { data: workflowsData, error: workflowsError } = await supabase
          .from('workflows')
          .select('*')
          .eq('user_id', user?.id)
          .eq('workspace_id', activeWsId)
          .order('created_at', { ascending: false });
        
        if (!workflowsError && workflowsData) setWorkflows(workflowsData);

      } catch (error) {
        console.error("Veri çekme hatası:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaceData();
  }, [user?.id, activeWsId, supabase]); // activeWsId değiştiği an bu kod baştan çalışır!

  // -----------------------------------------------------
  // MODAL DURUMLARI (MODAL VISIBILITY)
  // -----------------------------------------------------
  const [showAddPrompt, setShowAddPrompt] = useState(false)
  const [showSettings, setShowSettings] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [feedbackText, setFeedbackText] = useState('');

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
  const [activeView, setActiveView] = useState<'dashboard' | 'all' | 'favorites' | 'recent' | 'trash' | 'analytics' | 'outputs' | 'platform' | 'collection' | 'workflows' | 'workflow-execution' | 'unified-prompt'>('dashboard')  
  const [activeCollection, setActiveCollection] = useState<string | null>(null)
  const [activePlatform, setActivePlatform] = useState<string | null>(null)
  
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const [sharingCollectionId, setSharingCollectionId] = useState<string | null>(null)
  const [shareModalCollection, setShareModalCollection] = useState<Collection | null>(null)
  
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

  // BİLDİRİM STATE'LERİ
  const [notifications, setNotifications] = useState<any[]>([]);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Sayfa yüklendiğinde bildirimleri çek
  useEffect(() => {
    async function fetchNotifications() {
      if (!user?.id) return;
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (data) setNotifications(data);
    }
    fetchNotifications();
  }, [user?.id, supabase]);

  // Tümünü okundu işaretle
  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    
    // Supabase'de güncelle
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user?.id)
      .eq('is_read', false);
      
    // Ekranda (State) anında güncelle
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

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
  // Eğer outputs null veya undefined ise boş dizi döndür, değilse filtrele
  return (outputs || []).filter(o => !o.deleted_at);
}, [outputs]);
  
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
    
    try {
      // 1. SUPABASE'E GÖNDER (GERÇEK VERİTABANI İŞLEMİ)
      const { data, error } = await supabase
        .from('prompts')
        .insert([{
          title: form.title.trim(), 
          description: form.description.trim(), // Veritabanına eklemediysen bunu 'notes' falan yapabilirsin veya tabloya ekleyebilirsin
          content: form.content.trim(), 
          platform: getFinalPlatforms()[0], // İlk platformu ana platform olarak al
          category: getFinalCategory(), 
          collection_id: form.collection_id === 'none' ? null : form.collection_id,
          user_id: user?.id,
          workspace_id: activeWsId // <--- SİHİRLİ DAMGA: Sadece aktif çalışma alanına kaydeder!
        }])
        .select();

      if (error) throw error;

      // 2. EKRANI GÜNCELLE
      if (data) {
        setPrompts(prev => [data[0], ...prev])
      }
      
      setForm(emptyForm)
      setShowAddPrompt(false)
    } catch (err: any) {
      setError(err.message || 'Error saving prompt')
    } finally {
      setSubmitting(false)
    }
  }

  // 11. MEVCUT PROMPTU GÜNCELLEME VE VERSİYONLAMA
  const handleEditPrompt = async () => {
    if (!editingPrompt) return;
    setSubmitting(true);
    
    try {
      // 1. ADIM: Mevcut (Eski) promptu kaybetmemek için Versiyonlar tablosuna yedekle
      const { error: versionError } = await supabase
        .from('versions')
        .insert([{
          prompt_id: editingPrompt.id,
          content: editingPrompt.content, 
          version_num: promptVersions.length + 1,
          user_id: user?.id
        }]);

      if (versionError) console.error("Version backup error:", versionError);

      // 2. ADIM: Asıl Promptu yeni verilerle güncelle
      const { data, error } = await supabase
        .from('prompts')
        .update({
          title: form.title,
          content: form.content,
          description: form.description,
          category: form.category === 'Other' ? form.customCategory : form.category,
          platforms: form.platforms.filter(p => p !== 'other')
        })
        .eq('id', editingPrompt.id)
        .select();

      if (error) throw error;

      // 3. ADIM: Ekranı güncelle ve modalı kapat
      setPrompts(prev => prev.map(p => p.id === editingPrompt.id ? data[0] : p));
      setShowAddPrompt(false);
      setEditingPrompt(null);
      
    } catch (err: any) {
      setError(err.message || "Failed to update prompt.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    if (!window.confirm("Are you sure you want to move this prompt to trash?")) return

    try {
      // Çöp kutusu mantığı (Soft Delete): deleted_at sütununa şu anın tarihini basıyoruz
      const { error } = await supabase
        .from('prompts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', promptId)

      if (error) throw error

      // Ekranda aktif listeyi anında güncelle (Silineni listeden düşür)
      setPrompts(prev => prev.map(p => p.id === promptId ? { ...p, deleted_at: new Date().toISOString() } : p))
      
      if (searchResults) {
        setSearchResults(prev => prev ? prev.filter(p => p.id !== promptId) : null)
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting prompt')
    }
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

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY, // .env.local dosyanızdaki isim
  dangerouslyAllowBrowser: true // Client-side için zorunludur
});

const handleMagicPaste = async () => {
  if (!outputForm.magicPasteContent.trim()) return;
  
  setIsMagicPasting(true);
  try {
    // 1. AI ile metni yapılandırılmış JSON'a dönüştür
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Hızlı ve ekonomik model
      messages: [{
        role: "system", 
        content: "Verilen metni analiz et. İçinden bir 'title', 'promptContent' ve 'outputContent' çıkar. JSON formatında yanıt ver."
      }, {
        role: "user", 
        content: outputForm.magicPasteContent 
      }],
      response_format: { type: "json_object" }
    });

    const parsed = JSON.parse(completion.choices[0].message.content || '{}');

    // 2. Prompt'u Supabase'e ekle
    const { data: pData, error: pError } = await supabase
      .from('prompts')
      .insert([{
        title: parsed.title || 'Magic Paste',
        content: parsed.promptContent || '',
        category: 'Magic Paste',
        user_id: user?.id,
        workspace_id: activeWsId
      }])
      .select();

    if (pError) throw pError;
    const savedPrompt = pData[0];

    // 3. Output'u bağlayıp ekle
    const { error: oError } = await supabase
      .from('outputs')
      .insert([{
        content: parsed.outputContent || '',
        prompt_id: savedPrompt.id,
        user_id: user?.id,
        workspace_id: activeWsId
      }]);

    if (oError) throw oError;

    // 4. Güncelleme
    setPrompts(prev => [savedPrompt, ...prev]);
    setShowAddOutput(false);
    alert("Magic Paste başarıyla tamamlandı!");

  } catch (err: any) {
    console.error("Magic Paste hatası:", err);
    alert("Analiz sırasında bir hata oluştu: " + err.message);
  } finally {
    setIsMagicPasting(false);
  }
};

// OPTİMİZE EDİLMİŞ PROMPTU KABUL ETME
  const acceptOptimization = async () => {
    if (optimizeResult?.improved_prompt && editingPrompt) {
      // 1. Mevcut içeriği version history'e kaydet
      const newVersionNum = promptVersions.length + 1
      
      try {
        const { data, error } = await supabase
          .from('versions')
          .insert([{
            prompt_id: editingPrompt.id,
            content: form.content, // Eski içeriği kaydet
            version_num: newVersionNum,
            user_id: user?.id
          }])
          .select()

        if (!error && data) {
          setPromptVersions(prev => [...prev, {
            id: data[0].id,
            prompt_id: editingPrompt.id,
            content: form.content,
            version_num: newVersionNum,
            created_at: data[0].created_at,
            deleted_at: null
          }])
        }
      } catch (err) {
        console.warn("Version save error:", err)
      }

      // 2. Editördeki içeriği AI versiyonuyla değiştir
      setForm(prev => ({ ...prev, content: optimizeResult.improved_prompt }));
      setShowOptimizeModal(false);
      setOptimizeResult(null);
    } else if (optimizeResult?.improved_prompt) {
      // editingPrompt yoksa sadece içeriği değiştir
      setForm(prev => ({ ...prev, content: optimizeResult.improved_prompt }));
      setShowOptimizeModal(false);
      setOptimizeResult(null);
    }
  };

  // 1. WORKFLOW SİLME FONKSİYONU
  const handleDeleteWorkflow = async (workflowId: string) => {
    if(!window.confirm("Are you sure you want to delete this workflow?")) return;
    
    try {
      const { error } = await supabase
        .from('workflows')
        .delete()
        .eq('id', workflowId);
        
      if(error) throw error;
      
      // Ekranda listeyi güncelle
      setWorkflows(prev => prev.filter(w => w.id !== workflowId));
    } catch(err: any) {
      alert(err.message || "Error deleting workflow");
    }
  }

  // 2. PIN (SABİTLEME) FONKSİYONLARI (Prompt & Output için)
  const togglePinPrompt = async (prompt: Prompt, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const newPinnedStatus = !prompt.is_pinned;
      const { error } = await supabase
        .from('prompts')
        .update({ is_pinned: newPinnedStatus })
        .eq('id', prompt.id);
        
      if(error) throw error;
      setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, is_pinned: newPinnedStatus } : p));
    } catch (err: any) {
      console.error("Error pinning prompt:", err);
    }
  }

  const togglePinOutput = async (output: Output, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const newPinnedStatus = !output.is_pinned;
      const { error } = await supabase
        .from('outputs')
        .update({ is_pinned: newPinnedStatus })
        .eq('id', output.id);
        
      if(error) throw error;
      setOutputs(prev => prev.map(o => o.id === output.id ? { ...o, is_pinned: newPinnedStatus } : o));
    } catch (err: any) {
       console.error("Error pinning output:", err);
    }
  }

  // 3. OUTPUT, PROMPT VE VERSION'LARI ÇÖPE ATMA FONKSİYONU (Güncellendi)
  const handleMoveToTrash = async (id: string, type: 'prompt' | 'output' | 'version', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if(!window.confirm(`Are you sure you want to move this ${type} to trash?`)) return;

    try {
      if (type === 'version') {
         const { error } = await supabase.from('versions').delete().eq('id', id);
         if (error) {
           // Veritabanında yoksa sadece local state'den sil
           console.warn("Version delete error, removing from local state:", error);
         }
         setPromptVersions(prev => prev.filter(v => v.id !== id));
      } else {
         // Prompt ve Output için Soft Delete (Çöp kutusuna atma - deleted_at güncellenir)
         const table = type === 'prompt' ? 'prompts' : 'outputs';
         const { error } = await supabase
           .from(table)
           .update({ deleted_at: new Date().toISOString() })
           .eq('id', id);

         if(error) throw error;

         // Ekranı güncelle
         if(type === 'prompt') {
           setPrompts(prev => prev.map(p => p.id === id ? { ...p, deleted_at: new Date().toISOString() } : p));
         } else {
           setOutputs(prev => prev.map(o => o.id === id ? { ...o, deleted_at: new Date().toISOString() } : o));
         }
      }
    } catch (err: any) {
      alert(err.message || `Error deleting ${type}`);
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

  // 4. FAVORİLERE EKLEME / ÇIKARMA FONKSİYONU
  const toggleFavorite = async (prompt: Prompt, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const newFavoriteStatus = !prompt.is_favorite;
      const { error } = await supabase
        .from('prompts')
        .update({ is_favorite: newFavoriteStatus })
        .eq('id', prompt.id);
        
      if(error) throw error;
      
      // Ekranı anında güncelle
      setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, is_favorite: newFavoriteStatus } : p));
      
      // Eğer kullanıcı arama yapmışsa, arama sonuçlarını da güncelle ki ekranda anlık değişsin
      if (searchResults) {
         setSearchResults(prev => prev ? prev.map(p => p.id === prompt.id ? { ...p, is_favorite: newFavoriteStatus } : p) : null);
      }
    } catch (err: any) {
      console.error("Error toggling favorite:", err);
    }
  }

  const handleSaveCollection = async () => {
    if (!collectionForm.name.trim()) {
      alert('Collection name is required.')
      return
    }

    setSubmitting(true)

    try {
      const collectionData = {
        name: collectionForm.name.trim(),
        description: collectionForm.description.trim(),
        user_id: user?.id,
        workspace_id: activeWsId // Koleksiyonun hangi workspace'e ait olduğunu damgalıyoruz
      }

      if (editingCollection) {
        // GÜNCELLEME (RENAME)
        const { data, error } = await supabase
          .from('collections')
          .update(collectionData)
          .eq('id', editingCollection.id)
          .select()

        if (error) throw error
        if (data) {
          setCollections(prev => prev.map(c => c.id === editingCollection.id ? data[0] : c))
        }
      } else {
        // YENİ EKLEME (INSERT)
        const { data, error } = await supabase
          .from('collections')
          .insert([collectionData])
          .select()

        if (error) throw error
        if (data) {
          setCollections(prev => [data[0], ...prev])
        }
      }

      setCollectionForm({ name: '', description: '' })
      setEditingCollection(null)
      setShowAddCollection(false)
    } catch (err: any) {
      alert(err.message || 'Error saving collection')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleCollectionPublic = async (collection: Collection) => {
    try {
      const newStatus = !collection.is_public
      const { error } = await supabase
        .from('collections')
        .update({ is_public: newStatus })
        .eq('id', collection.id)

      if (error) throw error

      setCollections(prev => prev.map(c => 
        c.id === collection.id ? { ...c, is_public: newStatus } : c
      ))
    } catch (err: any) {
      alert(err.message || 'Error updating collection')
    }
  }

  const handleCopyShareLink = (collectionId: string) => {
    const link = `${window.location.origin}/share/${collectionId}`
    navigator.clipboard.writeText(link)
    setSharingCollectionId(collectionId)
    setTimeout(() => setSharingCollectionId(null), 2000)
  }

  const handleDeleteCollection = async (collectionId: string) => {
    try {
      // Veritabanından koleksiyonu uçuruyoruz (SQL'de ON DELETE CASCADE olduğu için bağlantılı prompts otomatik null olur)
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', collectionId)

      if (error) throw error

      // Sol menüdeki listeden kaldır
      setCollections(prev => prev.filter(c => c.id !== collectionId))
      
      // Eğer kullanıcı şu an silinen koleksiyonun içindeyse, All Prompts (dashboard) görünümüne geri fırlat
      if (activeCollection === collectionId) {
        setActiveCollection(null)
        setActiveView('dashboard')
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting collection')
    }
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

  // OUTPUT (ÇIKTI) KAYDETME VE GÜNCELLEME FONKSİYONU
  const handleSaveOutput = async () => {
    // İçerik boş mu diye kontrol et
    if (!outputForm.content.trim()) {
      alert("Output content is required!");
      return;
    }

    setSubmitting(true);
    try {
      // Veritabanına gönderilecek paket
      const payload = {
        content: outputForm.content,
        format: outputForm.format === 'other' ? outputForm.customFormat : outputForm.format,
        platform: outputForm.platform === 'other' ? outputForm.customPlatform : outputForm.platform,
        notes: outputForm.notes,
        prompt_id: outputForm.prompt_id === 'none' ? null : outputForm.prompt_id,
        user_id: user?.id,
        workspace_id: activeWsId // Veriyi sadece bu workspace'e bağla
      };

      if (editingOutput) {
        // MEVCUT ÇIKTIYI GÜNCELLEME (UPDATE)
        const { error } = await supabase
          .from('outputs')
          .update(payload)
          .eq('id', editingOutput.id);

        if (error) throw error;
        
        // Ekranı güncelle
        setOutputs(prev => prev.map(o => o.id === editingOutput.id ? { ...o, ...payload } : o));
      } else {
        // YENİ ÇIKTI EKLEME (INSERT)
        const { data, error } = await supabase
          .from('outputs')
          .insert([payload])
          .select();

        if (error) throw error;
        
        // Ekranı güncelle
        if (data) setOutputs(prev => [data[0], ...prev]);
      }

      // İşlem bitince modalı kapat
      setShowAddOutput(false);
      setEditingOutput(null);
    } catch (err: any) {
      console.error("Save output error:", err);
      alert(err.message || "Failed to save output");
    } finally {
      setSubmitting(false);
    }
  };

  // 12. YENİ WORKSPACE OLUŞTURMA (HATA AVCI SÜRÜMÜ)
  const handleCreateWorkspace = async () => {
    if (!newWsName.trim()) {
      alert("Workspace name is required!");
      return;
    }

    // 🕵️‍♂️ HATA TESPİTİ - 1: Kullanıcı durumu ne?
    console.log("=== WORKSPACE OLUŞTURMA BAŞLADI ===");
    console.log("Giriş Yapmış Kullanıcı Nesnesi:", user);
    console.log("Gönderilecek user_id:", user?.id);

    setSubmitting(true);
    try {
      const payload = {
        name: newWsName,
        icon: newWsIcon,
        user_id: user?.id // Eğer burası null/undefined ise RLS engelleyecektir
      };

      console.log("Supabase'e gönderilen paket (Payload):", payload);

      const { data, error } = await supabase
        .from('workspaces')
        .insert([payload])
        .select();

      // 🕵️‍♂️ HATA TESPİTİ - 2: Supabase tam olarak ne yanıt verdi?
      console.log("Supabase'den dönen Data:", data);
      console.log("Supabase'den dönen Hata (Error):", error);

      if (error) throw error;

      if (data && data[0]) {
        setWorkspaces(prev => [...prev, data[0]]);
        setActiveWsId(data[0].id);
        alert("Başarılı! Veritabanına kaydedildi.");
      } else {
        // Hata fırlatmadı ama boş döndüyse %99 RLS engellemiştir
        alert("Veritabanından boş veri döndü! Muhtemelen user_id eşleşmediği için Supabase RLS politikası kaydı engelledi. Konsolu (F12) kontrol et.");
      }
      
      setShowCreateWorkspace(false);
      setNewWsName('');
      setNewWsIcon('😀');
    } catch (err: any) {
      console.error("Yakalanan Hata Nesnesi:", err);
      alert("Failed to create workspace: " + (err.message || JSON.stringify(err)));
    } finally {
      setSubmitting(false);
      console.log("=== WORKSPACE OLUŞTURMA BİTTİ ===");
    }
  };

  // 13. WORKSPACE GÜNCELLEME (AYARLAR)
  const handleUpdateWorkspace = async () => {
    if (!editWsName.trim()) {
      alert("Workspace name cannot be empty!");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .update({
          name: editWsName,
          icon: selectedWorkspaceIcon
        })
        .eq('id', activeWsId)
        .select();

      if (error) throw error;

      if (data && data[0]) {
        // Listeyi güncellenen veriyle senkronize et
        setWorkspaces(prev => prev.map(w => w.id === activeWsId ? data[0] : w));
      }
      setShowWorkspaceSettings(false);
    } catch (err: any) {
      alert("Failed to update workspace: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 14. WORKSPACE SİLME
  const handleDeleteWorkspace = async () => {
    if (workspaces.length <= 1) {
      alert("You cannot delete your only workspace!");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', activeWsId);

      if (error) throw error;

      // Silinen workspace'i state'den çıkar ve ilk workspace'i aktif yap
      const newWorkspaces = workspaces.filter(w => w.id !== activeWsId);
      setWorkspaces(newWorkspaces);
      setActiveWsId(newWorkspaces[0].id);
      setShowDeleteWorkspace(false);
    } catch (err: any) {
      alert("Failed to delete workspace: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================================
  // AI PROMPT OPTİMİZASYON FONKSİYONU
  // ============================================================================
  const triggerAIOptimize = async () => {
    if (!form.content || form.content.trim() === '') {
      alert("Please write a prompt first to optimize it.");
      return;
    }

    setShowOptimizeModal(true); // Önce loading/analiz ekranını aç
    setIsOptimizing(true);

    try {
      const openai = new OpenAI({
        apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "system",
          content: "You are an Expert Prompt Engineer. Analyze the given prompt. Return a JSON object with 3 keys: 'strengths' (array of strings), 'weaknesses' (array of strings), and 'improved_prompt' (a much better, structured, and clearer version of the original prompt)."
        }, {
          role: "user",
          content: form.content
        }],
        response_format: { type: "json_object" }
      });

      const parsed = JSON.parse(completion.choices[0].message.content || '{}');

      // AI'dan gelen veriyi state'e aktar
      setOptimizeResult({
        strengths: parsed.strengths || ["Clear intent"],
        weaknesses: parsed.weaknesses || ["Could be more specific"],
        improved_prompt: parsed.improved_prompt || form.content
      });

    } catch (error: any) {
      console.error("Optimization error:", error);
      alert("An error occurred during AI optimization.");
      setShowOptimizeModal(false);
    } finally {
      setIsOptimizing(false);
    }
  };

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

  const saveWorkflowBuilder = async () => {
    if(!workflowForm.title.trim()) return

    setSubmitting(true)
    
    // Adımların platform verilerini temizle
    const finalizedSteps = workflowForm.steps.map(step => {
      return {...step, platforms: step.platforms.length > 0 ? step.platforms : ['chatgpt']}
    })

    try {
      const workflowData = {
        title: workflowForm.title,
        description: workflowForm.description || '',
        steps: finalizedSteps,
        user_id: user?.id,
        workspace_id: activeWsId // SİHİRLİ DAMGA
      }

      // Eğer id "wf-" ile başlıyorsa bu yeni bir oluşturmadır, UUID ise veritabanında zaten vardır (güncellemedir).
      const isExisting = !workflowForm.id.startsWith('wf-');

      let response;

      if (isExisting) {
        // GÜNCELLEME (UPDATE)
        response = await supabase
          .from('workflows')
          .update(workflowData)
          .eq('id', workflowForm.id)
          .select()
      } else {
        // YENİ EKLEME (INSERT)
        response = await supabase
          .from('workflows')
          .insert([workflowData])
          .select()
      }

      if (response.error) throw response.error

      if (response.data && response.data.length > 0) {
        const savedWf = response.data[0]
        if (isExisting) {
          setWorkflows(prev => prev.map(w => w.id === savedWf.id ? savedWf : w))
        } else {
          setWorkflows(prev => [savedWf, ...prev])
        }
      }
      
      setShowWorkflowBuilder(false)
    } catch (err: any) {
      alert(err.message || "Error saving workflow")
    } finally {
      setSubmitting(false)
    }
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
  
  const saveAllWorkflowAssets = async () => {
    if(!activeWorkflow) return
    setSubmitting(true)

    let newPromptsCount = 0
    let newOutputsCount = 0

    try {
      // 1. Önce kaydedilecek tüm veri paketini hazırlayalım
      const assetsToSave: any[] = []
      
      activeWorkflow.steps.forEach(step => {
        const iters = executionVersions[step.id] || []
        iters.forEach(iter => {
          assetsToSave.push({
            promptTitle: `${activeWorkflow.title} - ${iter.title}`,
            description: iter.goal,
            promptContent: iter.prompt_text,
            outputContent: iter.output_text,
            platforms: iter.platforms
          })
        })
      })

      // 2. Sırayla Supabase'e gönderelim
      for (const asset of assetsToSave) {
        // A. Önce Prompt'u kaydet
        const { data: pData, error: pError } = await supabase
          .from('prompts')
          .insert([{
            title: asset.promptTitle,
            description: asset.description,
            content: asset.promptContent,
            platform: asset.platforms[0] || 'chatgpt',
            category: 'Other',
            user_id: user?.id,
            workspace_id: activeWsId // SİHİRLİ DAMGA
          }])
          .select()

        if (pError) throw pError

        if (pData && pData.length > 0) {
          const savedPrompt = pData[0]
          setPrompts(prev => [savedPrompt, ...prev])
          newPromptsCount++

          // B. Eğer çıktı (Output) boş değilse, az önce oluşan Prompt'a bağlayıp kaydet
          if (asset.outputContent.trim()) {
            const { data: oData, error: oError } = await supabase
              .from('outputs')
              .insert([{
                prompt_id: savedPrompt.id, // Gerçek ID ile bağlandı
                content: asset.outputContent,
                format: 'other',
                platform: asset.platforms[0] || 'chatgpt',
                notes: `Auto-saved from workflow execution`,
                user_id: user?.id,
                workspace_id: activeWsId // SİHİRLİ DAMGA
              }])
              .select()

            if (oError) throw oError
            
            if (oData && oData.length > 0) {
              setOutputs(prev => [oData[0], ...prev])
              newOutputsCount++
            }
          }
        }
      }

      alert(`Başarıyla ${newPromptsCount} prompt ve ${newOutputsCount} çıktı kütüphanenize kaydedildi.`)
    } catch (err: any) {
      alert(err.message || "Error saving workflow assets")
    } finally {
      setSubmitting(false)
    }
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

  const saveUnifiedPrompt = async () => {
    if(!unifiedForm.title.trim() || !unifiedForm.combinedPrompt.trim()) {
      alert("Title and Prompt are required.")
      return
    }

    setSubmitting(true)

    try {
      // 1. ANA PROMPT'U SUPABASE'E KAYDET (Açık olan Workspace'e)
      const { data: promptData, error: promptError } = await supabase
        .from('prompts')
        .insert([{
          title: unifiedForm.title,
          description: unifiedForm.description,
          content: unifiedForm.combinedPrompt,
          platform: unifiedForm.platforms[0] || 'chatgpt',
          category: 'General',
          user_id: user?.id,
          workspace_id: activeWsId, // <-- SİHİRLİ DAMGA
          is_favorite: true
        }])
        .select()

      if (promptError) throw promptError

      if (promptData && promptData.length > 0) {
        // Ekrana gerçek veriyi bas
        setPrompts(prev => [promptData[0], ...prev])

        // 2. EĞER ÇIKTI (OUTPUT) VARSA ONU DA KAYDET
        if(unifiedForm.combinedOutput.trim()) {
          const { data: outputData, error: outputError } = await supabase
            .from('outputs')
            .insert([{
              prompt_id: promptData[0].id, // Yeni oluşan promptun gerçek ID'sini bağlıyoruz
              content: unifiedForm.combinedOutput,
              format: 'other',
              platform: unifiedForm.platforms[0] || 'chatgpt',
              notes: 'Generated via Unified Workflow Engine',
              user_id: user?.id,
              workspace_id: activeWsId // <-- SİHİRLİ DAMGA
            }])
            .select()
            
          if (outputError) throw outputError
          
          if (outputData && outputData.length > 0) {
            setOutputs(prev => [outputData[0], ...prev])
          }
        }
      }
      
      alert("Unified Prompt & Outputs successfully generated and saved!")
      setNav('all')
    } catch (err: any) {
      alert(err.message || "Error saving unified prompt")
    } finally {
      setSubmitting(false)
    }
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

  // Supabase E-posta Güncelleme Fonksiyonu
  const handleUpdateEmail = async () => {
    if (!newEmail || newEmail === user?.email) {
      alert("Lütfen mevcut e-postanızdan farklı geçerli bir adres girin.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) {
      alert("E-posta güncellenirken bir hata oluştu: " + error.message);
    } else {
      alert("E-posta adresi güncelleme isteği gönderildi! Lütfen hem eski hem de yeni e-posta adresinize gelen doğrulama linklerini onaylayın.");
    }
  };

  // Supabase Şifre Değiştirme Fonksiyonu
  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert("Yeni şifreniz güvenlik nedeniyle en az 6 karakter olmalıdır.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      alert("Şifre değiştirilirken bir hata oluştu: " + error.message);
    } else {
      alert("Şifreniz başarıyla güncellendi!");
      setNewPassword('');
    }
  };

  // Geri Bildirim (Feedback) Fonksiyonu (Şimdilik mailto tetikler, ileride tabloya bağlanabilir)
  const handleFeedbackSubmit = () => {
    if (!feedbackText.trim()) return;
    window.location.href = `mailto:support@prompax.com?subject=Prompax User Feedback&body=${encodeURIComponent(feedbackText)}`;
    setShowFeedback(false);
    setFeedbackText('');
  };

  return (
    <div className="min-h-screen bg-[#060609] text-slate-200 font-sans selection:bg-violet-500/30 flex overflow-hidden">
      
      {/* ============================================================================ */}
      {/* 6. SIDEBAR                                                                     */}
      {/* ============================================================================ */}
      <aside className={`h-screen bg-[#0A0A0F]/95 backdrop-blur-xl border-r border-white/5 flex flex-col z-20 shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-[80px]' : 'w-72'}`}>
        
        {/* 1. LOGO & COLLAPSE BUTTON */}
        <div className={`p-5 border-b border-white/5 shrink-0 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} relative`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_-5px_rgba(139,92,246,0.5)] shrink-0">
              <LayoutGrid className="w-4 h-4 text-white" />
            </div>
            {!isCollapsed && (
              <span className="font-bold text-[18px] tracking-tight text-white">
                Prompax
              </span>
            )}
          </div>
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className={`p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all ${isCollapsed ? 'absolute -right-3 top-6 border border-white/10 bg-[#0A0A0F] shadow-lg z-50' : ''}`}
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* 2. ACTIVE WORKSPACE (DİNAMİK VE ÇALIŞAN YAPI) */}
        {!isCollapsed && (
          <div className="p-4 border-b border-white/5 shrink-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Active Workspace</p>
            
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 transition-colors p-2 rounded-xl border border-white/10 outline-none group">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-7 h-7 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center text-sm shrink-0 border border-violet-500/20 group-hover:bg-violet-500/30 transition-colors">
                    {activeWorkspace.icon}
                  </div>
                  <span className="text-sm font-bold text-slate-200 truncate group-hover:text-white transition-colors">
                    {activeWorkspace.name}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              </DropdownMenuTrigger>
              
              <DropdownMenuContent className="w-64 bg-[#0A0A0F] border-white/10 text-slate-300 ml-4 rounded-xl shadow-2xl p-2 z-50">
                <div className="px-2 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 mt-1">
                  Switch Workspace
                </div>
                
                {/* ÇALIŞMA ALANLARI (DİNAMİK LİSTE) */}
                <div className="space-y-1 mb-2">
                  {workspaces.map(ws => (
                    <DropdownMenuItem 
                      key={ws.id} 
                      onClick={() => setActiveWsId(ws.id)} 
                      className={`gap-3 cursor-pointer py-2.5 rounded-lg text-sm transition-all outline-none ${activeWsId === ws.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                    >
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0 ${activeWsId === ws.id ? 'bg-violet-500/20 border border-violet-500/30' : 'bg-white/5 border border-white/10'}`}>
                        {ws.icon}
                      </div>
                      <span className={`flex-1 truncate ${activeWsId === ws.id ? 'text-white font-bold' : 'text-slate-400 font-medium'}`}>
                        {ws.name}
                      </span>
                      {activeWsId === ws.id && <Check size={14} className="text-violet-400 shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                </div>

                <DropdownMenuSeparator className="bg-white/5 my-2" />

                {/* AYARLAR VE YENİ OLUŞTURMA */}
                <DropdownMenuItem onClick={() => { setEditWsName(activeWorkspace.name); setSelectedWorkspaceIcon(activeWorkspace.icon); setShowWorkspaceSettings(true); }} className="gap-2.5 hover:bg-white/5 cursor-pointer py-2 rounded-lg text-sm text-slate-300 outline-none">
                  <Settings size={14} className="text-slate-400 shrink-0" /> <span className="truncate">Workspace Settings</span>
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => { setNewWsName(''); setNewWsIcon('✨'); setShowCreateWorkspace(true); }} className="gap-2.5 hover:bg-white/5 cursor-pointer py-2 rounded-lg text-sm text-slate-300 outline-none">
                  <Plus size={14} className="text-slate-400 shrink-0" /> <span className="truncate">Create New Workspace</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-white/5 my-2" />

                <DropdownMenuItem onClick={() => setShowDeleteWorkspace(true)} className="gap-2.5 text-red-400 hover:bg-red-500/10 cursor-pointer py-2 rounded-lg text-sm outline-none">
                  <Trash2 size={14} className="shrink-0" /> <span className="truncate">Delete Workspace</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
          
        {/* 3. MENU ITEMS */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-white/20">
          
          <div className="space-y-1">
            {/* Dashboard */}
            <button onClick={() => setNav('dashboard')} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'dashboard' ? 'bg-violet-500/10 text-violet-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
              <LayoutGrid className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>Dashboard</span>}
            </button>

            {/* All Prompts */}
            <button onClick={() => setNav('all')} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'all' ? 'bg-violet-500/10 text-violet-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
              <BookOpen className="w-4 h-4 shrink-0" />
              {!isCollapsed && (
                <>
                  All Prompts
                  <span className="ml-auto text-[11px] bg-white/5 px-2 py-0.5 rounded-md font-medium text-slate-300">{activePrompts.length}</span>
                </>
              )}
            </button>

            {/* Workflows */}
            <button onClick={() => setNav('workflows')} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'workflows' ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
              <Workflow className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>Workflows</span>}
            </button>

            {/* Saved Outputs */}
            <button onClick={() => setNav('outputs')} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'outputs' ? 'bg-pink-500/10 text-pink-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
              <Library className="w-4 h-4 shrink-0" />
              {!isCollapsed && (
                <>
                  Saved Outputs
                  <span className="ml-auto text-[11px] bg-white/5 px-2 py-0.5 rounded-md font-medium text-slate-300">{activeOutputs.length}</span>
                </>
              )}
            </button>

            {/* Recently Used */}
            <button onClick={() => setNav('recent')} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'recent' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
              <Clock className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>Recently Used</span>}
            </button>

            {/* Favorites */}
            <button onClick={() => setNav('favorites')} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'favorites' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
              <Star className="w-4 h-4 shrink-0" />
              {!isCollapsed && (
                <>
                  Favorites
                  <span className="ml-auto text-[11px] bg-white/5 px-2 py-0.5 rounded-md font-medium text-slate-300">{totalFavorites}</span>
                </>
              )}
            </button>

            {/* AI Optimize */}
            <button onClick={() => setNav('ai-optimize' as any)} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === ('ai-optimize' as any) ? 'bg-violet-500/10 text-violet-400' : 'text-slate-400 hover:text-violet-400 hover:bg-white/5'}`}>
              <Wand2 className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>AI Optimize</span>}
            </button>

            {/* Trash */}
            <button onClick={() => setNav('trash')} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeView === 'trash' ? 'bg-red-500/10 text-red-400' : 'text-slate-400 hover:text-red-400 hover:bg-white/5'}`}>
              <Trash2 className="w-4 h-4 shrink-0" />
              {!isCollapsed && (
                <>
                  Trash
                  {trashedItems.length > 0 && <span className="ml-auto text-[11px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-md font-medium">{trashedItems.length}</span>}
                </>
              )}
            </button>
          </div>

          {/* 4. COLLECTIONS */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-2 mb-3">
                <div className="flex items-center gap-2 cursor-pointer group flex-1" onClick={() => toggleSection('collections')}>
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">
                    Collections
                  </h3>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${expandedSections.collections ? '' : '-rotate-90'}`} />
                </div>
                <button 
                  onClick={(e) => { 
                    e.stopPropagation()
                    setShowAddCollection(true)
                    setError('')
                    setEditingCollection(null)
                    setCollectionForm({name: '', description: ''})
                  }} 
                  className="text-slate-400 hover:text-violet-400 transition-colors outline-none p-1"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
            
            {(expandedSections.collections || isCollapsed) && collections.map(col => (
              <div key={col.id} className="relative group/col flex items-center">
                <button onClick={() => setNav('collection', col.id)} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3 pr-8'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activeCollection === col.id ? 'bg-violet-500/10 text-violet-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                  <Folder className="w-4 h-4 shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span className="truncate">{col.name}</span>
                      <span className="ml-auto text-[11px] text-slate-500">{activePrompts.filter(p => p.collection_id === col.id).length}</span>
                    </>
                  )}
                </button>
                
                {/* ÜÇ NOKTA MENÜSÜ (EDİT & DELETE) */}
                {!isCollapsed && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="absolute right-2 p-1.5 rounded-md text-slate-500 opacity-0 group-hover/col:opacity-100 hover:bg-white/10 hover:text-slate-200 transition-all outline-none">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-[#1A1A28] border-white/10 text-slate-200 rounded-xl shadow-2xl p-1">
                      <DropdownMenuItem onClick={() => { setEditingCollection(col); setCollectionForm({name: col.name, description: col.description}); setShowAddCollection(true); }} className="gap-2.5 cursor-pointer hover:bg-white/10 py-2 text-[12px] font-medium">
                        <Edit2 className="w-3.5 h-3.5 text-slate-400" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/5 my-1" />
                      <DropdownMenuItem onClick={() => handleToggleCollectionPublic(col)} className="gap-2.5 cursor-pointer hover:bg-white/10 py-2 text-[12px] font-medium">
                        {col.is_public 
                          ? <><ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Make Private</>
                          : <><Share2 className="w-3.5 h-3.5 text-green-400" /> Make Public</>
                        }
                      </DropdownMenuItem>
                      {col.is_public && (
                        <DropdownMenuItem onClick={() => { setShareModalCollection(col) }} className="gap-2.5 cursor-pointer hover:bg-white/10 py-2 text-[12px] font-medium text-violet-400">
                          <ExternalLink className="w-3.5 h-3.5" /> Share Link
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator className="bg-white/5 my-1" />
                      <DropdownMenuItem onClick={() => { if(window.confirm("Delete this collection?")) setCollections(prev => prev.filter(c=>c.id!==col.id)) }} className="gap-2.5 cursor-pointer text-red-400 focus:text-red-400 hover:bg-red-500/10 py-2 text-[12px] font-medium">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>

          {/* 5. PLATFORMS */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-2 mb-3 cursor-pointer group" onClick={() => toggleSection('platforms')}>
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">
                  Platforms
                </h3>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${expandedSections.platforms ? '' : '-rotate-90'}`} />
              </div>
            )}
            
            {(expandedSections.platforms || isCollapsed) && PLATFORMS.filter(p => p.value !== 'other').map(plat => (
              <button key={plat.value} onClick={() => setNav('platform', null, plat.value)} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-xl text-[13px] font-medium transition-all ${activePlatform === plat.value ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                <div className={`w-2 h-2 rounded-full shrink-0 ${getPlatformDotColor(plat.value)}`} />
                {!isCollapsed && <span>{plat.label}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* BOTTOM USER PROFILE */}
        {/* BOTTOM USER PROFILE */}
        <div className="p-4 border-t border-white/5 bg-[#060609]/50 shrink-0 space-y-2">

        {/* Upgrade butonu */}
          <button className={`w-full flex items-center justify-center ${isCollapsed ? 'p-3' : 'gap-2 py-3'} bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[13px] font-semibold rounded-xl transition-all`}>
            <Zap className="w-4 h-4 fill-current shrink-0" />
            {!isCollapsed && <span>Upgrade to Pro</span>}
          </button>
            </div>
            
          {/* Settings butonu */}
          {!isCollapsed && (
          <button 
          onClick={() => setShowSettings(true)} // <-- Burayı ekledik
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all outline-none"
          >
          <Settings className="w-4 h-4 shrink-0" />
          <span>Settings</span>
          <ChevronRight className="w-4 h-4 ml-auto" />
          </button>
        )}
        </aside>

      {/* ============================================================================ */}
      {/* 7. MAIN CONTENT AREA                                                         */}
      {/* ============================================================================ */}
      <main className="flex-1 flex flex-col relative h-screen overflow-hidden bg-[#060609]">
        
{/* ============================================================================ */}
        {/* HEADER (Sabit, Kusursuz Hizalanmış)                                          */}
        {/* ============================================================================ */}
        <header className="sticky top-0 z-10 bg-[#060609]/80 backdrop-blur-xl border-b border-white/5 py-4 shrink-0 w-full">
          {/* İÇ HİZALAMA KUTUSU: Arama çubuğu ve profilin, alttaki dashboard ile aynı hizada kalmasını sağlar */}
          <div className="w-full max-w-[1400px] mx-auto px-8 lg:px-10 flex items-center justify-between gap-6">
            
            {/* DİNAMİK BAŞLIK (Dashboard hariç ekranlarda gösterilir) */}
            {activeView !== 'dashboard' && (
              <h1 className="text-[20px] font-bold text-white tracking-tight shrink-0">
                {activeView === 'workflow-execution' ? 'Workflow Execution Engine' :
                 activeView === 'unified-prompt' ? 'Unified Master Prompt Generator' :
                 searchResults !== null ? 'Search Results' :
                 activeView === 'workflows' ? 'Automated Workflows' :
                 activeView === 'outputs' ? 'Saved Outputs' :
                 activeView === 'trash' ? 'Trash' :
                 activeView === 'collection' ? collections.find(c => c.id === activeCollection)?.name : 'All Prompts'}
              </h1>
            )}

            {/* ARAMA ÇUBUĞU */}
            {(activeView !== 'analytics' && activeView !== 'workflow-execution' && activeView !== 'unified-prompt') && (
              <div className="flex-1 max-w-xl relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-violet-400 transition-colors z-10" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search prompts, workflows, outputs..."
                  className="w-full bg-[#0A0A0F]/90 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-[14px] text-white placeholder-slate-500 focus-visible:ring-1 focus-visible:ring-violet-500/50 hover:border-white/20 transition-all"
                />
                {isSearching && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                  </div>
                )}
              </div>
            )}

            {/* SAĞ: BUTONLAR, ÇAN + PROFİL */}
            <div className="flex items-center gap-3 shrink-0 ml-auto">
              {activeView === 'all' && (
                <button onClick={() => setShowAddPrompt(true)} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-[13px] font-bold transition-all shadow-[0_0_15px_-3px_rgba(139,92,246,0.4)]">
                  <Plus className="w-4 h-4" /> New Prompt
                </button>
              )}

              {activeView === 'workflows' && (
                <button onClick={() => { 
                  setWorkflowForm({ id: `wf-${Date.now()}`, title: 'New Workflow', description: '', steps: [], created_at: new Date().toISOString() }); 
                  setShowWorkflowBuilder(true); 
                }} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-[13px] font-bold transition-all shadow-[0_0_15px_-3px_rgba(99,102,241,0.4)]">
                  <Plus className="w-4 h-4" /> Create Workflow
                </button>
              )}

              {activeView === 'outputs' && (
                <button onClick={() => setShowAddOutput(true)} className="flex items-center gap-2 bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 rounded-xl text-[13px] font-bold transition-all shadow-[0_0_15px_-3px_rgba(236,72,153,0.4)]">
                  <Plus className="w-4 h-4" /> Save Output
                </button>
              )}

              {/* ============================================================================ */}
            {/* BİLDİRİM ÇANI (Gelişmiş)                                                     */}
            {/* ============================================================================ */}
            <DropdownMenu>
              <DropdownMenuTrigger className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/5 outline-none">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-pink-500 rounded-full text-[10px] font-black text-white flex items-center justify-center shadow-[0_0_10px_rgba(236,72,153,0.5)] animate-pulse">{unreadCount}</span>}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[340px] bg-[#0A0A0F] border-white/10 p-0 rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#060609]">
                  <h3 className="text-[14px] font-bold text-slate-200">Notifications</h3>
                  {unreadCount > 0 && <button onClick={markAllAsRead} className="text-[11px] font-bold text-violet-400 hover:text-violet-300 transition-colors">Mark all as read</button>}
                </div>
                
                <div className="max-h-[350px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full transition-colors">
                  {notifications.length === 0 ? (
                    <div className="p-10 text-center flex flex-col items-center justify-center">
                      <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center mb-4 border border-green-500/20">
                        <CheckCircle2 className="w-7 h-7 text-green-400" />
                      </div>
                      <p className="text-slate-200 font-bold text-[15px]">You're all caught up! 🎉</p>
                      <p className="text-slate-500 text-[13px] mt-1.5">No new notifications right now.</p>
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      let Icon = Bell;
                      let colorClass = "text-violet-400 bg-violet-500/10 border-violet-500/20";
                      
                      if (notif.type === 'ai') { Icon = Sparkles; colorClass = "text-orange-400 bg-orange-500/10 border-orange-500/20"; }
                      else if (notif.type === 'warning') { Icon = AlertTriangle; colorClass = "text-amber-400 bg-amber-500/10 border-amber-500/20"; }
                      else if (notif.type === 'success') { Icon = CheckCircle2; colorClass = "text-green-400 bg-green-500/10 border-green-500/20"; }

                      return (
                        <div key={notif.id} className={`flex gap-3.5 p-4 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-0 relative ${notif.is_read ? 'opacity-60' : 'bg-white/[0.02]'}`}>
                          {!notif.is_read && <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-pink-500 rounded-full shadow-[0_0_8px_rgba(236,72,153,0.8)]"></div>}
                          <div className={`mt-0.5 w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${colorClass}`}>
                            <Icon size={15} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] font-medium leading-snug ${notif.is_read ? 'text-slate-400' : 'text-slate-200'}`}>{notif.title}</p>
                            <p className="text-[11.5px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{notif.message}</p>
                            <span className="text-[10px] text-slate-600 font-medium mt-2 block">2 hours ago</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {notifications.length > 0 && (
                  <div className="p-2 border-t border-white/5 bg-[#060609]">
                    <button className="w-full py-2.5 text-center text-[12px] font-bold text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-white/5">
                      View all notifications
                    </button>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* ============================================================================ */}
            {/* PROFİL MENÜSÜ (Gelişmiş Profil & Kimlik Ayarları)                            */}
            {/* ============================================================================ */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer border border-white/5 outline-none">
                {user?.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} className="w-8 h-8 rounded-full shrink-0 object-cover" alt="Avatar" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-300 text-[12px] font-semibold shrink-0">
                    {user?.email?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className="hidden md:block text-left">
                  <p className="text-[13px] font-medium text-slate-200">{user?.user_metadata?.full_name || 'User'}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    <p className="text-[11px] text-slate-400 font-medium">Free Plan</p>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-500 ml-1" />
              </DropdownMenuTrigger>
              
              <DropdownMenuContent align="end" className="w-64 bg-[#0A0A0F] border-white/10 rounded-2xl shadow-2xl p-1">
                
                {/* 1. ÜST KISIM: KULLANICI ÖZET KARTI (İstatistik Kutusu Kaldırıldı) */}
                <div className="p-4 border-b border-white/5 mb-1 bg-[#060609] rounded-t-xl flex flex-col items-center text-center">
                  {user?.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} className="w-12 h-12 rounded-full mb-2.5 ring-2 ring-violet-500/30 object-cover" alt="Avatar" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-[16px] font-bold mb-2.5 shadow-lg">
                      {user?.email?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <p className="text-[14px] font-bold text-white tracking-tight">{user?.user_metadata?.full_name || 'User'}</p>
                  <p className="text-[11px] text-slate-400 mb-3 truncate w-full">{user?.email}</p>
                  
                  <button className="w-full py-2 rounded-xl text-[11px] font-bold bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white transition-all shadow-[0_0_15px_-3px_rgba(139,92,246,0.5)] flex items-center justify-center gap-2">
                    <Zap className="w-3.5 h-3.5 fill-white" /> Upgrade to PRO
                  </button>
                </div>

                {/* 2. ORTA KISIM: SUPABASE HESAP & KİMLİK AYARLARI */}
                <div className="p-1 space-y-0.5">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Account Access</div>
                  
                  {/* Birleştirilmiş Profil Butonu */}
                  <DropdownMenuItem onClick={() => setShowProfileSettings(true)} className="flex items-center gap-3 text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer px-3 py-2.5 text-[13px] rounded-lg font-medium transition-colors">
                    <User className="w-4 h-4 text-slate-400" /> Profile Settings
                  </DropdownMenuItem>
                </div>

                <DropdownMenuSeparator className="bg-white/5 my-1" />

                {/* 3. SİSTEM AYARLARI & GERİ BİLDİRİM */}
                <div className="p-1 space-y-0.5">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Preferences</div>
                  
                  {/* Genel Ayarlar */}
                  <DropdownMenuItem onClick={() => setShowSettings(true)} className="flex items-center gap-3 text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer px-3 py-2.5 text-[13px] rounded-lg font-medium transition-colors">
                    <Settings className="w-4 h-4 text-slate-400" /> Preferences & System
                  </DropdownMenuItem>

                  {/* Submit Feedback Butonu */}
                  <DropdownMenuItem onClick={() => setShowFeedback(true)} className="flex items-center gap-3 text-amber-400/90 hover:bg-amber-500/10 focus:bg-amber-500/10 cursor-pointer px-3 py-2.5 text-[13px] rounded-lg font-medium transition-colors">
                    <MessageSquare className="w-4 h-4 text-amber-400" /> Submit Feedback
                  </DropdownMenuItem>
                </div>

                <DropdownMenuSeparator className="bg-white/5 my-1" />
                
                {/* 4. ALT KISIM: GÜVENLİ ÇIKIŞ */}
                <div className="p-1">
                  <DropdownMenuItem onClick={async () => { if(typeof supabase !== 'undefined') { await supabase.auth.signOut(); window.location.href = '/login'; } }} className="flex items-center gap-3 text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 cursor-pointer px-3 py-2.5 text-[13px] rounded-lg font-bold transition-colors">
                    <LogOut className="w-4 h-4" /> Log out
                  </DropdownMenuItem>
                </div>

              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </div>
        </header>

        {/* ============================================================================ */}
        {/* PROFESYONEL SCROLLBAR VE İÇERİK HİZALAMA ALANI                               */}
        {/* ============================================================================ */}
        {/* [SİHİRLİ DOKUNUŞ]: Tailwind ile Webkit Scrollbar gizlendi, modern ve ince yapıldı */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full transition-colors">
          
          {/* MAX GENİŞLİK 1400px: Header ile birebir aynı hizada kalmasını sağlar */}
          <div className="px-8 lg:px-10 py-8 w-full max-w-[1400px] mx-auto">
            
            {/* ============================================================================ */}
            {/* VIEW: 1. DASHBOARD EKRANI                                                    */}
            {/* ============================================================================ */}
            {activeView === 'dashboard' ? (
              <div className="relative z-10 w-full space-y-8 pb-10">

                {/* "TODAY'S WORKSPACE" BAŞLIĞI */}
                <div>
                  <h1 className="text-[32px] font-black text-white tracking-tight">
                    Today's Workspace 👋
                  </h1>
                  <p className="text-slate-400 mt-2 text-[15px]">
                    Hello, {user?.user_metadata?.full_name?.split(' ')[0] || 'there'}! Continue where you left off.
                  </p>
                </div>

                {/* STAT CARDS (4 Sütunlu Grid) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  
                  {/* Kart 1 */}
                  <div className="bg-[#0A0A0F]/80 border border-white/5 rounded-3xl p-6 flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                      <Workflow className="w-6 h-6 text-violet-400"/>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[13px] font-medium">Workflows in Progress</p>
                      <h3 className="text-3xl font-black text-white">{workflows.length}</h3>
                      <p className="text-[12px] text-violet-400 mt-0.5">Active</p>
                    </div>
                  </div>
                  
                  {/* Kart 2 */}
                  <div className="bg-[#0A0A0F]/80 border border-white/5 rounded-3xl p-6 flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <RefreshCw className="w-6 h-6 text-blue-400"/>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[13px] font-medium">Prompts Reused</p>
                      <h3 className="text-3xl font-black text-white">{activePrompts.reduce((a,p) => a + p.use_count, 0)}</h3>
                      <p className="text-[12px] text-blue-400 mt-0.5">This week</p>
                    </div>
                  </div>
                  
                  {/* Kart 3 */}
                  <div className="bg-[#0A0A0F]/80 border border-white/5 rounded-3xl p-6 flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                      <LayoutGrid className="w-6 h-6 text-green-400"/>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[13px] font-medium">Prompts Generated</p>
                      <h3 className="text-3xl font-black text-white">{totalPrompts}</h3>
                      <p className="text-[12px] text-green-400 mt-0.5">This week</p>
                    </div>
                  </div>
                  
                  {/* Kart 4 */}
                  <div className="bg-[#0A0A0F]/80 border border-white/5 rounded-3xl p-6 flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Library className="w-6 h-6 text-amber-400"/>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[13px] font-medium">Outputs Generated</p>
                      <h3 className="text-3xl font-black text-white">{activeOutputs.length}</h3>
                      <p className="text-[12px] text-amber-400 mt-0.5">This week</p>
                    </div>
                  </div>

                </div>

                {/* ANA İÇERİK (Grid: Sol kolon geniş, sağ kolon dar) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* SOL KOLON (2 birim genişlikte) */}
                  <div className="lg:col-span-2 space-y-6">

                  {/* ACTIVE WORKFLOWS */}
                  <div className="bg-[#0A0A0F]/80 border border-white/5 rounded-3xl p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-[16px] font-bold text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-400"/> Active Workflows
                      </h2>
                      <button onClick={() => setNav('workflows')} className="text-[13px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
                        View all <ArrowRight className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                    <div className="space-y-4">
                      {workflows.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-white/10 rounded-2xl">
                          <p className="text-slate-500 text-[14px]">No active workflows yet.</p>
                          <button onClick={() => setNav('workflows')} className="mt-3 text-indigo-400 text-[13px] font-bold hover:text-indigo-300">
                            Create your first workflow →
                          </button>
                        </div>
                      ) : (workflows || []).slice(0, 3).map((wf, i) => {
                        const progress = Math.round(((i + 1) / Math.max(wf.steps.length, 1)) * 100)
                        return (
                          <div key={wf.id} className="bg-black/40 border border-white/5 rounded-2xl p-5 hover:border-indigo-500/30 transition-all group">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex-1 min-w-0 pr-4">
                                <h3 className="text-[15px] font-bold text-white truncate">{wf.title}</h3>
                                <p className="text-[12px] text-slate-500 mt-0.5 truncate">{wf.description}</p>
                              </div>
                              <button
                                onClick={() => startWorkflow(wf)}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[13px] font-bold flex items-center gap-2 transition-all shrink-0 opacity-0 group-hover:opacity-100"
                              >
                                <Play className="w-3.5 h-3.5 fill-current"/> Continue
                              </button>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{width: `${Math.min(progress, 100)}%`}}/>
                              </div>
                              <span className="text-[11px] text-slate-500 font-medium shrink-0">
                                Step {Math.min(i+1, wf.steps.length)} of {wf.steps.length}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* LATEST OUTPUTS */}
                  <div className="bg-[#0A0A0F]/80 border border-white/5 rounded-3xl p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-[16px] font-bold text-white flex items-center gap-2">
                        <Library className="w-5 h-5 text-pink-400"/> Latest Outputs
                      </h2>
                      <button onClick={() => setNav('outputs')} className="text-[13px] text-pink-400 hover:text-pink-300 font-medium flex items-center gap-1">
                        View all <ArrowRight className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                    {activeOutputs.length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-white/10 rounded-2xl">
                        <p className="text-slate-500 text-[14px]">No outputs saved yet.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {(activeOutputs || []).slice(0, 4).map((output) => (
                          <div key={output.id} onClick={() => setViewingOutput(output)} className="bg-black/40 border border-white/5 rounded-2xl p-5 hover:border-pink-500/30 cursor-pointer transition-all group">
                            <div className="flex items-center gap-2 mb-3">
                              <span className={`text-[10px] uppercase px-2.5 py-1 rounded-lg font-black border ${getPlatformStyle(output.platform)}`}>
                                {getPlatformLabel(output.platform)}
                              </span>
                              {output.is_pinned && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400"/>}
                            </div>
                            <p className="text-[13px] text-slate-300 line-clamp-3 leading-relaxed">{output.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* SAĞ KOLON */}
                <div className="space-y-6">

                  {/* PINNED PROMPTS */}
                  <div className="bg-[#0A0A0F]/80 border border-white/5 rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-[15px] font-bold text-white flex items-center gap-2">
                        <Pin className="w-4 h-4 text-violet-400"/> Pinned Prompts
                      </h2>
                      <button onClick={() => setNav('all')} className="text-[12px] text-slate-400 hover:text-white transition-colors">View all</button>
                    </div>
                    <div className="space-y-2">
                      {activePrompts.filter(p => p.is_pinned).length === 0 ? (
                        <p className="text-[13px] text-slate-500 text-center py-6">Pin prompts to see them here</p>
                      ) : activePrompts.filter(p => p.is_pinned).slice(0,5).map(p => (
                        <div key={p.id} onClick={() => openWorkspace(p)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer group transition-all">
                          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                            <BookOpen className="w-4 h-4 text-violet-400"/>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-slate-200 truncate group-hover:text-violet-300 transition-colors">{p.title}</p>
                            <p className="text-[11px] text-slate-500">{p.category}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* QUICK ACTIONS */}
                  <div className="bg-[#0A0A0F]/80 border border-white/5 rounded-3xl p-6">
                    <h2 className="text-[15px] font-bold text-white mb-5 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400"/> Quick Actions
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => { setShowAddPrompt(true); setEditingPrompt(null); setForm(emptyForm); }} className="flex flex-col items-center gap-2 p-4 bg-black/40 border border-white/5 rounded-2xl text-slate-400 hover:bg-violet-500/10 hover:border-violet-500/30 hover:text-violet-300 transition-all text-[12px] font-bold">
                        <Plus className="w-5 h-5"/>New Prompt
                      </button>
                      <button onClick={() => setNav('workflows')} className="flex flex-col items-center gap-2 p-4 bg-black/40 border border-white/5 rounded-2xl text-slate-400 hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-300 transition-all text-[12px] font-bold">
                        <Play className="w-5 h-5"/>Start Workflow
                      </button>
                      <button onClick={() => { if(editingPrompt) triggerAIOptimize() }} className="flex flex-col items-center gap-2 p-4 bg-black/40 border border-white/5 rounded-2xl text-slate-400 hover:bg-violet-500/10 hover:border-violet-500/30 hover:text-violet-300 transition-all text-[12px] font-bold">
                        <Wand2 className="w-5 h-5"/>AI Optimize
                      </button>
                      <button onClick={() => { setShowAddOutput(true); setOutputForm(emptyOutputForm); }} className="flex flex-col items-center gap-2 p-4 bg-black/40 border border-white/5 rounded-2xl text-slate-400 hover:bg-pink-500/10 hover:border-pink-500/30 hover:text-pink-300 transition-all text-[12px] font-bold">
                        <Save className="w-5 h-5"/>Save Output
                      </button>
                    </div>
                  </div>

                  {/* AI SUGGESTIONS */}
                  <div className="bg-[#0A0A0F]/80 border border-white/5 rounded-3xl p-6">
                    <h2 className="text-[15px] font-bold text-white mb-5 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-violet-400"/> AI Suggestions
                    </h2>
                    <div className="space-y-4">
                      {workflows.slice(0,1).map(wf => (
                        <div key={wf.id} className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4">
                          <p className="text-[12px] text-slate-300 mb-3">
                            Continue your <span className="text-indigo-400 font-bold">{wf.title}</span>. You stopped at Step 1.
                          </p>
                          <button onClick={() => startWorkflow(wf)} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[12px] font-bold transition-all">
                            Continue Workflow
                          </button>
                        </div>
                      ))}
                      {activePrompts.filter(p => !p.is_pinned).slice(0,1).map(p => (
                        <div key={p.id} className="bg-violet-500/5 border border-violet-500/20 rounded-2xl p-4">
                          <p className="text-[12px] text-slate-300 mb-3">
                            "<span className="text-violet-400 font-bold">{p.title}</span>" is frequently used. Pin it for quick access.
                          </p>
                          <button onClick={(e) => togglePinPrompt(p, e as any)} className="w-full py-2.5 bg-violet-600/30 hover:bg-violet-600/50 text-violet-300 rounded-xl text-[12px] font-bold transition-all">
                            Pin Prompt
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </div>

          ) :activeView === 'unified-prompt' ? (
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
  <button onClick={() => handleDeleteWorkflow(wf.id)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-5 py-3 rounded-xl flex items-center gap-2 text-[13px] font-semibold transition-all border border-transparent"><Trash2 className="w-4 h-4" /> Delete</button>
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
                    <div className="flex -space-x-2">
                      {(prompt.platforms ?? ['chatgpt']).slice(0,3).map((p: string) => (
                        <span key={p} className={`w-7 h-7 rounded-full border-2 border-[#0A0A0F] flex items-center justify-center text-[9px] font-bold uppercase shadow-md ${getPlatformStyle(p)}`} title={getPlatformLabel(p)}>
                          {p.substring(0,1)}
                        </span>
                      ))}
                      {(prompt.platforms ?? ['chatgpt']).length > 3 && (
                        <span className="w-7 h-7 rounded-full border-2 border-[#0A0A0F] bg-white/10 flex items-center justify-center text-[9px] font-bold text-slate-300 shadow-md">
                          +{(prompt.platforms ?? ['chatgpt']).length - 3}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] bg-white/10 border border-white/5 px-3 py-1.5 rounded-lg text-slate-300 ml-1 font-semibold shadow-sm">
                      {prompt.category ?? 'General'}
                    </span>
                    <button onClick={(e) => copyToClipboard(prompt.content, prompt.id, e)} className="ml-auto flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 hover:bg-violet-500/20 hover:text-violet-300 text-slate-400 transition-all border border-transparent hover:border-violet-500/30 shrink-0 shadow-sm">
                      {copiedId === prompt.id ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )} 
          </div>
          </div>
        </main>
        
      {/* 8. MODALLAR (OVERLAYS)                                                       */}
      {/* ============================================================================ */}
{/* ============================================================================ */}
      {/* ============================================================================ */}
      {/* WORKSPACE MODALLARI (GELİŞMİŞ EMOJİ, TIKLA KAPAN & PROFESYONEL SCROLL)       */}
      {/* ============================================================================ */}

      {/* 1. CREATE NEW WORKSPACE MODAL */}
      <Dialog open={showCreateWorkspace} onOpenChange={(open) => { setShowCreateWorkspace(open); if(!open) setShowNewIconPicker(false); }}>
        <DialogContent aria-describedby={undefined} className="bg-[#0A0A0F] border-white/10 rounded-3xl w-full max-w-md p-0 text-white shadow-2xl flex flex-col [&>button]:hidden">
          <div className="p-6 border-b border-white/5 bg-[#060609] flex justify-between items-center">
            <DialogTitle className="text-lg font-bold">Create Workspace</DialogTitle>
            <button onClick={() => setShowCreateWorkspace(false)} className="text-slate-500 hover:text-white"><XCircle size={18} /></button>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex flex-col items-center">
              <div className="relative">
                <button onClick={() => setShowNewIconPicker(!showNewIconPicker)} className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/30 flex items-center justify-center text-4xl shadow-xl hover:scale-105 transition-all group relative z-50">
                  {newWsIcon}
                  <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Camera size={20} className="text-white" /></div>
                </button>
                
                {/* İKON SEÇİCİ VE GÖRÜNMEZ KAPATMA ALANI */}
                {showNewIconPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNewIconPicker(false)} />
                    <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 w-[340px] p-4 bg-[#16161E] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95">
                      <div className="grid grid-cols-7 gap-2 max-h-[220px] overflow-y-auto overflow-x-hidden pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
                        {['😀','😂','🥰','😎','🤓','🤔','🤫','🤯','🥳','🥶','😈','👻','👽','🤖','💩','😺','🙈','🐶','🦊','🐱','🦁','🐯','🦄','🦓','🐷','🐘','🐭','🐰','🐻','🐼','🐾','🐦','🐧','🦅','🦆','🦉','🐸','🐢','🐍','🐳','🐬','🐟','🐙','🦋','🐛','🐝','🐞','🕷️','💐','🌸','🌹','🌺','🌻','🌼','🌷','🌱','🌲','🌴','🌵','🌿','🍁','🍂','🍇','🍉','🍊','🍋','🍌','🍍','🍎','🍏','🍒','🍓','🥝','🍅','🥑','🍆','🥔','🥕','🌽','🌶️','🥦','🍄','🍞','🥐','🥖','🥨','🧀','🍖','🍗','🥩','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🥚','🍳','🥗','🍿','🍱','🍘','🍙','🍚','🍜','🍝','🍠','🍣','🍤','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🍫','🍬','🍭','🍯','🍼','🥛','☕','🍵','🍶','🍾','🍷','🍸','🍹','🍺','🍻','🥂','🥃','🌍','🗺️','🏔️','🌋','🏕️','🏖️','🏝️','🏟️','🏛️','🏗️','🏠','🏡','🏢','🏥','🏦','🏨','🏫','🏭','🏰','⛩️','⛲','⛺','🌃','🏙️','🌄','🌅','🌆','🌇','🌉','🎠','🎡','🎢','🚂','🚄','🚆','🚇','🚋','🚌','🚑','🚒','🚓','🚕','🚗','🚜','🏎️','🏍️','🚲','🛴','🛣️','🛤️','⛽','🚨','🚥','🛑','⚓','⛵','🚤','🛳️','⛴️','✈️','🛩️','🛫','🛬','🚁','🚀','🛸','🌟','🌠','☁️','⛅','⛈️','🌤️','🌥️','🌦️','🌧️','🌨️','🌩️','🌪️','🌬️','🌈','☔','⚡','❄️','☃️','🔥','💧','🌊','💻','💡','🎯','💼','🛠️','🎨','🧠','🌐','📊','🛡️','⚙️','💰','📱','🕹️','🏆','💎','⭐','✨','🔐','🔑','🏷️','🔔','📢','💬','💭','✉️','📦','🎁'].map(emoji => (
                          <button key={emoji} onClick={() => { setNewWsIcon(emoji); setShowNewIconPicker(false); }} className="w-10 h-10 flex items-center justify-center text-2xl rounded-xl hover:bg-violet-500/20 transition-all hover:scale-110 shrink-0">{emoji}</button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Workspace Name</label>
              <input type="text" value={newWsName} onChange={(e) => setNewWsName(e.target.value)} placeholder="e.g. My Awesome Project" className="w-full bg-[#060609] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors" />
            </div>
          </div>
          <div className="p-6 border-t border-white/5 bg-[#060609] flex gap-3">
            <button onClick={() => setShowCreateWorkspace(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 transition-colors">Cancel</button>
            <button 
              disabled={submitting}
              onClick={handleCreateWorkspace} 
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-lg transition-all disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. WORKSPACE SETTINGS MODAL */}
      <Dialog open={showWorkspaceSettings} onOpenChange={(open) => { setShowWorkspaceSettings(open); if(!open) setShowIconPicker(false); }}>
        <DialogContent className="bg-[#0A0A0F] border-white/10 rounded-3xl !max-w-[700px] w-[90vw] p-0 text-white shadow-2xl flex flex-col [&>button]:hidden">
          <div className="px-8 py-5 border-b border-white/5 bg-[#060609] flex justify-between items-center shrink-0">
            <div>
              <DialogTitle className="text-lg font-bold">Workspace Settings</DialogTitle>
              <p className="text-xs text-slate-400 mt-1">Manage '{activeWorkspace.name}' preferences.</p>
            </div>
            <button onClick={() => setShowWorkspaceSettings(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors outline-none">
              <XCircle className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="p-8">
            <div className="flex items-start gap-8">
              {/* Sol: İkon Seçimi */}
              <div className="relative shrink-0 flex flex-col items-center">
                <button onClick={() => setShowIconPicker(!showIconPicker)} className="w-28 h-28 rounded-3xl bg-gradient-to-br from-violet-600/10 to-indigo-600/10 border-2 border-violet-500/20 flex items-center justify-center text-6xl shadow-xl hover:border-violet-500/50 hover:scale-105 transition-all group relative z-50">
                  {selectedWorkspaceIcon}
                  <div className="absolute inset-0 bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Camera size={24} className="text-white" /></div>
                </button>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-4">Change Icon</p>

                {/* İKON SEÇİCİ VE GÖRÜNMEZ KAPATMA ALANI */}
                {showIconPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowIconPicker(false)} />
                    <div className="absolute top-32 left-0 z-50 w-[360px] p-4 bg-[#16161E] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95">
                      <div className="grid grid-cols-7 gap-2 max-h-[240px] overflow-y-auto overflow-x-hidden pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
                        {['😀','😂','🥰','😎','🤓','🤔','🤫','🤯','🥳','🥶','😈','👻','👽','🤖','💩','😺','🙈','🐶','🦊','🐱','🦁','🐯','🦄','🦓','🐷','🐘','🐭','🐰','🐻','🐼','🐾','🐦','🐧','🦅','🦆','🦉','🐸','🐢','🐍','🐳','🐬','🐟','🐙','🦋','🐛','🐝','🐞','🕷️','💐','🌸','🌹','🌺','🌻','🌼','🌷','🌱','🌲','🌴','🌵','🌿','🍁','🍂','🍇','🍉','🍊','🍋','🍌','🍍','🍎','🍏','🍒','🍓','🥝','🍅','🥑','🍆','🥔','🥕','🌽','🌶️','🥦','🍄','🍞','🥐','🥖','🥨','🧀','🍖','🍗','🥩','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🥚','🍳','🥗','🍿','🍱','🍘','🍙','🍚','🍜','🍝','🍠','🍣','🍤','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🍫','🍬','🍭','🍯','🍼','🥛','☕','🍵','🍶','🍾','🍷','🍸','🍹','🍺','🍻','🥂','🥃','🌍','🗺️','🏔️','🌋','🏕️','🏖️','🏝️','🏟️','🏛️','🏗️','🏠','🏡','🏢','🏥','🏦','🏨','🏫','🏭','🏰','⛩️','⛲','⛺','🌃','🏙️','🌄','🌅','🌆','🌇','🌉','🎠','🎡','🎢','🚂','🚄','🚆','🚇','🚋','🚌','🚑','🚒','🚓','🚕','🚗','🚜','🏎️','🏍️','🚲','🛴','🛣️','🛤️','⛽','🚨','🚥','🛑','⚓','⛵','🚤','🛳️','⛴️','✈️','🛩️','🛫','🛬','🚁','🚀','🛸','🌟','🌠','☁️','⛅','⛈️','🌤️','🌥️','🌦️','🌧️','🌨️','🌩️','🌪️','🌬️','🌈','☔','⚡','❄️','☃️','🔥','💧','🌊','💻','💡','🎯','💼','🛠️','🎨','🧠','🌐','📊','🛡️','⚙️','💰','📱','🕹️','🏆','💎','⭐','✨','🔐','🔑','🏷️','🔔','📢','💬','💭','✉️','📦','🎁'].map(emoji => (
                          <button key={emoji} onClick={() => { setSelectedWorkspaceIcon(emoji); setShowIconPicker(false); }} className="w-10 h-10 flex items-center justify-center text-2xl rounded-xl hover:bg-violet-500/20 transition-all hover:scale-110 shrink-0">{emoji}</button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Sağ: İsim ve URL */}
              <div className="flex-1 space-y-5">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Workspace Name</label>
                  <input type="text" value={editWsName} onChange={(e) => setEditWsName(e.target.value)} className="w-full bg-[#060609] border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors shadow-inner font-medium" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Workspace URL</label>
                  <div className="flex items-center">
                    <span className="bg-white/5 border border-white/10 border-r-0 rounded-l-2xl px-4 py-3.5 text-sm text-slate-500 select-none">prompax.com/</span>
                    <input type="text" value={editWsName.toLowerCase().replace(/[^a-z0-9]/g, '-')} readOnly className="w-full bg-[#060609] border border-white/10 rounded-r-2xl px-4 py-3.5 text-sm text-slate-400 shadow-inner outline-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-8 py-5 border-t border-white/5 bg-[#060609] flex justify-end gap-3 shrink-0">
            <button onClick={() => setShowWorkspaceSettings(false)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors">Discard</button>
            <button 
              disabled={submitting}
              onClick={handleUpdateWorkspace} 
              className="px-8 py-2.5 rounded-xl text-sm font-black bg-violet-600 hover:bg-violet-500 text-white shadow-[0_10px_20px_-5px_rgba(139,92,246,0.4)] transition-all active:scale-95 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. DELETE WORKSPACE MODAL */}
      <Dialog open={showDeleteWorkspace} onOpenChange={setShowDeleteWorkspace}>
        <DialogContent className="bg-[#0A0A0F] border-red-500/30 rounded-3xl w-full max-w-md p-6 text-white shadow-[0_0_40px_-10px_rgba(239,68,68,0.2)]">
          <DialogTitle className="text-xl font-bold text-red-400 mb-2">Delete Workspace?</DialogTitle>
          <div className="space-y-4">
            <p className="text-sm text-slate-400 leading-relaxed">
              This action is <strong className="text-white">permanent</strong>. All your data in <span className="text-white font-bold">{activeWorkspace.name}</span> will be deleted forever.
            </p>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowDeleteWorkspace(false)} className="flex-1 px-4 py-3 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 transition-colors">Cancel</button>
              <button 
                disabled={submitting}
                onClick={handleDeleteWorkspace} 
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg transition-all disabled:opacity-50"
              >
                {submitting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
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
                {/* HATA 1 DÜZELTİLDİ: viewingOutput?.format? yerine viewingOutput.format */}
                {viewingOutput ? getFormatIcon(viewingOutput.format) : <Library className="w-6 h-6" />}
              </div>
              <div>
                <DialogTitle className="text-[20px] font-bold text-white capitalize tracking-tight">
                {/* EĞER format TANIMSIZSA ÇÖKMESİN DİYE GÜVENLİK EKLENDİ */}
                {viewingOutput?.format?.replace('_', ' ') || 'Unknown'} Output
                </DialogTitle>
                <p className="text-[13px] text-slate-400 mt-0.5">
                {/* HATA 2 DÜZELTİLDİ: viewingOutput?.platform? yerine viewingOutput.platform */}
                Generated via {viewingOutput ? getPlatformLabel(viewingOutput.platform) : 'Unknown Platform'}
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
              
              {viewingOutput?.prompt_id && activePrompts.find(p => p.id === viewingOutput?.prompt_id) ? (
                <div>
                  <h4 className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4 text-pink-400" /> Parent Prompt</h4>
                  <div className="bg-black/40 border border-white/10 rounded-2xl p-6 cursor-pointer hover:border-pink-500/40 transition-colors shadow-lg group" onClick={() => openWorkspace(activePrompts.find(p => p.id === viewingOutput?.prompt_id)!)}>
                    <h5 className="text-[15px] font-bold text-slate-200 mb-2 group-hover:text-pink-300 transition-colors">{activePrompts.find(p => p.id === viewingOutput?.prompt_id)?.title}</h5>
                    <p className="text-[13px] text-slate-500 line-clamp-5 leading-relaxed">{activePrompts.find(p => p.id === viewingOutput?.prompt_id)?.content}</p>
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
                  <p className="text-[14px] text-slate-300 leading-relaxed p-6 bg-black/40 rounded-2xl border border-white/10 shadow-inner">{viewingOutput?.notes}</p>
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
                {editingPrompt ? `Managing template: ${editingPrompt?.title}` : 'Build your custom prompt template from scratch'}
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
                    {activeOutputs.filter(o => o.prompt_id === editingPrompt?.id).length}
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
                    <h4 className="text-[14px] font-bold text-slate-400 uppercase tracking-wider mb-3">Original Prompt</h4>
                    
                    {/* ARAMA ÇUBUĞU */}
                    <div className="relative mb-3 group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-violet-400 transition-colors z-10" />
                      <input
                        type="text"
                        placeholder="Search in prompt..."
                        onChange={(e) => {
                          const searchTerm = e.target.value.toLowerCase()
                          const el = document.getElementById('optimize-original-content')
                          if (el) {
                            if (!searchTerm) {
                              el.innerHTML = form.content
                              return
                            }
                            const highlighted = form.content.replace(
                              new RegExp(`(${searchTerm})`, 'gi'),
                              '<mark style="background: rgba(139,92,246,0.4); color: white; border-radius: 3px; padding: 0 2px;">$1</mark>'
                            )
                            el.innerHTML = highlighted
                          }
                        }}
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-[13px] text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-all hover:border-white/20"
                      />
                    </div>

                    <div id="optimize-original-content" className={`p-6 bg-black/40 border border-white/5 rounded-3xl text-[14px] text-slate-300 whitespace-pre-wrap h-[260px] overflow-y-auto ${scrollbarClasses}`}>
                      {form.content}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-green-500/5 border border-green-500/20 p-6 rounded-3xl">
                      <h5 className="text-[13px] font-bold text-green-400 uppercase tracking-wider mb-3">Strengths</h5>
                      <ul className="list-disc pl-5 text-[13px] text-slate-300 space-y-2">
                        {optimizeResult?.strengths?.map(s => <li key={s}>{s}</li>)}
                      </ul>
                    </div>
                    <div className="bg-red-500/5 border border-red-500/20 p-6 rounded-3xl">
                      <h5 className="text-[13px] font-bold text-red-400 uppercase tracking-wider mb-3">Weaknesses</h5>
                      <ul className="list-disc pl-5 text-[13px] text-slate-300 space-y-2">
                        {optimizeResult?.weaknesses?.map(w => <li key={w}>{w}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="w-1/2 flex flex-col h-full border-l border-white/5 pl-10">
                  <h4 className="text-[15px] font-bold text-violet-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5"/> Optimized Prompt</h4>
                  <Textarea value={optimizeResult?.improved_prompt} onChange={e => setOptimizeResult(prev => ({...prev!, improved_prompt: e.target.value}))} className={`flex-1 bg-violet-500/5 border border-violet-500/20 text-[15px] p-8 resize-none focus-visible:ring-2 focus-visible:ring-violet-500/50 rounded-3xl text-slate-200 leading-relaxed font-serif ${scrollbarClasses}`} />
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

      {/* ============================================================================ */}
      {/* SETTINGS MODAL */}
      {/* ============================================================================ */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent aria-describedby={undefined} className="bg-[#0A0A0F] border-white/10 rounded-[32px] sm:max-w-[90vw] lg:max-w-[1100px] p-0 overflow-hidden shadow-2xl [&>button]:hidden">
          <DialogTitle className="sr-only">Platform Settings</DialogTitle>
          <SettingsView 
            user={user} 
            supabase={supabase} 
            onClose={() => setShowSettings(false)} 
            onUpdateUser={() => window.location.reload()}
          />
        </DialogContent>
      </Dialog>

      {/* ============================================================================ */}
      {/* PROFİL AYARLARI MODALI (Email & Şifre Değiştirme - Supabase Bağlantılı)      */}
      {/* ============================================================================ */}
      <Dialog open={showProfileSettings} onOpenChange={setShowProfileSettings}>
        <DialogContent aria-describedby={undefined} className="bg-[#0A0A0F] border-white/10 rounded-3xl sm:max-w-[450px] shadow-2xl p-8 text-white [&>button]:hidden">
          {/* Google OAuth Kontrolü (Google ile Giriş İstisnası) */}
          {(() => {
            const isGoogleUser = (user as any)?.app_metadata?.provider === 'google' || (user as any)?.identities?.[0]?.provider === 'google';
            
            return (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                    <User className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <DialogTitle className="text-[18px] font-bold text-white tracking-tight">Profile Settings</DialogTitle>
                    <p className="text-[12px] text-slate-400 mt-0.5">Manage your account credentials</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Email Değiştirme Alanı */}
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Email Address</label>
                    <div className="flex gap-2">
                      <Input 
                        value={newEmail} 
                        onChange={(e) => setNewEmail(e.target.value)}
                        disabled={isGoogleUser}
                        className="bg-black/40 border-white/10 text-white rounded-xl focus-visible:ring-1 focus-visible:ring-violet-500/50 disabled:opacity-40 disabled:cursor-not-allowed" 
                      />
                      <button 
                        onClick={handleUpdateEmail}
                        disabled={isGoogleUser}
                        className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[12px] font-bold transition-all text-slate-300 hover:text-white shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Update
                      </button>
                    </div>
                  </div>

                  <div className="h-px w-full bg-white/5"></div>

                  {/* Şifre Değiştirme Alanı / Google Giriş İstisnası Kapsamı */}
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Password Management</label>
                    
                    {isGoogleUser ? (
                      /* Google ile giriş yapanlara gösterilecek özel bilgilendirme kartı */
                      <div className="p-4 bg-violet-500/5 border border-violet-500/10 rounded-xl text-[12px] text-slate-400 leading-relaxed">
                        Your account is securely connected via <span className="text-violet-400 font-semibold">Google OAuth</span>. You can manage your email and password settings directly from your Google Account dashboard.
                      </div>
                    ) : (
                      /* Klasik mail/şifre ile girenlerin göreceği alan */
                      <div className="flex gap-2">
                        <Input 
                          type="password" 
                          placeholder="Enter new password" 
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="bg-black/40 border-white/10 text-white rounded-xl focus-visible:ring-1 focus-visible:ring-violet-500/50" 
                        />
                        <button 
                          onClick={handleChangePassword}
                          className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[12px] font-bold transition-all text-slate-300 hover:text-white shrink-0"
                        >
                          Change
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button onClick={() => setShowProfileSettings(false)} className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-[13px] transition-all shadow-[0_0_15px_-3px_rgba(139,92,246,0.4)]">Close</button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ============================================================================ */}
      {/* GERİ BİLDİRİM (FEEDBACK) MODALI                                              */}
      {/* ============================================================================ */}
      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent aria-describedby={undefined} className="bg-[#0A0A0F] border-white/10 rounded-3xl sm:max-w-[500px] shadow-2xl p-8 text-white [&>button]:hidden">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <MessageSquare className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-[18px] font-bold text-white tracking-tight">Submit Feedback</DialogTitle>
              <p className="text-[12px] text-slate-400 mt-0.5">Help us improve the product experience</p>
            </div>
          </div>
          
          <p className="text-[13px] text-slate-400 mb-6 leading-relaxed">
            We'd love to hear what went well or how we can improve the platform. Your feedback goes directly to our development workflow.
          </p>
          
          <Textarea 
            placeholder="Tell us your thoughts, report a bug, or suggest a feature..." 
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            className="w-full min-h-[160px] bg-black/40 border-white/10 text-slate-300 resize-y p-5 rounded-xl focus-visible:ring-1 focus-visible:ring-amber-500/50 mb-6" 
          />
          
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowFeedback(false)} className="px-5 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-colors text-[13px] font-bold">Cancel</button>
            <button onClick={handleFeedbackSubmit} className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[13px] shadow-[0_0_15px_-3px_rgba(245,158,11,0.4)] transition-all flex items-center gap-2">
              Send Feedback
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ADD/EDIT COLLECTION MODAL */}
      <Dialog open={showAddCollection} onOpenChange={(open) => { 
        if(!open) { 
          setShowAddCollection(false)
          setEditingCollection(null)
          setCollectionForm({name: '', description: ''})
        }
      }}>
        <DialogContent className="bg-[#0A0A0F] border-white/10 rounded-3xl w-full max-w-md p-0 text-white shadow-2xl [&>button]:hidden">
          <div className="p-6 border-b border-white/5 bg-[#060609] flex justify-between items-center">
            <div>
              <DialogTitle className="text-[18px] font-bold flex items-center gap-2">
                <Folder className="w-5 h-5 text-violet-400" />
                {editingCollection ? 'Edit Collection' : 'Create Collection'}
              </DialogTitle>
              <p className="text-[13px] text-slate-400 mt-1">
                {editingCollection ? 'Update collection details' : 'Organize your prompts into a collection'}
              </p>
            </div>
            <button 
              onClick={() => { setShowAddCollection(false); setEditingCollection(null); setCollectionForm({name: '', description: ''}); }} 
              className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
            >
              <XCircle className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {error && (
              <div className="flex items-center gap-3 text-[13px] font-medium text-red-400 bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}
            <div>
              <label className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                Collection Name
              </label>
              <Input 
                value={collectionForm.name} 
                onChange={e => setCollectionForm(f => ({...f, name: e.target.value}))} 
                placeholder="e.g. Marketing Prompts" 
                className="bg-[#060609] border-white/10 text-white h-12 text-[14px] focus-visible:ring-2 focus-visible:ring-violet-500/50" 
              />
            </div>
            <div>
              <label className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                Description <span className="text-[10px] text-slate-500 normal-case">Optional</span>
              </label>
              <Input 
                value={collectionForm.description} 
                onChange={e => setCollectionForm(f => ({...f, description: e.target.value}))} 
                placeholder="What is this collection for?" 
                className="bg-[#060609] border-white/10 text-white h-12 text-[14px] focus-visible:ring-2 focus-visible:ring-violet-500/50" 
              />
            </div>
          </div>

          <div className="p-6 border-t border-white/5 bg-[#060609] flex gap-3">
            <button 
              onClick={() => { setShowAddCollection(false); setEditingCollection(null); setCollectionForm({name: '', description: ''}); }} 
              className="flex-1 py-3 rounded-xl border border-white/10 text-[14px] font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSaveCollection} 
              disabled={submitting || !collectionForm.name.trim()} 
              className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-[14px] font-bold transition-all shadow-[0_0_15px_-3px_rgba(139,92,246,0.5)] disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingCollection ? 'Save Changes' : 'Create Collection'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* COLLECTION SHARE MODAL */}
      <Dialog open={!!shareModalCollection} onOpenChange={(open) => { if(!open) setShareModalCollection(null) }}>
        <DialogContent className="bg-[#0A0A0F] border-white/10 rounded-3xl w-full max-w-lg p-0 text-white shadow-2xl [&>button]:hidden">
          <div className="p-6 border-b border-white/5 bg-[#060609] flex justify-between items-center">
            <div>
              <DialogTitle className="text-[18px] font-bold flex items-center gap-2">
                <Share2 className="w-5 h-5 text-violet-400" /> Share Collection
              </DialogTitle>
              <p className="text-[13px] text-slate-400 mt-1">{shareModalCollection?.name}</p>
            </div>
            <button onClick={() => setShareModalCollection(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
              <XCircle className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            
            {/* Durum göstergesi */}
            <div className={`flex items-center gap-3 p-4 rounded-2xl border ${shareModalCollection?.is_public ? 'bg-green-500/5 border-green-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${shareModalCollection?.is_public ? 'bg-green-400' : 'bg-amber-400'}`} />
              <p className="text-[13px] font-medium text-slate-300">
                {shareModalCollection?.is_public 
                  ? 'This collection is public — anyone with the link can view and import it.'
                  : 'This collection is private — make it public to share.'}
              </p>
            </div>

            {/* Public/Private toggle */}
            <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
              <div>
                <p className="text-[14px] font-semibold text-white">Public Access</p>
                <p className="text-[12px] text-slate-500 mt-0.5">Allow anyone with the link to view</p>
              </div>
              <button
                onClick={() => shareModalCollection && handleToggleCollectionPublic(shareModalCollection).then(() => {
                  setShareModalCollection(prev => prev ? {...prev, is_public: !prev.is_public} : null)
                })}
                className={`relative w-12 h-6 rounded-full transition-all ${shareModalCollection?.is_public ? 'bg-violet-600' : 'bg-white/10'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${shareModalCollection?.is_public ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {/* Share link */}
            {shareModalCollection?.is_public && (
              <div>
                <label className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Share Link</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[13px] text-slate-300 font-mono truncate">
                    {typeof window !== 'undefined' ? `${window.location.origin}/share/${shareModalCollection.id}` : ''}
                  </div>
                  <button
                    onClick={() => shareModalCollection && handleCopyShareLink(shareModalCollection.id)}
                    className={`px-4 py-3 rounded-xl text-[13px] font-bold transition-all flex items-center gap-2 ${sharingCollectionId === shareModalCollection?.id ? 'bg-green-600 text-white' : 'bg-violet-600 hover:bg-violet-500 text-white'}`}
                  >
                    {sharingCollectionId === shareModalCollection?.id 
                      ? <><CheckCircle2 className="w-4 h-4" /> Copied!</>
                      : <><Copy className="w-4 h-4" /> Copy</>
                    }
                  </button>
                </div>
              </div>
            )}

            {/* Prompt sayısı */}
            <div className="flex items-center gap-3 p-4 bg-black/40 rounded-2xl border border-white/5">
              <BookOpen className="w-5 h-5 text-violet-400" />
              <div>
                <p className="text-[14px] font-semibold text-white">
                  {shareModalCollection ? activePrompts.filter(p => p.collection_id === shareModalCollection.id).length : 0} Prompts
                </p>
                <p className="text-[12px] text-slate-500">in this collection</p>
              </div>
            </div>

          </div>

          <div className="p-6 border-t border-white/5 bg-[#060609]">
            <button onClick={() => setShareModalCollection(null)} className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-[14px] font-bold transition-colors">
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}