import React, { useState, useEffect } from 'react';
import { Palette, Image as ImageIcon, Save, Loader2, RefreshCcw, Eye } from 'lucide-react';
import { toast } from 'react-toastify';
import { settingsApi, servicesApi } from '../api';
import { PriceListView, PriceListData, PriceListBranding } from './PriceListView';

// =============================================
// NARX RO'YXATI BRANDINGI — Sozlamalar > Section
// 7 ta rang (har biri labellangan) + logo + matnlar.
// O'ng tomonda live preview.
// =============================================

const DEFAULTS: Required<Pick<PriceListBranding,
  'headerBg' | 'headerText' | 'companyNameColor' | 'accent' | 'tableHeaderBg' | 'tableHeaderText' | 'cardBorder' | 'totalSum'
>> = {
  headerBg: '#f97316',
  headerText: '#ffffff',
  companyNameColor: '#ffffff',
  accent: '#ea580c',
  tableHeaderBg: '#1e293b',
  tableHeaderText: '#ffffff',
  cardBorder: '#e2e8f0',
  totalSum: '#ea580c',
};

const COLOR_FIELDS: Array<{
  key: keyof typeof DEFAULTS;
  label: string;
  description: string;
}> = [
  { key: 'headerBg', label: 'Header foni', description: 'Yuqori brending paneli foni (kompaniya nomi ko\'rinadigan joy)' },
  { key: 'companyNameColor', label: 'Kompaniya nomi rangi', description: 'Yuqoridagi katta kompaniya nomi (H1) matnining rangi' },
  { key: 'headerText', label: 'Header qo\'shimcha matni', description: 'Sarlavha, tagline, sana, telefon va h.k. ranglari' },
  { key: 'accent', label: 'Asosiy narx rangi', description: 'Har xizmatning katta narxi (masalan: 50,000 so\'m)' },
  { key: 'tableHeaderBg', label: 'Jadval sarlavhasi foni', description: 'Opsiyalar jadvalining yuqori qatori (Opsiya / Soni / Narxi / Summasi)' },
  { key: 'tableHeaderText', label: 'Jadval sarlavhasi matni', description: 'Jadvaldagi ustun nomlari matnining rangi' },
  { key: 'cardBorder', label: 'Kartochka chegara rangi', description: 'Har xizmat bloki atrofidagi nozik chiziq rangi' },
  { key: 'totalSum', label: 'Yakuniy summa rangi', description: 'Jadvaldagi oxirgi "Summasi" ustuni qiymatlari rangi' },
];

const MAX_LOGO_BYTES = 300 * 1024; // 300 KB — base64 saqlash uchun maqul chegara

interface Props {
  tenantSlug?: string;
  activeBranchId?: string;
}

