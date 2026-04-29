import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, Building2, Plus, X, Users, CreditCard, Package, Check, XCircle, Eye, EyeOff } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { authApi, tenantsApi, leadsApi, plansApi, settingsApi } from './api';
import logo from './assets/logo.png';

const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => sessionStorage.getItem('sa_auth') === 'true');
  const login = () => { sessionStorage.setItem('sa_auth', 'true'); setIsAuthenticated(true); };
  const logout = async () => { try { await authApi.logout(); } catch (e) { } localStorage.removeItem('pf_sa_token'); sessionStorage.removeItem('sa_auth'); setIsAuthenticated(false); };
  return { isAuthenticated, login, logout };
};

function Login({ onLogin }: { onLogin: () => void }) {
  const [login, setLogin] = useState(''); const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const res = await authApi.login({ login, password });
      if (res.data?.token) {
        localStorage.setItem('pf_sa_token', res.data.token);
      }
      onLogin();
    }
    catch (err: any) { setError(err.response?.data?.message || 'Login xatosi'); }
    finally { setLoading(false); }
  };
  return (
    <div className="pf-super-login-wrapper" style={{ 
      position: 'fixed', 
      inset: 0, 
      width: '100vw', 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: '#f8fafc',
      zIndex: 9999,
      overflow: 'hidden'
    }}>
      {/* Background Grid */}
      <div style={{ 
        position: 'absolute', 
        inset: 0, 
        backgroundImage: 'linear-gradient(rgba(255,107,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,107,0,0.1) 1px, transparent 1px)', 
        backgroundSize: '60px 60px', 
        zIndex: 0 
      }} />
      
      <div className="pf-super-login-card" style={{ 
        position: 'relative', 
        zIndex: 10,
        width: '100%',
        maxWidth: '440px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        padding: '50px 40px',
        borderRadius: '30px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
        textAlign: 'center'
      }}>
        <div className="pf-super-login-header" style={{ marginBottom: '40px' }}>
          <div style={{ 
            position: 'relative', 
            width: '100px', 
            height: '100px', 
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{ 
              position: 'absolute', 
              inset: 0, 
              backgroundColor: 'rgba(255,107,0,0.12)', 
              borderRadius: '50%', 
              filter: 'blur(20px)' 
            }} />
            <img 
              src={logo} 
              alt="PrintFlow" 
              style={{ 
                position: 'relative', 
                width: '85px', 
                height: '85px', 
                objectFit: 'contain',
                filter: 'drop-shadow(0 8px 12px rgba(255,107,0,0.25))'
              }} 
            />
          </div>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: 900, 
            textTransform: 'uppercase', 
            letterSpacing: '-1.5px',
            margin: '0 0 8px 0',
            color: '#0f172a'
          }}>
            Print<span style={{ color: '#FF6B00' }}>Flow</span>
          </h1>
          <p style={{ 
            fontSize: '11px', 
            letterSpacing: '4px', 
            fontWeight: 900, 
            color: '#64748b',
            margin: 0,
            textTransform: 'uppercase'
          }}>SUPER ADMIN PANEL</p>
        </div>

        {error && (
          <div style={{ 
            backgroundColor: 'rgba(239,68,68,0.1)', 
            color: '#ef4444', 
            padding: '12px', 
            borderRadius: '12px', 
            fontSize: '12px', 
            fontWeight: 800, 
            marginBottom: '24px',
            textTransform: 'uppercase'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ textAlign: 'left' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '10px', 
              fontWeight: 900, 
              textTransform: 'uppercase', 
              letterSpacing: '1px', 
              color: '#64748b',
              marginBottom: '8px',
              paddingLeft: '4px'
            }}>Login Ma'lumoti</label>
            <input 
              type="text" 
              required 
              placeholder="Admin login..."
              style={{
                width: '100%',
                height: '56px',
                backgroundColor: '#f8fafc',
                border: '2px solid #f1f5f9',
                borderRadius: '16px',
                padding: '0 20px',
                fontSize: '15px',
                fontWeight: 600,
                outline: 'none',
                transition: 'all 0.2s'
              }}
              value={login} 
              onChange={e => setLogin(e.target.value)} 
            />
          </div>
          <div style={{ textAlign: 'left' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '10px', 
              fontWeight: 900, 
              textTransform: 'uppercase', 
              letterSpacing: '1px', 
              color: '#64748b',
              marginBottom: '8px',
              paddingLeft: '4px'
            }}>Maxfiy Parol</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                required 
                placeholder="••••••••"
                style={{
                  width: '100%',
                  height: '56px',
                  backgroundColor: '#f8fafc',
                  border: '2px solid #f1f5f9',
                  borderRadius: '16px',
                  padding: '0 50px 0 20px',
                  fontSize: '15px',
                  fontWeight: 600,
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                value={password} 
                onChange={e => setPassword(e.target.value)} 
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px'
                }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <button 
            type="submit" 
            disabled={loading} 
            style={{ 
              width: '100%',
              height: '56px',
              backgroundColor: '#FF6B00',
              color: '#ffffff',
              border: 'none',
              borderRadius: '16px',
              fontSize: '13px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              cursor: 'pointer',
              boxShadow: '0 10px 20px -5px rgba(255,107,0,0.3)',
              transition: 'all 0.2s',
              marginTop: '8px'
            }}
          >
            {loading ? 'YUKLANMOQDA...' : 'TIZIMGA KIRISH'}
          </button>
        </form>

        <div style={{ marginTop: '40px' }}>
          <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px' }}>
            © 2026 PRINTFLOW SaaS CORE • v2.5.0
          </p>
        </div>
      </div>
    </div>
  );
}

function Layout({ onLogout, children }: { onLogout: () => void, children: React.ReactNode }) {
  const location = useLocation();
  const navItems = [
    { path: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { path: '/tenants', icon: <Building2 size={18} />, label: 'Workspaces' },
    { path: '/plans', icon: <Package size={18} />, label: 'Tariflar' },
    { path: '/payments', icon: <CreditCard size={18} />, label: "To'lovlar" },
    { path: '/leads', icon: <Users size={18} />, label: "So'rovlar" },
  ];
  return (
    <div className="admin-container">
      <div className="sidebar" style={{ borderRight: '1px solid var(--border)', boxShadow: '4px 0 24px rgba(0,0,0,0.02)' }}>
        <div className="sidebar-header" style={{ borderBottom: '1px solid var(--border)' }}>
          <img src={logo} alt="PF" style={{ height: 32, width: 'auto', marginRight: 12, filter: 'drop-shadow(0 4px 6px rgba(255,107,0,0.2))' }} />
          Print<span style={{ color: 'var(--primary)' }}>Flow</span>
        </div>
        <div className="sidebar-nav">
          <div style={{ padding: '0 16px 12px 28px', fontSize: '9px', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '2px', textTransform: 'uppercase' }}>Boshqaruv</div>
          {navItems.map(n => (
            <a key={n.path} href={n.path} className={`nav-item ${location.pathname === n.path ? 'active' : ''}`}>
              {n.icon}
              <span style={{ marginTop: '1px' }}>{n.label}</span>
            </a>
          ))}
        </div>
        <div style={{ padding: '24px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
           <p style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '1px' }}>v2.4.0 CORE</p>
        </div>
      </div>
      <div className="main-content">
        <div className="topbar" style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 40 }}>
          <div className="page-title" style={{ letterSpacing: '-0.5px' }}>
            {navItems.find(n => n.path === location.pathname)?.label || 'Boshqaruv Paneli'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
            <button className="logout-btn" onClick={onLogout} style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800 }}>
              <LogOut size={14} strokeWidth={3} /> Chiqish
            </button>
          </div>
        </div>
        <div className="content-area">{children}</div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [stats, setStats] = useState<any>({});
  useEffect(() => { tenantsApi.getStats().then(r => setStats(r.data)).catch(console.error); }, []);

  const cards = [
    { label: 'Jami Workspacelar', value: stats.totalTenants || 0 },
    { label: 'Faol', value: stats.activeTenants || 0 },
    { label: 'Yangi So\'rovlar (Leads)', value: stats.totalLeads || 0 },
    { label: "Kutilayotgan to'lovlar", value: stats.pendingPayments || 0 },
    { label: 'Jami daromad (UZS)', value: (stats.totalRevenue || 0).toLocaleString() },
    { label: 'Jami xodimlar', value: stats.totalEmployees || 0 },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24, fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase' }}>Statistika</h2>
      <div className="stats-grid" style={{ marginBottom: 32 }}>
        {cards.map((c, i) => (<div key={i} className="stat-card"><div className="stat-title">{c.label}</div><div className="stat-value">{c.value}</div></div>))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
        <div style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid var(--border)' }}>
          <h3 style={{ marginBottom: 16, fontSize: '1.1rem', fontWeight: 800 }}>Oylik Daromad (MRR)</h3>
          <div style={{ height: 300 }}>
            {stats.revenueChart && stats.revenueChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.revenueChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `${val / 1000}k`} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="amount" name="Daromad (UZS)" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Ma'lumot yo'q</div>}
          </div>
        </div>

        <div style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid var(--border)' }}>
          <h3 style={{ marginBottom: 16, fontSize: '1.1rem', fontWeight: 800 }}>Workspace Holatlari</h3>
          <div style={{ height: 300 }}>
            {stats.statusDistribution && stats.statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.statusDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {stats.statusDistribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Ma'lumot yo'q</div>}
            {stats.statusDistribution && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 16 }}>
                {stats.statusDistribution.map((s: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: s.color }} /> {s.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid var(--border)' }}>
          <h3 style={{ marginBottom: 16, fontSize: '1.1rem', fontWeight: 800 }}>Yangi Workspacelar</h3>
          <div style={{ height: 250 }}>
            {stats.tenantGrowthChart && stats.tenantGrowthChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.tenantGrowthChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="Yangi Tenantlar" stroke="#FF6B00" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Ma'lumot yo'q</div>}
          </div>
        </div>

        <div style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid var(--border)' }}>
          <h3 style={{ marginBottom: 16, fontSize: '1.1rem', fontWeight: 800 }}>Demo So'rovlar (Leads)</h3>
          <div style={{ height: 250 }}>
            {stats.leadsChart && stats.leadsChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.leadsChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="So'rovlar" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Ma'lumot yo'q</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== FEATURE KEYS (Granular) ==========
const PLAN_FEATURES = [
  {
    category: 'Moliya & Kassa',
    features: [
      { key: 'finance', label: "Moliya bo'limi (Dashboard)" },
      { key: 'canViewFinance', label: "Moliyani ko'rish" },
      { key: 'canAddIncome', label: "Kirim qo'shish" },
      { key: 'canAddExpense', label: "Chiqim qo'shish" },
      { key: 'canViewTotalBalance', label: "Kassa qoldig'ini ko'rish" },
      { key: 'canManagePaymentTypes', label: "To'lov turlarini boshqarish" },
    ]
  },
  {
    category: 'Xizmatlar (Kanban)',
    features: [
      { key: 'kanban', label: "Kanban (Buyurtmalar) bo'limi" },
      { key: 'canViewTasks', label: "Topshiriqlarni ko'rish" },
      { key: 'canCreateTask', label: "Yangi topshiriq yaratish" },
      { key: 'canEditTask', label: "Topshiriqni tahrirlash" },
      { key: 'canDeleteTask', label: "Topshiriqni o'chirish" },
      { key: 'canMoveTask', label: "Bosqichdan bosqichga o'tkazish" },
      { key: 'canManageColumns', label: "Bosqichlarni boshqarish" },
    ]
  },
  {
    category: 'Mijozlar',
    features: [
      { key: 'customers', label: "Mijozlar bo'limi" },
      { key: 'canViewCustomers', label: "Mijozlar ro'yxatini ko'rish" },
      { key: 'canManageCustomers', label: "Mijozlarni boshqarish" },
    ]
  },
  {
    category: 'Ombor & Inventar',
    features: [
      { key: 'warehouse', label: "Ombor bo'limi" },
      { key: 'canViewInventory', label: "Omborni ko'rish" },
      { key: 'canManageInventory', label: "Omborni boshqarish" },
    ]
  },
  {
    category: 'Davomat',
    features: [
      { key: 'attendance', label: "Davomat bo'limi" },
      { key: 'canViewAttendance', label: "Davomatni ko'rish" },
      { key: 'canManageAttendance', label: "Davomatni boshqarish" },
    ]
  },
  {
    category: 'Xizmatlar Katalogi & Tizim',
    features: [
      { key: 'employees', label: "Xodimlar bo'limi" },
      { key: 'canViewEmployees', label: "Xodimlarni ko'rish" },
      { key: 'canManageEmployees', label: "Xodimlarni boshqarish" },
      { key: 'canManageRoles', label: "Lavozimlarni boshqarish" },
      { key: 'canViewSalary', label: "Maoshlarni ko'rish" },
      { key: 'canViewServices', label: "Xizmatlar katalogni ko'rish" },
      { key: 'canManageServices', label: "Xizmatlar katalogni boshqarish" },
    ]
  },
  {
    category: '🚀 Premium Modullar',
    features: [
      { key: 'telegram_bot', label: 'Telegram Bot (Asosiy xabarlar)' },
      { key: 'advancedBot', label: '⚡ Kengaytirilgan Bot (Hisobotlar, Ogohlantirishlar)' },
      { key: 'kpiTracking', label: '📊 KPI Tahlili (Xodimlar samaradorligi)' },
      { key: 'expenseAnalytics', label: '📈 Chiqim Tahlili (Kategoriyalar grafigi)' },
      { key: 'multiBranch', label: '🏢 Multi-Filial (Ko\'p ofis boshqaruvi)' },
      { key: 'tasks', label: 'Task Management (Vazifalar)' },
      { key: 'debtors', label: 'Qarzdorlarga avto-xabar' },
    ]
  }
];

const ALL_FEATURES_KEYS = PLAN_FEATURES.flatMap(g => g.features.map(f => f.key));

function Plans() {
  const [plans, setPlans] = useState<any[]>([]); const [showModal, setShowModal] = useState(false); const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', displayName: '', price3m: 0, price6m: 0, price12m: 0, maxEmployees: 8, description: '', isPopular: false, sortOrder: 0, features: {} as Record<string, boolean> });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');

  const load = () => plansApi.findAll().then(r => setPlans(r.data)).catch(console.error);
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    const features: Record<string, boolean> = {}; ALL_FEATURES_KEYS.forEach(k => features[k] = false);
    setForm({ name: '', displayName: '', price3m: 0, price6m: 0, price12m: 0, maxEmployees: 8, description: '', isPopular: false, sortOrder: 0, features });
    setEditing(null); setErrorMsg(''); setShowModal(true);
  };
  const openEdit = (p: any) => {
    let features: Record<string, boolean> = {}; try { const parsed = JSON.parse(p.features); ALL_FEATURES_KEYS.forEach(k => features[k] = !!parsed[k]); } catch { ALL_FEATURES_KEYS.forEach(k => features[k] = false); }
    setForm({ name: p.name, displayName: p.displayName, price3m: p.price3m, price6m: p.price6m, price12m: p.price12m, maxEmployees: p.maxEmployees, description: p.description || '', isPopular: p.isPopular, sortOrder: p.sortOrder, features });
    setEditing(p); setErrorMsg(''); setShowModal(true);
  };
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, features: JSON.stringify(form.features) };
    try {
      if (editing) await plansApi.update(editing.id, payload); else await plansApi.create(payload);
      setShowModal(false); load();
    } catch (err: any) { setErrorMsg(err.response?.data?.message || 'Xatolik yuz berdi'); }
  };
  const handleDelete = async () => {
    if (!editing) return;
    try {
      await plansApi.delete(editing.id);
      setShowModal(false); load();
    } catch (e: any) { setErrorMsg(e.response?.data?.message || 'O\'chirishda xatolik'); }
  };

  return (
    <div>
      <div className="flex-between">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase' }}>Tariflar</h2>
        <button className="btn" onClick={openCreate}><Plus size={16} /> Yangi Tarif</button>
      </div>
      <div className="stats-grid">
        {plans.map(p => (
          <div key={p.id} className="stat-card" style={{ cursor: 'pointer', border: p.isPopular ? '2px solid var(--primary)' : undefined }} onClick={() => openEdit(p)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div className="stat-title">{p.displayName}</div>
              {p.isPopular && <span className="badge active">🔥 OMMABOP</span>}
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 4 }}>{p.price3m?.toLocaleString()} UZS <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>/ 3 oy</span></div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Xodimlar: {p.maxEmployees === 0 ? 'Cheksiz' : p.maxEmployees} ta</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Mijozlar: {p._count?.tenants || 0}</div>
          </div>
        ))}
      </div>

        {showModal && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: 640, maxHeight: '90vh', overflow: 'auto' }}>
              <div className="modal-header"><h2>{editing ? 'Tahrirlash' : 'Yangi Tarif'}</h2><button className="modal-close" onClick={() => setShowModal(false)}><X size={24} /></button></div>
              <form onSubmit={handleSave}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group"><label>Nomi (unikal)</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value.toUpperCase() })} placeholder="STARTER" /></div>
                  <div className="form-group"><label>Ko'rsatiladigan nomi</label><input required value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} placeholder="Starter (Kichik)" /></div>
                  <div className="form-group"><label>3 oylik narx (UZS)</label><input type="number" required value={form.price3m} onChange={e => setForm({ ...form, price3m: +e.target.value })} /></div>
                  <div className="form-group"><label>6 oylik narx (UZS)</label><input type="number" required value={form.price6m} onChange={e => setForm({ ...form, price6m: +e.target.value })} /></div>
                  <div className="form-group"><label>12 oylik narx (UZS)</label><input type="number" required value={form.price12m} onChange={e => setForm({ ...form, price12m: +e.target.value })} /></div>
                  <div className="form-group"><label>Xodimlar limiti (0=cheksiz)</label><input type="number" required value={form.maxEmployees} onChange={e => setForm({ ...form, maxEmployees: +e.target.value })} /></div>
                </div>
                <div className="form-group"><label>Tavsif</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.isPopular} onChange={e => setForm({ ...form, isPopular: e.target.checked })} style={{ width: 18, height: 18 }} />
                  <label style={{ margin: 0 }}>🔥 Eng ommabop (Highlight)</label>
                </div>
                <div className="form-group"><label>Platforma funksiyalari (Ruxsatlar)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginTop: 8 }}>
                    {PLAN_FEATURES.map((group, i) => (
                      <div key={i} style={{ border: '1px solid var(--border)', padding: 14, borderRadius: 10 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)', marginBottom: 10, textTransform: 'uppercase' }}>
                          {group.category}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          {group.features.map(f => (
                            <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, background: form.features[f.key] ? 'rgba(255,107,0,0.08)' : 'transparent', border: form.features[f.key] ? '1px solid rgba(255,107,0,0.2)' : '1px solid transparent', transition: 'all 0.15s' }}>
                              <input
                                type="checkbox"
                                checked={!!form.features[f.key]}
                                onChange={e => setForm({ ...form, features: { ...form.features, [f.key]: e.target.checked } })}
                                style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                              />
                              {f.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {errorMsg && (
                  <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 700, marginBottom: 8 }}>
                    ❌ {errorMsg}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button type="submit" className="btn" style={{ flex: 1, height: 48 }}>{editing ? 'Saqlash' : 'Yaratish'}</button>
                  {editing && (
                    <button type="button" className="btn" style={{ background: '#ef4444', height: 48 }}
                      onClick={() => setShowDeleteConfirm(true)}
                    >O'chirish</button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Delete Confirm Modal */}
        {showDeleteConfirm && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: 420, textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8 }}>Tarifni o'chirish</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 24 }}>
                <strong>{editing?.displayName}</strong> tarifini o'chirmoqchisiz. Unga ulangan workspacelar ta'sirlanishi mumkin!
              </p>
              {errorMsg && <div style={{ background: '#fee2e2', borderRadius: 8, padding: '8px 12px', color: '#dc2626', fontSize: '0.85rem', marginBottom: 12 }}>{errorMsg}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" style={{ flex: 1, background: '#64748b' }} onClick={() => { setShowDeleteConfirm(false); setErrorMsg(''); }}>Bekor qilish</button>
                <button className="btn" style={{ flex: 1, background: '#ef4444' }} onClick={handleDelete}>Ha, o'chirilsin</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

function Payments() {
  const [payments, setPayments] = useState<any[]>([]); const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [cards, setCards] = useState<any[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [savingCards, setSavingCards] = useState(false);

  const loadPayments = () => {
    const fn = tab === 'pending' ? tenantsApi.getPendingPayments() : tenantsApi.getAllPayments();
    fn.then(r => setPayments(r.data)).catch(console.error);
  };

  const loadCards = () => {
    settingsApi.get('PAYMENT_CARDS')
      .then(r => { setCards(r.data.value || []); })
      .catch(() => { setCards([]); })
      .finally(() => setCardsLoading(false));
  };

  useEffect(() => { loadPayments(); }, [tab]);
  useEffect(() => { loadCards(); }, []);

  const approve = async (id: string) => { if (!confirm('Tasdiqlaysizmi?')) return; await tenantsApi.approvePayment(id); loadPayments(); };
  const reject = async (id: string) => { if (!confirm('Rad etasizmi?')) return; await tenantsApi.rejectPayment(id); loadPayments(); };
  
  const handleSaveCards = async () => {
    setSavingCards(true);
    try {
      await settingsApi.update('PAYMENT_CARDS', cards);
      alert("Kartalar saqlandi!");
    } catch { alert("Xatolik!"); }
    finally { setSavingCards(false); }
  };

  const addCard = () => setCards([...cards, { name: '', number: '', owner: '' }]);
  const removeCard = (idx: number) => setCards(cards.filter((_, i) => i !== idx));
  const updateCard = (idx: number, field: string, val: string) => {
    const newCards = [...cards];
    newCards[idx][field] = val;
    setCards(newCards);
  };

  const statusBadge = (s: string) => {
    if (s === 'APPROVED') return <span className="badge active">TASDIQLANGAN</span>;
    if (s === 'REJECTED') return <span className="badge inactive">RAD ETILGAN</span>;
    return <span className="badge" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>KUTILMOQDA</span>;
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 40 }}>
      {/* 1. Payments Table */}
      <div className="animate-fade-in">
        <div className="flex-between" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase' }}>To'lovlar</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={tab === 'pending' ? 'btn' : 'btn btn-outline-tab'} style={tab !== 'pending' ? { background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' } : {}} onClick={() => setTab('pending')}>Kutilayotgan</button>
            <button className={tab === 'all' ? 'btn' : 'btn btn-outline-tab'} style={tab !== 'all' ? { background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' } : {}} onClick={() => setTab('all')}>Barcha</button>
          </div>
        </div>
        <div className="table-container shadow-sm">
          <table>
            <thead><tr><th>Sana</th><th>Workspace</th><th>Tarif</th><th>Muddat</th><th>Summa</th><th>Yuboruvchi</th><th>Holat</th><th>Amallar</th></tr></thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td style={{ fontWeight: 700 }}>{p.tenant?.name || '—'}</td>
                  <td>{p.planName}</td>
                  <td>{p.duration} oy</td>
                  <td style={{ fontWeight: 700 }}>{p.amount?.toLocaleString()} UZS</td>
                  <td>{p.sender}</td>
                  <td>{statusBadge(p.status)}</td>
                  <td>
                    {p.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn" style={{ padding: '6px 12px', fontSize: '0.7rem' }} onClick={() => approve(p.id)}><Check size={14} /> Tasdiqlash</button>
                        <button className="btn-danger" style={{ padding: '6px 12px', fontSize: '0.7rem', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', cursor: 'pointer', borderRadius: 6, fontWeight: 800, fontFamily: 'inherit' }} onClick={() => reject(p.id)}><XCircle size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32 }}>Ma'lumot topilmadi</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Card Management */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm animate-fade-in" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase' }}>To'lov Kartalari</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Mijozlar to'lov sahifasida ko'radigan karta raqamlari</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={addCard} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>+ Karta Qo'shish</button>
            <button onClick={handleSaveCards} disabled={savingCards} className="btn" style={{ padding: '8px 20px', fontSize: '0.8rem' }}>
              {savingCards ? 'Saqlanmoqda...' : 'SAQLASH'}
            </button>
          </div>
        </div>

        {cardsLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Yuklanmoqda...</div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {cards.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic' }}>Kartalar mavjud emas. Mijozlar to'lov qila olishi uchun karta qo'shing.</p>}
            {cards.map((c, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'end', background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Karta Turi (Masalan: Humo)</label>
                  <input type="text" value={c.name} onChange={e => updateCard(i, 'name', e.target.value)} placeholder="UzCard / Humo" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 600 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Karta Raqami</label>
                  <input type="text" value={c.number} onChange={e => updateCard(i, 'number', e.target.value)} placeholder="0000 0000 0000 0000" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 600, letterSpacing: '1px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Ega Ism-Familiyasi</label>
                  <input type="text" value={c.owner} onChange={e => updateCard(i, 'owner', e.target.value)} placeholder="PrintFlow LLC" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 600 }} />
                </div>
                <button onClick={() => removeCard(i)} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', width: 40, height: 40, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} className="hover:bg-rose-100">
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Tenants() {
  const [tenants, setTenants] = useState<any[]>([]); const [showModal, setShowModal] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [name, setName] = useState(''); const [selectedPlanId, setSelectedPlanId] = useState('');
  const [loading, setLoading] = useState(false); const [generatedCreds, setGeneratedCreds] = useState<any>(null);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);

  const load = () => { tenantsApi.findAll().then(r => setTenants(r.data)).catch(console.error); };
  useEffect(() => { load(); plansApi.findAll().then(r => setPlans(r.data)).catch(console.error); }, []);
  const generateRandomPassword = () => Math.random().toString(36).slice(-8);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, ''); const pwd = generateRandomPassword();
      await tenantsApi.create({ name, slug, planId: selectedPlanId || undefined, adminEmail: 'admin', adminPassword: pwd });
      setGeneratedCreds({ slug, login: 'admin', pass: pwd }); setName(''); load();
    } catch (err: any) { alert(err.response?.data?.message || 'Xatolik'); }
    finally { setLoading(false); }
  };

  const openDetails = async (id: string) => {
    try {
      const res = await tenantsApi.findOne(id);
      setSelectedTenant(res.data);
    } catch (err) {
      console.error(err);
    }
  };
  const toggleStatus = async (id: string, cur: boolean) => { if (!confirm("Holatini o'zgartirmoqchimisiz?")) return; await tenantsApi.update(id, { isActive: !cur }); load(); };
  const statusBadge = (t: any) => {
    const s = t.status;
    if (s === 'TRIAL') return <span className="badge" style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>TRIAL</span>;
    if (s === 'ACTIVE') return <span className="badge active">FAOL</span>;
    if (s === 'EXPIRED') return <span className="badge inactive">MUDDATI TUGAGAN</span>;
    if (s === 'PENDING_PAYMENT') return <span className="badge" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>TO'LOV KUTILMOQDA</span>;
    return <span className="badge">{s}</span>;
  };
  return (
    <div>
      <div className="flex-between">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase' }}>Workspacelar</h2>
        <button className="btn" onClick={() => setShowModal(true)}><Plus size={16} /> Yangi Qo'shish</button>
      </div>
      <div className="table-container">
        <table>
          <thead><tr><th>Nomi</th><th>Slug</th><th>Tarif</th><th>Holat</th><th>Yaratilgan</th><th>Amallar</th></tr></thead>
          <tbody>
            {tenants.map(t => (
              <tr key={t.id}>
                <td style={{ fontWeight: 700 }}>{t.name}</td>
                <td style={{ color: 'var(--text-muted)' }}>{t.slug}</td>
                <td>{t.plan?.displayName || '—'}</td>
                <td>{statusBadge(t)}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" style={{ padding: '6px 12px', fontSize: '0.7rem', background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)' }} onClick={() => openDetails(t.id)}>Tafsilotlar</button>
                    <button className="btn" style={{ padding: '6px 12px', fontSize: '0.7rem' }} onClick={() => toggleStatus(t.id, t.isActive)}>{t.isActive ? 'Bloklash' : 'Faollashtirish'}</button>
                    <button className="btn" style={{ padding: '6px 12px', fontSize: '0.7rem', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }} onClick={async () => { if(confirm("Haqiqatdan ham o'chirmoqchimisiz?")) { await tenantsApi.delete(t.id); load(); } }}>O'chirish</button>
                  </div>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>Ma'lumot topilmadi</td></tr>}
          </tbody>
        </table>
      </div>
      {showModal && !generatedCreds && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h2>Yangi Workspace</h2><button className="modal-close" onClick={() => setShowModal(false)}><X size={24} /></button></div>
            <form onSubmit={handleCreate}>
              <div className="form-group"><label>Workspace Nomi</label><input required value={name} onChange={e => setName(e.target.value)} placeholder="Masalan: Ideal Print" /></div>
              <div className="form-group"><label>Tarif (ixtiyoriy)</label>
                <select value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)} style={{ width: '100%', height: 48, border: '1px solid var(--border)', borderRadius: 6, padding: '0 16px', fontFamily: 'inherit', fontSize: '0.95rem' }}>
                  <option value="">Tanlanmagan (7 kunlik trial)</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                </select>
              </div>
              <button className="btn" style={{ width: '100%', height: 48, marginTop: 16 }} disabled={loading}>{loading ? 'Yaratilmoqda...' : 'Yaratish'}</button>
            </form>
          </div>
        </div>
      )}

      {generatedCreds && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h2>Workspace Yaratildi!</h2><button className="modal-close" onClick={() => setGeneratedCreds(null)}><X size={24} /></button></div>
            <div className="generated-creds" style={{ marginTop: 16 }}>
              <h4>Kirish Ma'lumotlari</h4>
              <p><strong>Workspace URL:</strong> /t/{generatedCreds.slug}</p>
              <p><strong>Login:</strong> {generatedCreds.login}</p>
              <p><strong>Parol:</strong> {generatedCreds.pass}</p>
            </div>
            <button className="btn" style={{ width: '100%', height: 48, marginTop: 16 }} onClick={() => setGeneratedCreds(null)}>Yopish</button>
          </div>
        </div>
      )}

      {selectedTenant && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 600 }}>
            <div className="modal-header"><h2>{selectedTenant.name} tafsilotlari</h2><button className="modal-close" onClick={() => setSelectedTenant(null)}><X size={24} /></button></div>
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="stat-card" style={{ padding: 16 }}>
                <div className="stat-title">Holat</div>
                <div style={{ marginTop: 8 }}>{statusBadge(selectedTenant)}</div>
              </div>
              <div className="stat-card" style={{ padding: 16 }}>
                <div className="stat-title">Jami To'langan (UZS)</div>
                <div className="stat-value" style={{ fontSize: '1.2rem' }}>{(selectedTenant.totalPaid || 0).toLocaleString()}</div>
              </div>
              <div className="stat-card" style={{ padding: 16 }}>
                <div className="stat-title">Aktivatsiya Sanasi</div>
                <div className="stat-value" style={{ fontSize: '1.1rem' }}>{new Date(selectedTenant.createdAt).toLocaleDateString()}</div>
              </div>
              <div className="stat-card" style={{ padding: 16 }}>
                <div className="stat-title">Tugash Sanasi</div>
                <div className="stat-value" style={{ fontSize: '1.1rem', color: selectedTenant.status === 'EXPIRED' ? 'var(--danger)' : 'var(--text)' }}>
                  {selectedTenant.status === 'TRIAL' && selectedTenant.trialEndsAt ? new Date(selectedTenant.trialEndsAt).toLocaleDateString() :
                    selectedTenant.subscriptionEndsAt ? new Date(selectedTenant.subscriptionEndsAt).toLocaleDateString() : 'Noma\'lum'}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>So'nggi to'lovlar</h3>
              {selectedTenant.payments?.length > 0 ? (
                <table style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead><tr><th style={{ textAlign: 'left', padding: '8px 0' }}>Sana</th><th style={{ textAlign: 'left' }}>Summa</th><th style={{ textAlign: 'left' }}>Tarif</th><th style={{ textAlign: 'right' }}>Holat</th></tr></thead>
                  <tbody>
                    {selectedTenant.payments.map((p: any) => (
                      <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 0', color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 700 }}>{p.amount.toLocaleString()}</td>
                        <td>{p.planName} ({p.duration} oy)</td>
                        <td style={{ textAlign: 'right' }}>{p.status === 'APPROVED' ? <Check size={14} color="var(--success)" /> : p.status === 'REJECTED' ? <XCircle size={14} color="var(--danger)" /> : 'Kutilmoqda'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>To'lovlar topilmadi</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Leads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [slug, setSlug] = useState('');
  const [planId, setPlanId] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState<any>(null);

  const load = () => { leadsApi.findAll().then(r => setLeads(r.data)).catch(console.error); };

  useEffect(() => {
    load();
    plansApi.findAll().then(r => setPlans(r.data)).catch(console.error);
  }, []);

  const updateStatus = async (id: string, status: string) => { await leadsApi.updateStatus(id, status); load(); };

  const openCreateModal = (lead: any) => {
    setSelectedLead(lead);
    setSlug(lead.companyName.toLowerCase().replace(/[^a-z0-9]/g, '') || '');
    setPlanId('');
    setGeneratedCreds(null);
    setShowModal(true);
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    setLoading(true);
    try {
      const res = await tenantsApi.createFromLead({
        leadId: selectedLead.id,
        slug,
        planId: planId || undefined
      });
      setGeneratedCreds(res.data.credentials);
      load(); // refresh leads to show status closed
    } catch (err: any) {
      alert(err.response?.data?.message || 'Xatolik');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: 24 }}>Demo So'rovlar</h2>
      <div className="table-container">
        <table>
          <thead><tr><th>Sana</th><th>Mijoz</th><th>Kompaniya</th><th>Aloqa</th><th>Holat</th><th>Amallar</th></tr></thead>
          <tbody>
            {leads.map(l => (
              <tr key={l.id}>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(l.createdAt).toLocaleDateString()}</td>
                <td><div style={{ fontWeight: 700 }}>{l.firstName} {l.lastName}</div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{l.role}</div></td>
                <td style={{ fontWeight: 700 }}>{l.companyName}</td>
                <td><div>{l.phone}</div>{l.telegramUser && <div style={{ color: '#3b82f6', fontSize: '0.85rem' }}>{l.telegramUser}</div>}</td>
                <td><span className="badge">{l.status}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select value={l.status} onChange={e => updateStatus(l.id, e.target.value)} style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', padding: 6, borderRadius: 4 }}>
                      <option value="new">Yangi</option><option value="contacted">Bog'lanildi</option><option value="demo_done">Demo Qilindi</option><option value="closed">Yopilgan</option>
                    </select>
                    {l.status !== 'closed' && (
                      <button className="btn" style={{ padding: '6px 12px', fontSize: '0.7rem' }} onClick={() => openCreateModal(l)}>Workspace Ochish</button>
                    )}
                    <button className="btn" style={{ padding: '6px 12px', fontSize: '0.7rem', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }} onClick={async () => { if(confirm("So'rovni o'chirmoqchimisiz?")) { await leadsApi.delete(l.id); load(); } }}>O'chirish</button>
                  </div>
                </td>
              </tr>
            ))}
            {leads.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>Ma'lumot topilmadi</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{generatedCreds ? 'Workspace Yaratildi!' : 'Workspace Yaratish'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={24} /></button>
            </div>
            {!generatedCreds ? (
              <form onSubmit={handleCreateWorkspace}>
                <div className="form-group">
                  <label>Mijoz Kompaniyasi</label>
                  <input readOnly value={selectedLead?.companyName || ''} style={{ background: 'var(--bg)' }} />
                </div>
                <div className="form-group">
                  <label>Workspace Slug (Manzil)</label>
                  <input required value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} placeholder="idealprint" />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>printflow.uz/t/{slug || '...'}</span>
                </div>
                <div className="form-group">
                  <label>Tarif (ixtiyoriy)</label>
                  <select value={planId} onChange={e => setPlanId(e.target.value)} style={{ width: '100%', height: 48, border: '1px solid var(--border)', borderRadius: 6, padding: '0 16px', fontFamily: 'inherit' }}>
                    <option value="">Tanlanmagan (7 kunlik trial)</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                  </select>
                </div>
                <button className="btn" style={{ width: '100%', height: 48, marginTop: 16 }} disabled={loading}>
                  {loading ? 'Yaratilmoqda...' : 'Workspace Yaratish'}
                </button>
              </form>
            ) : (
              <div>
                <p style={{ marginBottom: 16 }}>Mijoz uchun tizimga kirish ma'lumotlari yaratildi. Ushbu ma'lumotlarni mijozga yuboring:</p>
                <div className="generated-creds">
                  <p><strong>URL Manzil:</strong> /t/{generatedCreds.slug}</p>
                  <p><strong>Login:</strong> {generatedCreds.login}</p>
                  <p><strong>Parol:</strong> {generatedCreds.password}</p>
                </div>
                <button className="btn" style={{ width: '100%', height: 48, marginTop: 16 }} onClick={() => setShowModal(false)}>Yopish</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}



export default function App() {
  const { isAuthenticated, login, logout } = useAuth();
  if (!isAuthenticated) return <Login onLogin={login} />;
  return (
    <BrowserRouter>
      <Layout onLogout={logout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tenants" element={<Tenants />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
