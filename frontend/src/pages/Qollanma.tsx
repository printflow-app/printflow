import React, { useState, useMemo } from 'react';
import { Search, Book, ChevronRight, FileText, Settings, Users, Box, CreditCard, LayoutTemplate } from 'lucide-react';

const GUIDES = [
  {
    id: 'buyurtma-qoshish',
    icon: <LayoutTemplate size={18} />,
    title: "Yangi buyurtma qanday qo'shiladi?",
    tags: ['buyurtma', 'task', 'yangi', 'qoshish', 'zakaz', 'kanban'],
    content: (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Yangi buyurtma (zakaz) qo'shish</h1>
        <p className="text-slate-600 leading-relaxed">Mijozdan tushgan yangi buyurtmalarni tizimga kiritish va kanban doskasiga joylash qoidasi.</p>
        
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 my-6">
          <h3 className="font-bold text-orange-800 mb-2">Qadam-baqadam yo'riqnoma:</h3>
          <ol className="list-decimal pl-5 space-y-3 text-orange-900/80 font-medium">
            <li>Chap menyudan <strong>"Buyurtmalar" (Kanban)</strong> bo'limiga kiring.</li>
            <li>O'ng yuqori burchakdagi <strong>"+ Yangi Buyurtma"</strong> apelsin rangli tugmasini bosing.</li>
            <li>Buyurtma nomi va mijozni tanlang (yoki yangi mijoz ismini kiriting).</li>
            <li><strong>Xizmat turi:</strong> Qaysi xizmat qilinishini ro'yxatdan tanlang.</li>
            <li><strong>Opsiyalar:</strong> Qog'oz qalinligi, rang kabi qo'shimcha xususiyatlarni belgilang (narx avtomat o'zgaradi).</li>
            <li><strong>Moliya:</strong> Buyurtma narxi va oldindan to'lov (zakolat) summasini kiriting.</li>
            <li>Tugatgach <strong>"Saqlash"</strong> tugmasini bosing. Buyurtma birinchi bosqichga qo'shiladi!</li>
          </ol>
        </div>
      </div>
    )
  },
  {
    id: 'xizmat-qoshish',
    icon: <Settings size={18} />,
    title: "Xizmatlar va Kataloglarni boshqarish",
    tags: ['xizmat', 'katalog', 'qoshish', 'narx', 'sozlamalar', 'opsiya'],
    content: (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Xizmat va Mahsulot qo'shish</h1>
        <p className="text-slate-600 leading-relaxed">Tizimga yangi xizmat turini qo'shish va unga moslashuvchan narxlarni belgilash.</p>
        
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 my-6">
          <h3 className="font-bold text-slate-800 mb-2">Xizmat qo'shish tartibi:</h3>
          <ol className="list-decimal pl-5 space-y-3 text-slate-700">
            <li>Chap menyudan <strong>"Sozlamalar"</strong> bo'limiga kiring.</li>
            <li>Tepa qismdagi sahifalardan <strong>"Xizmatlar Katalogi"</strong> bo'limiga o'ting.</li>
            <li>O'ng yuqori burchakdagi <strong>"+ Yangi Xizmat"</strong> tugmasini bosing.</li>
            <li>Xizmat nomini (masalan, <em>"Vizitka"</em>, <em>"Bannyer"</em>), o'lchov birligini (dona, kv.m) va bazaviy narxni kiriting.</li>
            <li>Yaratgandan so'ng, xizmat ustiga bosib <strong>Opsiyalar</strong> (Qog'oz turi, Laminatsiya) qo'shishingiz mumkin. Opsiya qoshilganda uning bazaviy narxga ta'sirini (foiz yoki qo'shimcha summa) belgilang.</li>
          </ol>
        </div>
      </div>
    )
  },
  {
    id: 'xodim-qoshish',
    icon: <Users size={18} />,
    title: "Xodim qo'shish va Ruxsatlar berish",
    tags: ['xodim', 'ishchi', 'qoshish', 'ruxsat', 'rol', 'parol', 'hodim'],
    content: (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Xodim qo'shish</h1>
        <p className="text-slate-600 leading-relaxed">Yangi xodimlarni tizimga kiritish va ularga tegishli huquqlarni berish qoidalari.</p>
        
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 my-6">
          <h3 className="font-bold text-indigo-800 mb-2">Qanday amalga oshiriladi?</h3>
          <ol className="list-decimal pl-5 space-y-3 text-indigo-900/80">
            <li>Chap menyudan <strong>"Xodimlar"</strong> sahifasiga o'ting.</li>
            <li><strong>"+ Yangi Xodim"</strong> tugmasini bosing.</li>
            <li>Ism, familiyasi, telefon raqami va noyob logini kiriting.</li>
            <li><strong>Lavozimi:</strong> Xodim uchun tizimda nimalar ruxsat etilganini belgilovchi rolni tanlang (Masalan: Menejer, Dizayner).</li>
            <li>Saqlash tugmasi bosilgach, tizim <strong>avtomatik tarzda unikal parol generatsiya qiladi</strong> va ekranda ko'rsatadi. Bu parolni xodimga bering!</li>
          </ol>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900">
          <p className="font-bold">Eslatma:</p>
          <p className="text-sm mt-1">Yangi xodimga kerakli ruxsatlar yo'q bo'lsa, avval <strong>Sozlamalar &gt; Lavozimlar (Roles)</strong> bo'limidan mos rol yarating va unda kerakli huquqlarni belgilang.</p>
        </div>
      </div>
    )
  },
  {
    id: 'kassa-tranzaksiya',
    icon: <CreditCard size={18} />,
    title: "Kassa, Kirim va Chiqim amallari",
    tags: ['kassa', 'pul', 'kirim', 'chiqim', 'tranzaksiya', 'daromad', 'xarajat'],
    content: (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Kassa boshqaruvi</h1>
        <p className="text-slate-600 leading-relaxed">Tashkilotdagi barcha moliyaviy kirim-chiqimlarni hisobga olish va kassa qoldig'ini boshqarish.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
            <h3 className="font-bold text-emerald-800 mb-2">Kirim (Daromad) qo'shish</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm text-emerald-900/80">
              <li><strong>Kassa</strong> sahifasiga o'ting.</li>
              <li>"Kirim qo'shish" yashil tugmasini bosing.</li>
              <li>To'lov turi (Naqd, Karta), summa va asosiy mijozni tanlang.</li>
            </ul>
          </div>
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl">
            <h3 className="font-bold text-rose-800 mb-2">Chiqim (Xarajat) qo'shish</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm text-rose-900/80">
              <li><strong>Kassa</strong> sahifasida "Chiqim qo'shish" qizil tugmasini bosing.</li>
              <li>Xarajat turini tanlang (Soliq, Maosh, Xom-ashyo).</li>
              <li>Kimga (xodim yoki hamkorga) berilgan bo'lsa, shuni ko'rsating va saqlang.</li>
            </ul>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'telegram-bot',
    icon: <Search size={18} />,
    title: "Telegram Botni qanday ulash mumkin?",
    tags: ['telegram', 'bot', 'ulash', 'xabarnoma', 'notifikatsiya', 'update'],
    content: (
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Telegram Bot orqali ishlash</h1>
        <p className="text-slate-600 leading-relaxed">Telegram bot sizga buyurtmalar va kunlik hisobotlar haqida xabar berib turadi. Xodimlar ham o'z vazifalari bo'yicha eslatmalarni shu botdan olishadi.</p>
        
        <div className="bg-[#0088cc]/10 border border-[#0088cc]/20 rounded-xl p-4 my-6">
          <h3 className="font-bold text-[#0088cc] mb-2">Ulanish tartibi:</h3>
          <ol className="list-decimal pl-5 space-y-3 text-[#0088cc]/80 font-medium">
            <li>Telegramda botni qidiring (Token orqali botfatherdan olingan bot).</li>
            <li><strong>/start</strong> komandasini bosing va o'z tilingizni tanlang.</li>
            <li>Tizimdagi kompaniyangizning <strong>Workspace Slug</strong>'ini (URL dagi nomini) kiriting.</li>
            <li>Tizimda sizga ochilgan <strong>Login</strong> va <strong>Parol</strong>ni kiriting.</li>
            <li>Siz muvaffaqiyatli ulandingiz! Endi bildirishnomalar kelishni boshlaydi.</li>
          </ol>
        </div>

        <div className="bg-slate-100 p-4 rounded-xl">
           <h4 className="font-bold text-slate-800">Qo'shimcha Komandalar:</h4>
           <ul className="mt-2 space-y-2 text-sm">
             <li><code className="bg-white px-2 py-1 rounded text-orange-600 font-mono">/update</code> - Botni eng so'nggi versiyaga yangilash (agar qotib qolsa).</li>
             <li><code className="bg-white px-2 py-1 rounded text-orange-600 font-mono">/reset</code> - Xotirani butunlay tozalab, boshqatdan tizimga kirish.</li>
             <li><code className="bg-white px-2 py-1 rounded text-orange-600 font-mono">/logout</code> - Faqat o'z akkauntingizdan chiqish.</li>
           </ul>
        </div>
      </div>
    )
  }
];

export default function Qollanma() {
  const [search, setSearch] = useState('');
  const [activeGuide, setActiveGuide] = useState(GUIDES[0].id);

  // Qidiruv mantiqasi
  const filteredGuides = useMemo(() => {
    if (!search.trim()) return GUIDES;
    const q = search.toLowerCase();
    return GUIDES.filter(g => 
      g.title.toLowerCase().includes(q) || 
      g.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [search]);

  // Avtomatik birinchi chiqqan natijani tanlash
  React.useEffect(() => {
    if (search.trim() && filteredGuides.length > 0) {
      if (!filteredGuides.find(g => g.id === activeGuide)) {
        setActiveGuide(filteredGuides[0].id);
      }
    }
  }, [search, filteredGuides, activeGuide]);

  const activeContent = useMemo(() => {
    return GUIDES.find(g => g.id === activeGuide)?.content;
  }, [activeGuide]);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-orange-100 flex flex-col md:flex-row">
      
      {/* Sidebar - Navigation */}
      <aside className="w-full md:w-80 border-r border-slate-100 bg-slate-50/50 flex flex-col h-screen sticky top-0">
        <div className="p-6 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3 text-[#FF6B00] mb-6">
            <div className="bg-[#FF6B00]/10 p-2 rounded-xl">
              <Book size={24} />
            </div>
            <div>
              <h2 className="font-black tracking-tight text-xl text-slate-800">Qo'llanma</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Yordam Markazi</p>
            </div>
          </div>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#FF6B00]" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Qanday amal qidiryapsiz? (Masalan: xizmat)"
              className="w-full bg-slate-100/50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-3 mb-3">Mavzular ({filteredGuides.length})</p>
          {filteredGuides.length > 0 ? (
            filteredGuides.map(guide => (
              <button
                key={guide.id}
                onClick={() => setActiveGuide(guide.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left ${
                  activeGuide === guide.id 
                    ? 'bg-orange-50 text-orange-700 font-bold' 
                    : 'text-slate-600 hover:bg-slate-100 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`${activeGuide === guide.id ? 'text-orange-500' : 'text-slate-400'}`}>
                    {guide.icon}
                  </span>
                  <span className="text-sm truncate pr-2">{guide.title}</span>
                </div>
                {activeGuide === guide.id && <ChevronRight size={14} className="text-orange-400" />}
              </button>
            ))
          ) : (
            <div className="text-center p-6 text-slate-400">
              <FileText size={32} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm font-bold">Hech narsa topilmadi</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl p-8 md:p-12 lg:p-16 overflow-y-auto">
        {activeContent}
        
        {/* Footer info inside content */}
        <div className="mt-20 pt-8 border-t border-slate-100 flex items-center justify-between text-slate-400">
          <p className="text-xs font-medium">PrintFlow Docs &copy; {new Date().getFullYear()}</p>
          <div className="flex gap-4">
            <span className="text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-[#FF6B00] transition-colors">Yordam so'rash</span>
          </div>
        </div>
      </main>

    </div>
  );
}