export const PriceListBrandingSection: React.FC<Props> = ({ tenantSlug, activeBranchId }) => {
  const [branding, setBranding] = useState<PriceListBranding>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewData, setPreviewData] = useState<PriceListData | null>(null);

  // 1) Mavjud branding'ni o'qish
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    settingsApi.get('PRICE_LIST_BRANDING')
      .then(r => {
        if (cancelled) return;
        if (r.data && typeof r.data === 'object') {
          setBranding({ ...DEFAULTS, ...r.data });
        }
      })
      .catch(() => {
        // Mavjud emas — default'lar bilan davom etamiz
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  // 2) Live preview uchun bir nechta misol xizmat olamiz
  useEffect(() => {
    let cancelled = false;
    // Mavjud xizmatlardan top 2 tasini olib preview qilamiz
    const branchPromise = activeBranchId
      ? servicesApi.findAll(activeBranchId)
      : Promise.resolve({ data: [] as any[] });
    branchPromise.then(r => {
      if (cancelled) return;
      const services = (r.data || []).slice(0, 2);
      setPreviewData({
        tenant: { name: 'Sizning bosmaxonangiz', slug: tenantSlug },
        branch: {
          id: 'preview',
          name: 'Asosiy filial',
          phone: branding.phone || '+998 99 123 45 67',
          address: branding.address || 'Toshkent, Mirzo Ulug\'bek',
        },
        services,
        branding,
      });
    }).catch(() => {
      if (cancelled) return;
      // Xizmatlar yo'q bo'lsa fake misol bilan
      setPreviewData({
        tenant: { name: 'Sizning bosmaxonangiz', slug: tenantSlug },
        branch: {
          id: 'preview',
          name: 'Asosiy filial',
          phone: '+998 99 123 45 67',
          address: 'Toshkent',
        },
        services: [
          {
            id: 'demo-1', name: 'Futbolka', basePrice: 50000, unit: 'dona',
            options: [
              { id: 'o1', name: 'Sotni', value: '50', priceAdd: 0 },
              { id: 'o2', name: 'Sotni', value: '100', priceAdd: -5000 },
            ],
          },
          {
            id: 'demo-2', name: 'Kepka', basePrice: 35000, unit: 'dona',
            options: [
              { id: 'o3', name: 'Sotni', value: '70', priceAdd: 0 },
            ],
          },
        ],
        branding,
      });
    });
    return () => { cancelled = true; };
  }, [branding, tenantSlug, activeBranchId]);

  const updateColor = (key: string, value: string) => {
    setBranding(prev => ({ ...prev, [key]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Faqat rasm fayli yuklash mumkin');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error(`Logo hajmi 300 KB dan oshmasligi kerak (joriy: ${Math.round(file.size / 1024)} KB)`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBranding(prev => ({ ...prev, logoBase64: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setBranding(prev => ({ ...prev, logoBase64: undefined }));
  };

  const resetDefaults = () => {
    setBranding(prev => ({
      ...DEFAULTS,
      logoBase64: prev.logoBase64,
      headerTitle: prev.headerTitle,
      tagline: prev.tagline,
      phone: prev.phone,
      address: prev.address,
      footerNote: prev.footerNote,
    }));
    toast.info('Ranglar default holatga qaytarildi (saqlash kerak)');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.set('PRICE_LIST_BRANDING', branding);
      toast.success('Saqlandi!');
    } catch (err) {
      console.error(err);
      toast.error('Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      {/* Sarlavha */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-card border border-slate-200">
        <div>
          <h3 className="t-h2 flex items-center gap-2">
            <Palette className="text-[color:var(--primary)]" size={20} /> Narx Ro'yxati Brandingi
          </h3>
          <p className="t-caption mt-1">
            Mijozga ko'rinadigan narxlar varaqasi — ranglar, logo, sarlavha
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={resetDefaults}
            disabled={saving}
            className="btn-outline"
            title="Ranglarni asl holatiga qaytarish"
          >
            <RefreshCcw size={16} /> Default
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="btn-primary"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saqlanyapti...' : 'Saqlash'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-card border border-slate-200 p-12 flex justify-center">
          <Loader2 size={20} className="text-[color:var(--primary)] animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* CHAP: sozlamalar formasi */}
          <div className="bg-white rounded-card border border-slate-200 p-4 sm:p-6 space-y-6">
            {/* Logo */}
            <div>
              <h4 className="t-h3 mb-3 flex items-center gap-2">
                <ImageIcon size={16} /> Logotip
              </h4>
              <div className="flex flex-wrap items-center gap-4">
                <div className="w-20 h-20 rounded-card border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {branding.logoBase64 ? (
                    <img src={branding.logoBase64} alt="logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <ImageIcon size={20} className="text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-[180px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="btn-outline h-sm cursor-pointer">
                      Rasm tanlash
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                    {branding.logoBase64 && (
                      <button onClick={removeLogo} className="btn-danger h-sm">
                        O'chirish
                      </button>
                    )}
                  </div>
                  <p className="t-caption mt-2">PNG/JPG. Maks 300 KB. Kichik logoda yaxshi ko'rinadi.</p>
                </div>
              </div>
            </div>

            {/* Matnlar */}
            <div className="space-y-3">
              <h4 className="t-h3">Matnlar</h4>
              <TextField
                label="Kompaniya nomi (bo'sh qoldirilsa tenant nomi ishlatiladi)"
                placeholder="Masalan: Puff Print Studio"
                value={branding.companyName || ''}
                onChange={v => setBranding(p => ({ ...p, companyName: v }))}
              />
              <TextField
                label="Sarlavha"
                placeholder="Narxlar ro'yxati"
                value={branding.headerTitle || ''}
                onChange={v => setBranding(p => ({ ...p, headerTitle: v }))}
              />
              <TextField
                label="Tagline (sarlavha ostidagi qator)"
                placeholder="Masalan: Eng zo'r sifatlar va arzon narxlar"
                value={branding.tagline || ''}
                onChange={v => setBranding(p => ({ ...p, tagline: v }))}
              />
              <TextField
                label="Telefon (filial telefonini almashtirsangiz)"
                placeholder="+998 ..."
                value={branding.phone || ''}
                onChange={v => setBranding(p => ({ ...p, phone: v }))}
              />
              <TextField
                label="Manzil (filial manzilini almashtirsangiz)"
                placeholder="Shahar, ko'cha..."
                value={branding.address || ''}
                onChange={v => setBranding(p => ({ ...p, address: v }))}
              />
              <TextField
                label="Footer matni"
                placeholder="Narxlar o'zgarishi mumkin"
                value={branding.footerNote || ''}
                onChange={v => setBranding(p => ({ ...p, footerNote: v }))}
              />
            </div>

            {/* Ranglar */}
            <div>
              <h4 className="t-h3 mb-3">
                Ranglar — har birini tanlang
              </h4>
              <div className="space-y-2">
                {COLOR_FIELDS.map(field => (
                  <div key={field.key} className="flex items-start gap-3 p-3 rounded-control border border-slate-200 hover:border-primary-300 transition-colors duration-120">
                    <input
                      type="color"
                      value={(branding as any)[field.key] || DEFAULTS[field.key]}
                      onChange={e => updateColor(field.key, e.target.value)}
                      className="w-11 h-11 rounded-control border border-slate-200 cursor-pointer flex-shrink-0"
                      title={field.label}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="t-h3">{field.label}</p>
                      <p className="t-caption leading-snug mt-0.5">{field.description}</p>
                      <input
                        type="text"
                        value={(branding as any)[field.key] || DEFAULTS[field.key]}
                        onChange={e => updateColor(field.key, e.target.value)}
                        className="input-minimal h-control-sm w-28 mt-1.5 text-xs font-mono uppercase"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* O'NG: live preview */}
          <div className="bg-slate-50 rounded-card border border-slate-200 p-4 lg:sticky lg:top-4 self-start max-h-[calc(100vh-6rem)] overflow-hidden">
            <div className="label-caps flex items-center gap-2 mb-3">
              <Eye size={16} /> Live preview
            </div>
            <div className="overflow-auto custom-scroll bg-slate-100 rounded-card p-3" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
              {previewData ? (
                <div className="origin-top-left" style={{ transform: 'scale(0.55)', transformOrigin: 'top left', width: 'fit-content' }}>
                  <PriceListView data={previewData} />
                </div>
              ) : (
                <div className="flex items-center justify-center py-20 text-slate-400">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              )}
            </div>
            <p className="t-caption mt-2 text-center">
              Saqlagandan keyin mijozlar ushbu ko'rinishni ko'radi
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

// Sodda label + input maydoni
const TextField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="form-label">
      {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="input-minimal"
    />
  </div>
);

export default PriceListBrandingSection;
