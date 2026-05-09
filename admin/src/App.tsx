import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, Building2, Plus, X, Users, CreditCard, Package, Check, XCircle, Eye, EyeOff, Tag, Image, Trash2, Upload } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { authApi, tenantsApi, leadsApi, plansApi, settingsApi, platformApi } from './api';
import { UIProvider, useUI } from './ui';
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
    { path: '/promo-codes', icon: <Tag size={18} />, label: "Promo Kodlar" },
    { path: '/logos', icon: <Image size={18} />, label: "Logolar" },
  ];
  return (
    <div className="admin-container">
      <div className="sidebar" style={{ borderRight: '1px solid #f1f5f9', boxShadow: '4px 0 32px rgba(0,0,0,0.03)' }}>
        <div className="sidebar-header" style={{ borderBottom: '1px solid #f1f5f9', padding: '20px 24px' }}>
          <img src={logo} alt="PF" style={{ height: 30, width: 'auto', marginRight: 10, filter: 'drop-shadow(0 4px 8px rgba(255,107,0,0.25))' }} />
          <span style={{ fontWeight: 900, letterSpacing: '-0.5px' }}>Print<span style={{ color: '#FF6B00' }}>Flow</span></span>
        </div>
        <div className="sidebar-nav" style={{ padding: '12px 0' }}>
          <div style={{ padding: '6px 24px 10px', fontSize: '8px', fontWeight: 900, color: '#cbd5e1', letterSpacing: '2px', textTransform: 'uppercase' }}>Boshqaruv Paneli</div>
          {navItems.map(n => (
            <a key={n.path} href={n.path}
              className={`nav-item ${location.pathname === n.path ? 'active' : ''}`}
              style={{ margin: '0 10px', borderRadius: 10, padding: '10px 14px', fontSize: '12px', fontWeight: 700 }}>
              {n.icon}
              <span>{n.label}</span>
            </a>
          ))}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', marginTop: 'auto' }}>
          <p style={{ fontSize: '8px', color: '#cbd5e1', fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase' }}>v2.5.0 · Super Admin</p>
        </div>
      </div>
      <div className="main-content">
        <div className="topbar" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 40, borderBottom: '1px solid #f1f5f9', padding: '0 28px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span className="page-title" style={{ letterSpacing: '-0.5px', fontSize: '0.95rem', fontWeight: 900 }}>
              {navItems.find(n => n.path === location.pathname)?.label || 'Boshqaruv Paneli'}
            </span>
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>PrintFlow Super Admin</span>
          </div>
          <button className="logout-btn" onClick={onLogout} style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
            <LogOut size={13} strokeWidth={2.5} /> Chiqish
          </button>
        </div>
        <div className="content-area">{children}</div>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = { TRIAL: '#3b82f6', ACTIVE: '#10b981', EXPIRED: '#ef4444', PENDING_PAYMENT: '#f59e0b' };
const STATUS_LABELS: Record<string, string> = { TRIAL: 'Trial', ACTIVE: 'Faol', EXPIRED: 'Tugagan', PENDING_PAYMENT: "To'lov" };

const getAttPct = (t: any) =>
  t._count?.employees ? Math.min(100, Math.round(((t.attendanceTodayCount || 0) / t._count.employees) * 100)) : 0;

const getActiveModules = (t: any) =>
  [(t._count?.employees || 0) > 0, ((t.activeTasksCount ?? t._count?.tasks) || 0) > 0, (t._count?.customers || 0) > 0, (t.attendanceTodayCount || 0) > 0].filter(Boolean).length;

function Dashboard() {
  const [stats, setStats] = useState<any>({});
  const [workspaces, setWorkspaces] = useState<any[]>([]);

  useEffect(() => {
    tenantsApi.getStats().then(r => setStats(r.data)).catch(console.error);
    tenantsApi.findAll().then(r => setWorkspaces(r.data)).catch(console.error);
  }, []);

  const kpis = [
    { label: 'Jami Workspacelar', value: stats.totalTenants ?? 0, sub: `${stats.activeTenants ?? 0} faol`, accent: '#3b82f6' },
    { label: "Jami Daromad (UZS)", value: (stats.totalRevenue ?? 0).toLocaleString(), sub: 'tasdiqlangan to\'lovlar', accent: '#10b981' },
    { label: 'Jami Xodimlar', value: stats.totalEmployees ?? 0, sub: 'barcha workspacelarda', accent: '#8b5cf6' },
    { label: "Kutilayotgan To'lovlar", value: stats.pendingPayments ?? 0, sub: 'tasdiqlash kerak', accent: '#f59e0b' },
    { label: "Demo So'rovlar", value: stats.totalLeads ?? 0, sub: 'jami so\'rovlar', accent: '#06b6d4' },
    { label: 'Trial Tugaydi', value: stats.trialsExpiringSoon ?? 0, sub: '7 kun ichida', accent: '#ef4444' },
  ];

  const chartCard = (title: string, children: React.ReactNode) => (
    <div style={{ background: '#fff', padding: '22px 24px', borderRadius: 16, border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <p style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#94a3b8', marginBottom: 18 }}>{title}</p>
      {children}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', borderLeft: `3px solid ${k.accent}`, border: '1px solid #f1f5f9', borderLeftWidth: 3, borderLeftColor: k.accent, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#94a3b8' }}>{k.label}</span>
            <span style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-1.5px', lineHeight: 1.1 }}>{k.value}</span>
            <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>{k.sub}</span>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        {chartCard('Oylik Daromad (MRR)',
          <div style={{ height: 220 }}>
            {(stats.revenueChart?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.revenueChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: 12, fontWeight: 700 }} />
                  <Bar dataKey="amount" name="Daromad (UZS)" fill="#FF6B00" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>Ma'lumot yo'q</div>}
          </div>
        )}
        {chartCard('Status Taqsimoti',
          <div>
            <div style={{ height: 180 }}>
              {(stats.statusDistribution?.length ?? 0) > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.statusDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={4} dataKey="value">
                      {stats.statusDistribution.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: 12, fontWeight: 700 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0' }}>Ma'lumot yo'q</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {(stats.statusDistribution || []).map((s: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontWeight: 700 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ color: '#64748b' }}>{s.name}</span>
                  </div>
                  <span style={{ fontWeight: 900, color: '#0f172a' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Charts row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {chartCard("Workspace O'sishi",
          <div style={{ height: 180 }}>
            {(stats.tenantGrowthChart?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.tenantGrowthChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: 12, fontWeight: 700 }} />
                  <Line type="monotone" dataKey="count" name="Yangi Tenantlar" stroke="#FF6B00" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>Ma'lumot yo'q</div>}
          </div>
        )}
        {chartCard("Demo So'rovlar (Leads)",
          <div style={{ height: 180 }}>
            {(stats.leadsChart?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.leadsChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: 12, fontWeight: 700 }} />
                  <Line type="monotone" dataKey="count" name="So'rovlar" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>Ma'lumot yo'q</div>}
          </div>
        )}
      </div>

      {/* Recent workspace activity mini-cards */}
      {workspaces.length > 0 && (
        <div>
          <p style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#94a3b8', marginBottom: 12 }}>So'nggi Workspacelar — Bugungi Aktivlik</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {workspaces.slice(0, 6).map(w => {
              const color = STATUS_COLORS[w.status] || '#94a3b8';
              const attPct = getAttPct(w);
              const modules = getActiveModules(w);
              return (
                <div key={w.id} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ height: 3, background: color }} />
                  <div style={{ padding: '14px 16px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <p style={{ fontWeight: 900, fontSize: '0.85rem', color: '#0f172a', letterSpacing: '-0.2px' }}>{w.name}</p>
                        <p style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, marginTop: 1 }}>@{w.slug}</p>
                      </div>
                      <span style={{ background: `${color}12`, color, fontSize: '8px', fontWeight: 900, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.5px', border: `1px solid ${color}25`, flexShrink: 0, marginLeft: 8 }}>
                        {STATUS_LABELS[w.status] || w.status}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid #f8fafc', paddingTop: 10, gap: 0 }}>
                      {[
                        { label: 'Xodim', value: w._count?.employees ?? 0, color: '#3b82f6' },
                        { label: 'Buyurtma', value: w.activeTasksCount ?? w._count?.tasks ?? 0, color: '#FF6B00' },
                        { label: 'Davomat', value: `${attPct}%`, color: attPct >= 80 ? '#10b981' : attPct >= 40 ? '#f59e0b' : '#ef4444' },
                        { label: 'Modullar', value: `${modules}/4`, color: '#8b5cf6' },
                      ].map((m, i) => (
                        <div key={i} style={{ textAlign: 'center', borderRight: i < 3 ? '1px solid #f8fafc' : 'none' }}>
                          <p style={{ fontSize: '0.95rem', fontWeight: 900, color: m.color, letterSpacing: '-0.5px', lineHeight: 1 }}>{m.value}</p>
                          <p style={{ fontSize: '7px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: 3 }}>{m.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
  const { toast, confirm } = useUI();
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

  const approve = async (id: string) => {
    const ok = await confirm({ title: "To'lovni tasdiqlash", message: 'Ushbu to\'lovni tasdiqlaysizmi?', confirmText: 'Tasdiqlash' });
    if (!ok) return;
    try {
      await tenantsApi.approvePayment(id);
      toast("To'lov tasdiqlandi", 'success');
      loadPayments();
    } catch (e: any) { toast(e?.response?.data?.message || 'Xatolik', 'error'); }
  };
  const reject = async (id: string) => {
    const ok = await confirm({ title: "To'lovni rad etish", message: 'Ushbu to\'lovni rad etasizmi?', confirmText: 'Rad etish', danger: true });
    if (!ok) return;
    try {
      await tenantsApi.rejectPayment(id);
      toast("To'lov rad etildi", 'success');
      loadPayments();
    } catch (e: any) { toast(e?.response?.data?.message || 'Xatolik', 'error'); }
  };

  const handleSaveCards = async () => {
    setSavingCards(true);
    try {
      await settingsApi.update('PAYMENT_CARDS', cards);
      toast('Kartalar saqlandi!', 'success');
    } catch { toast('Xatolik!', 'error'); }
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

function TenantDetailsModal({ tenant, plans, onClose, onSaved, toast }: {
  tenant: any; plans: any[]; onClose: () => void; onSaved: () => void; toast: (msg: string, kind?: 'success' | 'error' | 'info') => void;
}) {
  const statusColor = STATUS_COLORS[tenant.status] || '#94a3b8';
  const statusLabel = STATUS_LABELS[tenant.status] || tenant.status;
  const curExpDate = tenant.status === 'TRIAL'
    ? (tenant.trialEndsAt ? new Date(tenant.trialEndsAt).toISOString().slice(0, 10) : '')
    : (tenant.subscriptionEndsAt ? new Date(tenant.subscriptionEndsAt).toISOString().slice(0, 10) : '');

  const [newEndDate, setNewEndDate] = useState(curExpDate);
  const [newStatus, setNewStatus] = useState(tenant.status);
  const [newPlanId, setNewPlanId] = useState(tenant.planId || '');
  const [saving, setSaving] = useState(false);

  const addMonths = (months: number) => {
    const base = newEndDate ? new Date(newEndDate) : new Date();
    if (base < new Date()) base.setTime(Date.now());
    base.setMonth(base.getMonth() + months);
    setNewEndDate(base.toISOString().slice(0, 10));
    if (newStatus !== 'ACTIVE') setNewStatus('ACTIVE');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: any = { status: newStatus, planId: newPlanId || null };
      if (newStatus === 'TRIAL') {
        updateData.trialEndsAt = newEndDate ? new Date(newEndDate).toISOString() : null;
      } else {
        updateData.subscriptionEndsAt = newEndDate ? new Date(newEndDate).toISOString() : null;
      }
      await tenantsApi.update(tenant.id, updateData);
      toast('Workspace yangilandi!', 'success');
      onSaved();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Xatolik yuz berdi', 'error');
    } finally {
      setSaving(false);
    }
  };

  const infoBox = (label: string, value: React.ReactNode) => (
    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px' }}>
      <p style={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', marginBottom: 4 }}>{label}</p>
      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>{value}</div>
    </div>
  );

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>{tenant.name}</h2>
            <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, marginTop: 3 }}>@{tenant.slug}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ background: `${statusColor}12`, color: statusColor, fontSize: '9px', fontWeight: 900, padding: '5px 12px', borderRadius: 8, textTransform: 'uppercase', border: `1px solid ${statusColor}25` }}>
              {statusLabel}
            </span>
            <button className="modal-close" onClick={onClose}><X size={22} /></button>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: "To'langan (UZS)", value: (tenant.totalPaid || 0).toLocaleString() },
            { label: 'Xodimlar', value: tenant._count?.employees ?? '—' },
            { label: 'Mijozlar', value: tenant._count?.customers ?? '—' },
            { label: 'Yaratilgan', value: new Date(tenant.createdAt).toLocaleDateString('uz-UZ') },
          ].map((item, i) => (
            <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', marginBottom: 4 }}>{item.label}</p>
              <p style={{ fontWeight: 900, fontSize: '1rem', color: '#0f172a' }}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* ===== SUBSCRIPTION MANAGEMENT ===== */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px', marginBottom: 20, background: '#fafafa' }}>
          <p style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#94a3b8', marginBottom: 14 }}>Obuna Boshqaruvi</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            {/* Status */}
            <div>
              <label style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', display: 'block', marginBottom: 6 }}>Status</label>
              <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                style={{ width: '100%', height: 40, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', fontFamily: 'inherit', fontSize: '12px', fontWeight: 700, background: '#fff', outline: 'none', cursor: 'pointer' }}>
                <option value="ACTIVE">✅ Faol (ACTIVE)</option>
                <option value="TRIAL">🔵 Trial</option>
                <option value="EXPIRED">❌ Muddati tugagan</option>
                <option value="PENDING_PAYMENT">⏳ To'lov kutilmoqda</option>
              </select>
            </div>

            {/* Plan */}
            <div>
              <label style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', display: 'block', marginBottom: 6 }}>Tarif</label>
              <select value={newPlanId} onChange={e => setNewPlanId(e.target.value)}
                style={{ width: '100%', height: 40, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', fontFamily: 'inherit', fontSize: '12px', fontWeight: 700, background: '#fff', outline: 'none', cursor: 'pointer' }}>
                <option value="">— Tarifisiz —</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
              </select>
            </div>
          </div>

          {/* Date */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', display: 'block', marginBottom: 6 }}>
              {newStatus === 'TRIAL' ? 'Trial tugash sanasi' : 'Obuna tugash sanasi'}
            </label>
            <input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)}
              style={{ width: '100%', height: 40, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 700, background: '#fff', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Quick extend buttons */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: '9px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Tezkor uzaytirish</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ label: '+1 oy', months: 1 }, { label: '+3 oy', months: 3 }, { label: '+6 oy', months: 6 }, { label: '+12 oy', months: 12 }].map(btn => (
                <button key={btn.months} onClick={() => addMonths(btn.months)}
                  style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 800, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', color: '#FF6B00', fontFamily: 'inherit', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,107,0,0.06)'; e.currentTarget.style.borderColor = '#FF6B00'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            style={{ width: '100%', height: 42, background: saving ? '#94a3b8' : '#FF6B00', color: '#fff', border: 'none', borderRadius: 10, fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: saving ? 'none' : '0 4px 12px rgba(255,107,0,0.25)', transition: 'all 0.2s' }}>
            {saving ? 'SAQLANMOQDA...' : '✓ SAQLASH'}
          </button>
        </div>

        {/* Payment history */}
        <div>
          <p style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#94a3b8', marginBottom: 12 }}>To'lovlar tarixi</p>
          {tenant.payments?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tenant.payments.map((p: any) => (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, alignItems: 'center', background: '#f8fafc', borderRadius: 10, padding: '10px 14px', fontSize: '12px' }}>
                  <div>
                    <p style={{ fontWeight: 800, color: '#0f172a' }}>{p.planName} · {p.duration} oy</p>
                    <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, marginTop: 1 }}>{new Date(p.createdAt).toLocaleDateString('uz-UZ')}</p>
                  </div>
                  <span style={{ fontWeight: 900, color: '#0f172a' }}>{(p.amount || 0).toLocaleString()} UZS</span>
                  <span style={{ fontWeight: 700, color: p.sender ? '#64748b' : '#94a3b8', fontSize: '11px' }}>{p.sender || '—'}</span>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    {p.status === 'APPROVED' ? <Check size={14} color="#10b981" /> : p.status === 'REJECTED' ? <XCircle size={14} color="#ef4444" /> : <span style={{ fontSize: '9px', fontWeight: 800, color: '#f59e0b' }}>KUTILMOQDA</span>}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '16px 0' }}>To'lovlar tarixi mavjud emas</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Tenants() {
  const { toast, confirm } = useUI();
  const [tenants, setTenants] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState<any>(null);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const load = () => { tenantsApi.findAll().then(r => setTenants(r.data)).catch(console.error); };
  useEffect(() => { load(); plansApi.findAll().then(r => setPlans(r.data)).catch(console.error); }, []);
  const generateRandomPassword = () => Math.random().toString(36).slice(-8);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const pwd = generateRandomPassword();
      await tenantsApi.create({ name, slug, planId: selectedPlanId || undefined, adminEmail: 'admin', adminPassword: pwd });
      setGeneratedCreds({ slug, login: 'admin', pass: pwd }); setName(''); load();
    } catch (err: any) { toast(err.response?.data?.message || 'Xatolik', 'error'); }
    finally { setLoading(false); }
  };

  const openDetails = async (id: string) => {
    try { const res = await tenantsApi.findOne(id); setSelectedTenant(res.data); }
    catch (err) { console.error(err); }
  };

  const toggleStatus = async (id: string, cur: boolean) => {
    const ok = await confirm({ title: 'Holatini o\'zgartirish', message: cur ? 'Workspace bloklansinmi?' : 'Workspace faollashtirilsinmi?', danger: cur });
    if (!ok) return;
    try { await tenantsApi.update(id, { isActive: !cur }); toast('Holat yangilandi', 'success'); load(); }
    catch (e: any) { toast(e?.response?.data?.message || 'Xatolik', 'error'); }
  };

  const filtered = tenants.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statuses = [
    { key: 'ALL', label: 'Barchasi', color: '#64748b' },
    { key: 'ACTIVE', label: 'Faol', color: '#10b981' },
    { key: 'TRIAL', label: 'Trial', color: '#3b82f6' },
    { key: 'EXPIRED', label: 'Tugagan', color: '#ef4444' },
    { key: 'PENDING_PAYMENT', label: "To'lov", color: '#f59e0b' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, letterSpacing: '-0.5px', color: '#0f172a', marginBottom: 4 }}>Workspacelar</h2>
          <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>{tenants.length} ta workspace · {tenants.filter(t => t.status === 'ACTIVE').length} faol</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            placeholder="Nomi yoki slug bo'yicha..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ height: 38, padding: '0 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, outline: 'none', background: '#f8fafc', width: 220, fontFamily: 'inherit' }}
          />
          <button className="btn" onClick={() => setShowModal(true)} style={{ height: 38, display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px' }}>
            <Plus size={14} /> Yangi
          </button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {statuses.map(s => (
          <button key={s.key} onClick={() => setStatusFilter(s.key)}
            style={{ padding: '5px 14px', borderRadius: 8, border: `1px solid ${statusFilter === s.key ? s.color : '#e2e8f0'}`, background: statusFilter === s.key ? `${s.color}10` : '#fff', color: statusFilter === s.key ? s.color : '#64748b', fontSize: '11px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}>
            {s.label}
            <span style={{ marginLeft: 6, background: statusFilter === s.key ? s.color : '#e2e8f0', color: statusFilter === s.key ? '#fff' : '#94a3b8', borderRadius: 4, padding: '1px 5px', fontSize: '9px', fontWeight: 900 }}>
              {s.key === 'ALL' ? tenants.length : tenants.filter(t => t.status === s.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* Workspace cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {filtered.map(t => {
          const color = STATUS_COLORS[t.status] || '#94a3b8';
          const label = STATUS_LABELS[t.status] || t.status;
          const attPct = getAttPct(t);
          const modules = getActiveModules(t);
          const expDate = t.status === 'TRIAL' ? t.trialEndsAt : t.subscriptionEndsAt;
          const isExpiringSoon = expDate && (new Date(expDate).getTime() - Date.now()) < 7 * 24 * 3600 * 1000 && new Date(expDate) > new Date();

          return (
            <div key={t.id}
              style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'box-shadow 0.2s, transform 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.09)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'none'; }}
            >
              {/* Color strip */}
              <div style={{ height: 3, background: color }} />

              {/* Card header */}
              <div style={{ padding: '15px 18px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                  <p style={{ fontWeight: 900, fontSize: '0.95rem', color: '#0f172a', letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</p>
                  <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, marginTop: 2 }}>@{t.slug} · {t.plan?.displayName || <span style={{ fontStyle: 'italic' }}>Tarifisiz</span>}</p>
                </div>
                <span style={{ background: `${color}12`, color, fontSize: '8px', fontWeight: 900, padding: '4px 9px', borderRadius: 7, textTransform: 'uppercase', letterSpacing: '0.5px', border: `1px solid ${color}25`, flexShrink: 0 }}>
                  {label}
                </span>
              </div>

              {/* Metrics strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid #f8fafc', borderBottom: '1px solid #f8fafc' }}>
                {[
                  { label: 'Xodim', value: t._count?.employees ?? 0, c: '#3b82f6' },
                  { label: 'Buyurtma', value: t.activeTasksCount ?? t._count?.tasks ?? 0, c: '#FF6B00' },
                  { label: 'Davomat', value: `${attPct}%`, c: attPct >= 80 ? '#10b981' : attPct >= 40 ? '#f59e0b' : '#ef4444' },
                  { label: 'Modullar', value: `${modules}/4`, c: '#8b5cf6' },
                ].map((m, i) => (
                  <div key={i} style={{ padding: '10px 0', textAlign: 'center', borderRight: i < 3 ? '1px solid #f8fafc' : 'none' }}>
                    <p style={{ fontSize: '1.05rem', fontWeight: 900, color: m.c, letterSpacing: '-0.5px', lineHeight: 1 }}>{m.value}</p>
                    <p style={{ fontSize: '7px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 3 }}>{m.label}</p>
                  </div>
                ))}
              </div>

              {/* Progress bar for attendance */}
              {(t._count?.employees || 0) > 0 && (
                <div style={{ padding: '8px 18px 0' }}>
                  <div style={{ height: 3, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${attPct}%`, background: attPct >= 80 ? '#10b981' : attPct >= 40 ? '#f59e0b' : '#ef4444', borderRadius: 2, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              )}

              {/* Card footer */}
              <div style={{ padding: '10px 18px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {expDate ? (
                    <span style={{ fontSize: '10px', color: isExpiringSoon ? '#f59e0b' : '#94a3b8', fontWeight: 700 }}>
                      {isExpiringSoon ? '⚠ ' : ''}{t.status === 'TRIAL' ? '⏱ Trial: ' : '📅 '}{new Date(expDate).toLocaleDateString('uz-UZ')}
                    </span>
                  ) : (
                    <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>📅 {new Date(t.createdAt).toLocaleDateString('uz-UZ')}</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={() => openDetails(t.id)}
                    style={{ padding: '5px 11px', fontSize: '10px', fontWeight: 800, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', color: '#64748b', fontFamily: 'inherit' }}>
                    Tafsilot
                  </button>
                  <button onClick={() => toggleStatus(t.id, t.isActive)}
                    style={{ padding: '5px 11px', fontSize: '10px', fontWeight: 800, background: t.isActive ? '#fef2f2' : '#f0fdf4', border: `1px solid ${t.isActive ? '#fca5a5' : '#86efac'}`, borderRadius: 8, cursor: 'pointer', color: t.isActive ? '#ef4444' : '#10b981', fontFamily: 'inherit' }}>
                    {t.isActive ? 'Bloklash' : 'Faollashtirish'}
                  </button>
                  <button onClick={async () => {
                    const ok = await confirm({ title: 'Workspace o\'chirish', message: `${t.name} workspace butunlay o'chirilsinmi?`, confirmText: 'Ha, o\'chirilsin', danger: true });
                    if (!ok) return;
                    try { await tenantsApi.delete(t.id); toast('Workspace o\'chirildi', 'success'); load(); }
                    catch (e: any) { toast(e?.response?.data?.message || 'Xatolik', 'error'); }
                  }} style={{ padding: '5px 9px', fontSize: '10px', fontWeight: 900, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, cursor: 'pointer', color: '#ef4444', fontFamily: 'inherit' }}>✕</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: '80px 0', textAlign: 'center', color: '#cbd5e1' }}>
          <Building2 size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.25 }} />
          <p style={{ fontWeight: 800, fontSize: '0.85rem' }}>{search ? 'Qidiruv bo\'yicha natija topilmadi' : 'Workspacelar mavjud emas'}</p>
        </div>
      )}
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
        <TenantDetailsModal
          tenant={selectedTenant}
          plans={plans}
          onClose={() => setSelectedTenant(null)}
          onSaved={() => { load(); openDetails(selectedTenant.id); }}
          toast={toast}
        />
      )}
    </div>
  );
}

function Leads() {
  const { toast, confirm } = useUI();
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
      toast(err.response?.data?.message || 'Xatolik', 'error');
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
                    <button className="btn" style={{ padding: '6px 12px', fontSize: '0.7rem', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }} onClick={async () => {
                      const ok = await confirm({ title: 'So\'rovni o\'chirish', message: 'Ushbu demo so\'rov o\'chirilsinmi?', confirmText: 'O\'chirish', danger: true });
                      if (!ok) return;
                      try { await leadsApi.delete(l.id); toast('So\'rov o\'chirildi', 'success'); load(); }
                      catch (e: any) { toast(e?.response?.data?.message || 'Xatolik', 'error'); }
                    }}>O'chirish</button>
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
}function PromoCodes() {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tenantsApi.getPromoCodes()
      .then(r => setPromos(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Yuklanmoqda...</div>;

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: 24 }}>Promo Kodlar va Cashbacklar</h2>
      
      <div className="table-container shadow-sm" style={{ marginBottom: 32 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Kod</th>
              <th>Egasi (Workspace)</th>
              <th>Jalb qildi (ta)</th>
              <th>Jami topdi</th>
              <th>Balans</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {promos.map(p => (
              <React.Fragment key={p.id}>
                <tr>
                  <td style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--primary)' }}>{p.code}</td>
                  <td style={{ fontWeight: 700 }}>{p.tenant?.name || '—'} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({p.tenant?.slug})</span></td>
                  <td><span className="badge" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>{p.totalReferrals} ta</span></td>
                  <td style={{ fontWeight: 800, color: '#10b981' }}>{p.totalEarned?.toLocaleString()} UZS</td>
                  <td style={{ fontWeight: 800 }}>{p.cashbackBalance?.toLocaleString()} UZS</td>
                  <td>{p.isActive ? <span className="badge active">Faol</span> : <span className="badge inactive">Nofaol</span>}</td>
                </tr>
                {p.usages && p.usages.length > 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 0, backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <div style={{ padding: '12px 24px' }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Ishlatilish tarixi:</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {p.usages.map((u: any) => (
                            <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, fontSize: '0.8rem', padding: '8px 12px', backgroundColor: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                              <span><strong>Kim ishlatdi:</strong> {u.usingTenant?.name}</span>
                              <span><strong>Tarif:</strong> {u.planName}</span>
                              <span><strong>To'lov:</strong> {u.paymentAmount?.toLocaleString()} UZS</span>
                              <span style={{ color: '#ef4444' }}><strong>Chegirma:</strong> -{u.discount?.toLocaleString()} UZS</span>
                              <span style={{ color: '#10b981' }}><strong>Cashback:</strong> +{u.cashbackEarned?.toLocaleString()} UZS</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {promos.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>Promo kodlar yo'q</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Logos() {
  const [logos, setLogos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  useEffect(() => {
    platformApi.getClientLogos()
      .then(r => { if (Array.isArray(r.data)) setLogos(r.data); })
      .catch(() => {});
  }, []);

  const save = async (newLogos: string[]) => {
    setSaving(true);
    try {
      await platformApi.setClientLogos(newLogos);
      setLogos(newLogos);
      showMsg('success', 'Saqlandi');
    } catch {
      showMsg('error', 'Xatolik');
    } finally { setSaving(false); }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { showMsg('error', 'Fayl 500KB dan kichik bo\'lishi kerak'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => save([...logos, ev.target?.result as string]);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div>
      {msg && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, padding: '12px 20px', borderRadius: 12, fontWeight: 800, fontSize: '0.85rem', background: msg.type === 'success' ? '#10b981' : '#ef4444', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {msg.text}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Mijozlar Logolari</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Landing page'dagi "Bizga ishonch bildirganlar" slayderida ko'rsatiladi</p>
        </div>
      </div>

      {/* Upload area */}
      <label style={{ display: 'block', border: '2px dashed #e2e8f0', borderRadius: 16, padding: 40, textAlign: 'center', cursor: 'pointer', marginBottom: 24, transition: 'all 0.2s' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#FF6B00')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
      >
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} disabled={saving} />
        <Upload size={32} style={{ margin: '0 auto 12px', display: 'block', color: '#94a3b8' }} />
        <p style={{ fontWeight: 800, color: '#64748b', marginBottom: 4 }}>Logo yuklash uchun bosing</p>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>PNG, JPG, SVG, WebP • Maks 500KB</p>
      </label>

      {/* Logo grid */}
      {logos.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
          {logos.map((src, i) => (
            <div key={i} style={{ position: 'relative', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100 }}
              onMouseEnter={e => (e.currentTarget.querySelector('.del-btn') as HTMLElement)!.style.opacity = '1'}
              onMouseLeave={e => (e.currentTarget.querySelector('.del-btn') as HTMLElement)!.style.opacity = '0'}
            >
              <img src={src} alt={`Logo ${i + 1}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              <button className="del-btn" onClick={() => save(logos.filter((_, j) => j !== i))}
                style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s', boxShadow: '0 2px 6px rgba(239,68,68,0.4)' }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <Image size={48} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }} />
          <p style={{ fontWeight: 700 }}>Hali logolar yo'q</p>
          <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Yuqoridan logo yuklang — landing pageda avtomatik chiqadi</p>
        </div>
      )}

      {saving && <p style={{ textAlign: 'center', color: '#FF6B00', fontWeight: 800, marginTop: 16, fontSize: '0.85rem' }}>SAQLANMOQDA...</p>}
    </div>
  );
}

export default function App() {
  const { isAuthenticated, login, logout } = useAuth();
  return (
    <UIProvider>
      {!isAuthenticated ? (
        <Login onLogin={login} />
      ) : (
        <BrowserRouter>
          <Layout onLogout={logout}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tenants" element={<Tenants />} />
              <Route path="/plans" element={<Plans />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/promo-codes" element={<PromoCodes />} />
              <Route path="/logos" element={<Logos />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      )}
    </UIProvider>
  );
}
