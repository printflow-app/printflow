import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Printer, LogOut, LayoutDashboard, Building2, Plus, X, Users } from 'lucide-react';
import { authApi, tenantsApi, leadsApi } from './api';

// --- Auth Context Mock (Simple State) ---
const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('sa_auth') === 'true';
  });

  const login = () => {
    sessionStorage.setItem('sa_auth', 'true');
    setIsAuthenticated(true);
  };

  const logout = async () => {
    try { await authApi.logout(); } catch (e) {}
    sessionStorage.removeItem('sa_auth');
    setIsAuthenticated(false);
  };

  return { isAuthenticated, login, logout };
};

// --- Components ---

function Login({ onLogin }: { onLogin: () => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authApi.login({ login, password });
      onLogin();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login xatosi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-header">
          <Printer size={48} color="var(--primary)" style={{ margin: '0 auto 16px' }} />
          <h1>Print<span>Flow</span></h1>
          <p>Super Admin Panel</p>
        </div>
        
        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Login</label>
            <input type="text" required value={login} onChange={e => setLogin(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Parol</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn login-btn" disabled={loading}>
            {loading ? 'Tekshirilmoqda...' : 'Tizimga Kirish'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Layout({ onLogout, children }: { onLogout: () => void, children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="admin-container">
      <div className="sidebar">
        <div className="sidebar-header">
          Print<span>Flow</span>
        </div>
        <div className="sidebar-nav">
          <a href="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
            <LayoutDashboard /> Dashboard
          </a>
          <a href="/tenants" className={`nav-item ${location.pathname === '/tenants' ? 'active' : ''}`}>
            <Building2 /> Workspaces
          </a>
          <a href="/leads" className={`nav-item ${location.pathname === '/leads' ? 'active' : ''}`}>
            <Users /> So'rovlar (Leads)
          </a>
        </div>
      </div>
      
      <div className="main-content">
        <div className="topbar">
          <div className="page-title">Admin Panel</div>
          <button className="logout-btn" onClick={onLogout}>
            <LogOut size={16} /> Chiqish
          </button>
        </div>
        <div className="content-area">
          {children}
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [stats, setStats] = useState({ totalTenants: 0, activeTenants: 0, newThisMonth: 0 });

  useEffect(() => {
    tenantsApi.getStats().then(res => setStats(res.data)).catch(console.error);
  }, []);

  return (
    <div>
      <h2 style={{ marginBottom: '24px', fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase' }}>Statistika</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">Jami Workspacelar</div>
          <div className="stat-value">{stats.totalTenants}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Faol Workspacelar</div>
          <div className="stat-value">{stats.activeTenants}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Bu oy qo'shilganlar</div>
          <div className="stat-value">{stats.newThisMonth}</div>
        </div>
      </div>
    </div>
  );
}

function Tenants() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState<{slug: string, login: string, pass: string} | null>(null);

  const loadTenants = () => {
    tenantsApi.findAll().then(res => setTenants(res.data)).catch(console.error);
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const generateRandomPassword = () => {
    return Math.random().toString(36).slice(-8);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const generatedSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const login = 'admin';
      const password = generateRandomPassword();

      await tenantsApi.create({ 
        name, 
        slug: generatedSlug, 
        adminEmail: login, 
        adminPassword: password 
      });
      
      setGeneratedCreds({ slug: generatedSlug, login, pass: password });
      setName('');
      loadTenants();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Xatolik');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    if (!confirm('Rostdan ham holatini o\'zgartirmoqchimisiz?')) return;
    try {
      await tenantsApi.update(id, { isActive: !currentStatus });
      loadTenants();
    } catch (err) {
      alert('Xatolik');
    }
  };

  return (
    <div>
      <div className="flex-between">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase' }}>Workspacelar</h2>
        <button className="btn" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Yangi Qo'shish
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Nomi</th>
              <th>Slug</th>
              <th>Holat</th>
              <th>Yaratilgan sana</th>
              <th>Amallar</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map(t => (
              <tr key={t.id}>
                <td style={{ fontWeight: 700 }}>{t.name}</td>
                <td style={{ color: 'var(--text-muted)' }}>{t.slug}</td>
                <td>
                  <span className={`badge ${t.isActive ? 'active' : 'inactive'}`}>
                    {t.isActive ? 'FAOL' : 'BLOKLANGAN'}
                  </span>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {new Date(t.createdAt).toLocaleDateString()}
                </td>
                <td>
                  <button className="btn" style={{ padding: '6px 12px', fontSize: '0.7rem' }} onClick={() => toggleStatus(t.id, t.isActive)}>
                    {t.isActive ? 'Bloklash' : 'Faollashtirish'}
                  </button>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px' }}>Ma'lumot topilmadi</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Yangi Workspace</h2>
              <button className="modal-close" onClick={() => { setShowModal(false); setGeneratedCreds(null); }}><X size={24} /></button>
            </div>
            
            {!generatedCreds ? (
              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label>Workspace Nomi</label>
                  <input required value={name} onChange={e => setName(e.target.value)} placeholder="Masalan: Ideal Print" />
                </div>
                <button className="btn" style={{ width: '100%', height: '48px', marginTop: '16px' }} disabled={loading}>
                  {loading ? 'Yaratilmoqda...' : 'Yaratish'}
                </button>
              </form>
            ) : (
              <div>
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <h3 style={{ color: 'var(--success)', marginBottom: '8px' }}>Workspace Muvaffaqiyatli Yaratildi!</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Mijozga quyidagi ma'lumotlarni yuboring:</p>
                </div>
                
                <div className="generated-creds">
                  <h4>Kirish Ma'lumotlari</h4>
                  <p><strong>Workspace:</strong> {generatedCreds.slug}</p>
                  <p><strong>Login:</strong> {generatedCreds.login}</p>
                  <p><strong>Parol:</strong> {generatedCreds.pass}</p>
                </div>

                <button className="btn" style={{ width: '100%', height: '48px', marginTop: '16px' }} onClick={() => { setShowModal(false); setGeneratedCreds(null); }}>
                  Yopish
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Leads() {
  const [leads, setLeads] = useState<any[]>([]);

  const loadLeads = () => {
    leadsApi.findAll().then(res => setLeads(res.data)).catch(console.error);
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      await leadsApi.updateStatus(id, status);
      loadLeads();
    } catch (err) {
      alert('Status o\'zgartirishda xatolik');
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'new': return <span className="badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>YANGI</span>;
      case 'contacted': return <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>BOG'LANILDI</span>;
      case 'demo_done': return <span className="badge" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>DEMO QILINDI</span>;
      case 'closed': return <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>SOTILDI</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  return (
    <div>
      <div className="flex-between">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase' }}>Demo So'rovlar</h2>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Sana</th>
              <th>Mijoz</th>
              <th>Kompaniya</th>
              <th>Aloqa</th>
              <th>Holat</th>
              <th>Amallar</th>
            </tr>
          </thead>
          <tbody>
            {leads.map(lead => (
              <tr key={lead.id}>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {new Date(lead.createdAt).toLocaleDateString()}
                </td>
                <td>
                  <div style={{ fontWeight: 700 }}>{lead.firstName} {lead.lastName}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lead.role}</div>
                </td>
                <td style={{ fontWeight: 700 }}>{lead.companyName}</td>
                <td>
                  <div>{lead.phone}</div>
                  {lead.telegramUser && <div style={{ color: '#3b82f6', fontSize: '0.85rem' }}>{lead.telegramUser}</div>}
                </td>
                <td>{getStatusBadge(lead.status)}</td>
                <td>
                  <select 
                    value={lead.status} 
                    onChange={e => updateStatus(lead.id, e.target.value)}
                    style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', padding: '6px', borderRadius: '4px' }}
                  >
                    <option value="new">Yangi</option>
                    <option value="contacted">Bog'lanildi</option>
                    <option value="demo_done">Demo Qilindi</option>
                    <option value="closed">Sotildi</option>
                  </select>
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>Ma'lumot topilmadi</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Main App ---

export default function App() {
  const { isAuthenticated, login, logout } = useAuth();

  if (!isAuthenticated) {
    return <Login onLogin={login} />;
  }

  return (
    <BrowserRouter>
      <Layout onLogout={logout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tenants" element={<Tenants />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
