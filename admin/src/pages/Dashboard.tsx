import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { settingsApi } from '../api';
import { useTenants, useTenantStats } from '../hooks/queries';
import { STATUS_COLORS, STATUS_LABELS, getAttPct, getActiveModules } from '../shared/constants';

export default 
function Dashboard() {
  // RQ — cache'lanadi, navigation'da darhol ochiladi
  const { data: stats = {} } = useTenantStats() as { data: any };
  const { data: workspaces = [] } = useTenants();
  const [aiCopilotEnabled, setAiCopilotEnabled] = useState<boolean>(false);
  const [aiToggleSaving, setAiToggleSaving] = useState<boolean>(false);

  useEffect(() => {
    settingsApi.get('AI_COPILOT_ENABLED').then(r => setAiCopilotEnabled(!!r.data?.value)).catch(() => {});
  }, []);

  const toggleAiCopilot = async () => {
    const next = !aiCopilotEnabled;
    setAiToggleSaving(true);
    try {
      await settingsApi.update('AI_COPILOT_ENABLED', next);
      setAiCopilotEnabled(next);
    } catch (e) {
      console.error('AI Copilot toggle failed:', e);
    } finally {
      setAiToggleSaving(false);
    }
  };

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
      {/* Global Feature Toggles */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '18px 22px', border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: aiCopilotEnabled ? 'linear-gradient(135deg,#FF6B00,#ff8533)' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', color: aiCopilotEnabled ? '#fff' : '#94a3b8' }}>
            <Sparkles size={20} strokeWidth={2.2} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.2px' }}>AI Copilot (Global)</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginTop: 2 }}>
              {aiCopilotEnabled
                ? 'Yoqilgan — barcha workspacelarda AI yordamchi tugmasi ko\'rinadi'
                : 'O\'chirilgan — hech kim AI yordamchidan foydalana olmaydi'}
            </div>
          </div>
        </div>
        <button
          onClick={toggleAiCopilot}
          disabled={aiToggleSaving}
          style={{
            position: 'relative',
            width: 56, height: 30, borderRadius: 999,
            background: aiCopilotEnabled ? '#FF6B00' : '#cbd5e1',
            border: 'none', cursor: aiToggleSaving ? 'wait' : 'pointer',
            transition: 'background 0.2s', flexShrink: 0,
            opacity: aiToggleSaving ? 0.6 : 1,
          }}
        >
          <div style={{
            position: 'absolute', top: 3, left: aiCopilotEnabled ? 29 : 3,
            width: 24, height: 24, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
          }} />
        </button>
      </div>

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
