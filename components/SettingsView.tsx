import React, { useState, useEffect } from 'react';
import { User, CreditCard, Settings2, Database, ShieldAlert, LogOut, ExternalLink, CheckCircle2, Loader2, Key, BrainCircuit, Bell, Download } from 'lucide-react';

interface SettingsProps {
  user: any;
  supabase: any;
  onClose: () => void;
  onUpdateUser?: () => void; // Dashboard'daki ismi güncellemek için
}

export default function SettingsView({ user, supabase, onClose, onUpdateUser }: SettingsProps) {
  const [activeTab, setActiveTab] = useState('account');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  // Profil Verilerini Çek
  useEffect(() => {
    async function fetchProfile() {
      const { data } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
      if (data) setProfile(data);
    }
    fetchProfile();
  }, [user, supabase]);

  const menuItems = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
    { id: 'preferences', label: 'Preferences', icon: Settings2 },
    { id: 'global_context', label: 'Global AI Context', icon: BrainCircuit },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'data', label: 'Data & Export', icon: Database },
  ];

  return (
    <div className="flex h-[85vh] w-full bg-[#060609] text-slate-200 font-sans overflow-hidden">
      {/* SOL MENÜ */}
      <div className="w-64 bg-[#0A0A0F] border-r border-white/5 p-6 flex flex-col">
        <h2 className="text-[18px] font-bold text-white mb-8 px-2 tracking-tight">Settings</h2>
        <nav className="flex-1 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-medium transition-all ${
                  activeTab === item.id ? 'bg-violet-600/10 text-violet-400 border border-violet-500/20' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" /> {item.label}
              </button>
            );
          })}
        </nav>
        <div className="pt-6 border-t border-white/5 mt-auto">
          <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>

      {/* SAĞ İÇERİK */}
      <div className="flex-1 overflow-y-auto bg-[#060609] p-10 custom-scrollbar">
        {activeTab === 'account' && <AccountSection user={user} profile={profile} supabase={supabase} setProfile={setProfile} onUpdateUser={onUpdateUser} />}
        {activeTab === 'subscription' && <SubscriptionSection />}
        {activeTab === 'preferences' && <PreferencesSection user={user} profile={profile} supabase={supabase} setProfile={setProfile} />}
        {activeTab === 'data' && <DataSection supabase={supabase} user={user} />}
        {activeTab === 'global_context' && <GlobalContextSection user={user} profile={profile} supabase={supabase} setProfile={setProfile} />}
        {activeTab === 'integrations' && <IntegrationsSection user={user} supabase={supabase} />}
        {activeTab === 'notifications' && <NotificationsSection user={user} profile={profile} supabase={supabase} setProfile={setProfile} />}
      </div>
    </div>
  );
}

// --- ALT BÖLÜMLER ---

function AccountSection({ user, profile, supabase, setProfile, onUpdateUser }: any) {
  const [name, setName] = useState(profile?.full_name || '');
  const [saving, setSaving] = useState(false);

  const updateProfile = async () => {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ full_name: name }).eq('id', user.id);
    // Aynı zamanda Auth metadata'yı da güncelle (Dashboard için)
    await supabase.auth.updateUser({ data: { full_name: name } });
    
    if (!error) {
      setProfile({ ...profile, full_name: name });
      if(onUpdateUser) onUpdateUser();
      alert("Profile updated!");
    }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl space-y-8 animate-in fade-in duration-300">
      <h3 className="text-[20px] font-bold text-white">Account Settings</h3>
      <div className="bg-[#0A0A0F] border border-white/5 rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-[12px] text-slate-500 mb-2 font-bold uppercase">Full Name</label>
          <input value={name} onChange={e => setName(e.target.value)} type="text" className="w-full bg-[#060609] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-violet-500 outline-none" />
        </div>
        <div>
          <label className="block text-[12px] text-slate-500 mb-2 font-bold uppercase">Email Address</label>
          <input disabled value={user?.email} type="email" className="w-full bg-[#060609]/50 border border-white/5 rounded-xl px-4 py-3 text-slate-500" />
        </div>
        <button onClick={updateProfile} disabled={saving} className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-[13px] font-bold transition-all flex items-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Changes
        </button>
      </div>
    </div>
  );
}

function SubscriptionSection() {
  return (
    <div className="max-w-2xl space-y-6 animate-in fade-in duration-300">
      <h3 className="text-[20px] font-bold text-white">Subscription</h3>
      <div className="bg-gradient-to-br from-violet-600/10 to-indigo-600/5 border border-violet-500/20 rounded-3xl p-8">
        <span className="px-3 py-1 bg-violet-500/20 text-violet-400 text-[10px] font-black uppercase rounded-lg border border-violet-500/20">Free Plan</span>
        <h4 className="text-3xl font-black text-white mt-4 mb-2">Prompax Starter</h4>
        <p className="text-slate-400 text-sm mb-8">You can create up to 50 prompts and 2 workspaces.</p>
        
        <div className="space-y-2 mb-8">
          <div className="flex justify-between text-xs font-bold"><span className="text-slate-500 uppercase">Usage</span><span className="text-violet-400">12 / 50</span></div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]" style={{width: '24%'}}></div></div>
        </div>
        <button className="w-full py-4 bg-white text-black rounded-2xl font-black hover:bg-slate-200 transition-all shadow-xl">Upgrade to PRO</button>
      </div>
    </div>
  );
}

