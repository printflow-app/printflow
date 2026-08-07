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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
        <div>
          <h3 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Palette className="text-orange-600" size={22} /> Narx Ro'yxati Brandingi
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Mijozga ko'rinadigan narxlar varaqasi — ranglar, logo, sarlavha
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={resetDefaults}
            disabled={saving}
            className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-orange-300 text-slate-700 h-10 px-4 text-xs font-bold uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
            title="Ranglarni asl holatiga qaytarish"
          >
            <RefreshCcw size={14} /> Default
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white h-10 px-6 text-xs font-bold uppercase tracking-widest rounded-xl shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saqlanyapti...' : 'Saqlash'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 flex justify-center">
          <Loader2 size={28} className="text-orange-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* CHAP: sozlamalar formasi */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-6">
            {/* Logo */}
            <div>
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <ImageIcon size={14} /> Logotip
              </h4>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {branding.logoBase64 ? (
                    <img src={branding.logoBase64} alt="logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <ImageIcon size={24} className="text-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <label className="inline-flex items-center justify-center gap-2 bg-orange-50 hover:bg-orange-100 text-orange-700 h-9 px-4 text-[12px] font-bold uppercase tracking-widest rounded-lg cursor-pointer transition-all">
                    Rasm tanlash
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  {branding.logoBase64 && (
                    <button
                      onClick={removeLogo}
                      className="ml-2 inline-flex items-center justify-center h-9 px-3 text-[12px] font-bold uppercase tracking-widest rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 transition-all"
                    >
                      O'chirish
                    </button>
                  )}
                  <p className="text-[11px] text-slate-400 mt-2">PNG/JPG. Maks 300 KB. Kichik logoda yaxshi ko'rinadi.</p>
                </div>
              </div>
            </div>

            {/* Matnlar */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Matnlar</h4>
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
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                Ranglar — har birini tanlang
              </h4>
              <div className="space-y-3">
                {COLOR_FIELDS.map(field => (
                  <div key={field.key} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:border-orange-200 hover:bg-orange-50/30 transition-all">
                    <input
                      type="color"
                      value={(branding as any)[field.key] || DEFAULTS[field.key]}
                      onChange={e => updateColor(field.key, e.target.value)}
                      className="w-12 h-12 rounded-lg border-2 border-slate-200 cursor-pointer flex-shrink-0"
                      title={field.label}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-slate-800 uppercase tracking-tight">{field.label}</p>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{field.description}</p>
                      <input
                        type="text"
                        value={(branding as any)[field.key] || DEFAULTS[field.key]}
                        onChange={e => updateColor(field.key, e.target.value)}
                        className="mt-1.5 h-7 px-2 w-28 text-[12px] font-mono font-bold uppercase border border-slate-200 rounded-md focus:outline-none focus:border-orange-400"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* O'NG: live preview */}
          <div className="bg-slate-100 rounded-3xl border border-slate-200 p-4 sm:p-6 sticky top-4 self-start max-h-[calc(100vh-6rem)] overflow-hidden">
            <div className="flex items-center gap-2 mb-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              <Eye size={14} /> Live preview
            </div>
            <div className="overflow-auto custom-scroll bg-slate-200 rounded-2xl p-3" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
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
            <p className="text-[11px] text-slate-400 mt-2 text-center">
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
    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">
      {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-10 px-3 text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-400 focus:bg-white transition-colors"
    />
  </div>
);

export default PriceListBrandingSection;