// "user" eklendi
function PreferencesSection({ user, profile, supabase, setProfile }: any) {
  const updatePref = async (field: string, value: string) => {
    // update ve profile.id kısımları değişti
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, [field]: value });
      
    if (!error) setProfile({ ...profile, [field]: value });
  };

  return (
    <div className="max-w-2xl space-y-8 animate-in fade-in duration-300">
      <h3 className="text-[20px] font-bold text-white">Preferences</h3>
      <div className="bg-[#0A0A0F] border border-white/5 rounded-2xl p-6 space-y-6 text-sm">
        <div className="flex items-center justify-between">
          <div><p className="font-bold">Default Platform</p><p className="text-xs text-slate-500">Workspace loads this by default.</p></div>
          <select 
  value={profile?.default_platform || 'chatgpt'} 
  onChange={e => updatePref('default_platform', e.target.value)} 
  className="bg-[#060609] border border-white/10 rounded-lg p-2 text-white"
>
            <option value="chatgpt">ChatGPT</option>
            <option value="claude">Claude</option>
            <option value="gemini">Gemini</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <div><p className="font-bold">Language</p><p className="text-xs text-slate-500">Dashboard interface language.</p></div>
          <select 
  value={profile?.language || 'en'} 
  onChange={e => updatePref('language', e.target.value)} 
  className="bg-[#060609] border border-white/10 rounded-lg p-2 text-white"
>
            <option value="en">English</option>
            <option value="tr">Turkish</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function DataSection({ supabase, user }: any) {
  const [exporting, setExporting] = useState(false);

  // 1. GERÇEK DIŞA AKTARMA (EXPORT) MANTIĞI
  const handleExport = async () => {
    setExporting(true);
    try {
      // Sadece bu kullanıcıya ait verileri çekiyoruz
      const { data: prompts } = await supabase.from('prompts').select('*').eq('user_id', user.id);
      const { data: outputs } = await supabase.from('outputs').select('*').eq('user_id', user.id);
      
      const exportData = {
        export_date: new Date().toISOString(),
        prompts: prompts || [],
        outputs: outputs || []
      };

      // Tarayıcıda anında JSON dosyası oluşturup indirme tetiklemesi
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prompax_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert("Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const clearPrompts = async () => {
    if(!confirm("DELETE ALL YOUR PROMPTS? This cannot be undone.")) return;
    await supabase.from('prompts').delete().eq('user_id', user.id);
    alert("All prompts cleared.");
  };

  return (
    <div className="max-w-2xl space-y-8 animate-in fade-in duration-300">
      <h3 className="text-[20px] font-bold text-white">Data & Privacy</h3>
      
      <div className="bg-[#0A0A0F] border border-white/5 rounded-2xl p-6">
        <h4 className="text-[14px] font-bold text-slate-300 mb-1">Export Data</h4>
        <p className="text-[12px] text-slate-500 mb-4">Download all your prompts and outputs as a JSON file for backup.</p>
        <button onClick={handleExport} disabled={exporting} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[13px] font-bold transition-colors flex items-center gap-2 text-white">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 
          {exporting ? 'Exporting...' : 'Export All Data'}
        </button>
      </div>

      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          <h4 className="text-[14px] font-bold text-red-400">Danger Zone</h4>
        </div>
        <p className="text-[12px] text-slate-400 mb-5">Once you delete your data, there is no going back. Please be certain.</p>
        
        <div className="flex gap-4">
          <button onClick={clearPrompts} className="px-5 py-2.5 bg-[#060609] border border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-xl text-[13px] font-bold transition-colors">Clear All Prompts</button>
          <button className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[13px] font-bold transition-colors shadow-lg">Delete Account</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// YENİ EKLENEN BÖLÜMLER
// ============================================================================

// "user" eklendi
function GlobalContextSection({ user, profile, supabase, setProfile }: any) {
  const [context, setContext] = useState(profile?.global_context || '');
  const [saving, setSaving] = useState(false);

  const saveContext = async () => {
    setSaving(true);
    // update ve profile.id kısımları değişti
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, global_context: context });
      
    if (!error) {
      setProfile({ ...profile, global_context: context });
      alert("Global context saved successfully!");
    }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-[20px] font-bold text-white mb-2">Global AI Context</h3>
        <p className="text-[13px] text-slate-400">Define system-level instructions that will be silently applied to all your prompts.</p>
      </div>
      
      <div className="bg-[#0A0A0F] border border-white/5 rounded-2xl p-6 space-y-4">
        <textarea 
          value={context} 
          onChange={e => setContext(e.target.value)} 
          placeholder="e.g. 'I am a digital marketing specialist. Always reply in Turkish, use a professional tone, and format the output with Markdown tables if data is present.'"
          className="w-full bg-[#060609] border border-white/10 rounded-xl px-4 py-4 text-[14px] text-white focus:border-violet-500 outline-none min-h-[200px] resize-y custom-scrollbar"
        />
        <div className="flex justify-end">
          <button onClick={saveContext} disabled={saving} className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-[13px] font-bold transition-all flex items-center gap-2 text-white">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Context
          </button>
        </div>
      </div>
    </div>
  );
}

function IntegrationsSection({ user, supabase }: any) {
  const [keys, setKeys] = useState({ openai: '', anthropic: '', webhook: '' });
  const [saving, setSaving] = useState(false);

  // Mevcut anahtarları çek (Görüntüleme amaçlı sadece varlığını kontrol etmek güvenlidir ama şimdilik doğrudan çekiyoruz)
  useEffect(() => {
    async function fetchKeys() {
      const { data } = await supabase.from('api_keys').select('provider, key_value').eq('user_id', user.id);
      if (data) {
        const keyMap: any = { openai: '', anthropic: '', webhook: '' };
        data.forEach((k: any) => { keyMap[k.provider] = k.key_value });
        setKeys(keyMap);
      }
    }
    fetchKeys();
  }, [user.id, supabase]);

  const saveKey = async (provider: string, value: string) => {
    setSaving(true);
    // Upsert mantığı: Varsa güncelle, yoksa ekle
    const { error } = await supabase.from('api_keys').upsert({
      user_id: user.id,
      provider: provider,
      key_value: value
    }, { onConflict: 'user_id, provider' });
    
    if (!error) alert(`${provider.toUpperCase()} saved successfully!`);
    else alert("Error saving key: " + error.message);
    setSaving(false);
  };

  return (
    <div className="max-w-2xl space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-[20px] font-bold text-white mb-2">API & Integrations</h3>
        <p className="text-[13px] text-slate-400">Bring your own keys to remove generation limits or connect custom webhooks.</p>
      </div>
      
      <div className="space-y-4">
        {/* OpenAI */}
        <div className="bg-[#0A0A0F] border border-white/5 rounded-2xl p-6 flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-[12px] text-slate-500 mb-2 font-bold uppercase">OpenAI API Key</label>
            <input type="password" value={keys.openai} onChange={e => setKeys({...keys, openai: e.target.value})} placeholder="sk-..." className="w-full bg-[#060609] border border-white/10 rounded-xl px-4 py-3 text-[14px] text-white focus:border-violet-500 outline-none" />
          </div>
          <button onClick={() => saveKey('openai', keys.openai)} className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[13px] font-bold transition-all text-white">Save</button>
        </div>

        {/* Custom Webhook (n8n, Make vs.) */}
        <div className="bg-[#0A0A0F] border border-white/5 rounded-2xl p-6 flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-[12px] text-slate-500 mb-2 font-bold uppercase">Automation Webhook URL</label>
            <input type="url" value={keys.webhook} onChange={e => setKeys({...keys, webhook: e.target.value})} placeholder="https://hook.us1.make.com/... or n8n webhook" className="w-full bg-[#060609] border border-white/10 rounded-xl px-4 py-3 text-[14px] text-white focus:border-violet-500 outline-none" />
          </div>
          <button onClick={() => saveKey('webhook', keys.webhook)} className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[13px] font-bold transition-all text-white">Save</button>
        </div>
      </div>
    </div>
  );
}

// "user" eklendi
function NotificationsSection({ user, profile, supabase, setProfile }: any) {
  const updateToggle = async (field: string, value: boolean) => {
    
    // update yerine upsert, profile.id yerine user.id kullanıyoruz
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, [field]: value }); 

    if (!error) {
      setProfile({ ...profile, [field]: value });
    } else {
      alert("Hata oluştu: " + error.message);
    }
  };

  return (
    <div className="max-w-2xl space-y-8 animate-in fade-in duration-300">
      <h3 className="text-[20px] font-bold text-white">Notification Preferences</h3>
      <div className="bg-[#0A0A0F] border border-white/5 rounded-2xl p-6 space-y-6">
        
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-white text-[14px]">System & Limit Alerts</p>
            <p className="text-[12px] text-slate-500">Get notified when you reach 80% of your prompt limit.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
  type="checkbox" 
  className="sr-only peer" 
  checked={profile?.email_notifications || false} 
  onChange={(e) => updateToggle('email_notifications', e.target.checked)} 
/>
            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-white text-[14px]">Product Updates</p>
            <p className="text-[12px] text-slate-500">Receive news about new AI models and features.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
  type="checkbox" 
  className="sr-only peer" 
  checked={profile?.marketing_emails || false} 
  onChange={(e) => updateToggle('marketing_emails', e.target.checked)} 
/>
            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
          </label>
        </div>

      </div>
    </div>
  );
}