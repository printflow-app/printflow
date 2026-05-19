import { useCallback, useEffect, useRef, useState } from 'react';
import { notificationsApi } from '../api';

// =============================================
// useSidebarCounts — har bir sidebar tab uchun "yangilik" sonini boshqaradi.
//
// Ishlash printsipi:
// - Har bir tab uchun localStorage'da `pf_last_seen_<tab>` saqlanadi (ISO sana).
// - Hook backend'ga shu sanalarni yuboradi → backend sondan keyin yaratilgan
//   elementlarni sanaydi (Topshiriqlar, Mijozlar, Hamkorlar).
// - Davomat va Ombor uchun lastSeen kerak emas — pending overtime / past-stock
//   doim ko'rinadi.
// - Polling: 60 soniyada bir marta yangilanadi + window focus bo'lganda.
// =============================================

const SUPPORTED_TABS = ['topshiriqlar', 'mijozlar', 'hamkorlar', 'ombor', 'davomat'] as const;
type Tab = (typeof SUPPORTED_TABS)[number];

export type SidebarCounts = Record<Tab, number>;

const EMPTY: SidebarCounts = {
  topshiriqlar: 0,
  mijozlar: 0,
  hamkorlar: 0,
  ombor: 0,
  davomat: 0,
};

const LS_PREFIX = 'pf_last_seen_';

function getLastSeen(tab: Tab): string | undefined {
  try {
    return localStorage.getItem(LS_PREFIX + tab) || undefined;
  } catch {
    return undefined;
  }
}

/** Tabni "ko'rilgan" deb belgilash — keyingi pollingda shu sondan oldingilari ko'rsatilmaydi. */
export function markTabSeen(tab: string) {
  try {
    localStorage.setItem(LS_PREFIX + tab, new Date().toISOString());
  } catch { /* private mode */ }
}

export function useSidebarCounts(activeBranchId?: string) {
  const [counts, setCounts] = useState<SidebarCounts>(EMPTY);
  const inFlight = useRef(false);

  const fetchCounts = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      // Birinchi marta — lastSeen yo'q bo'lsa, hozirgi vaqtni yozamiz.
      // Aks holda barcha mavjud yozuvlar "yangi" bo'lib ko'rinadi.
      const ensure = (tab: Tab) => {
        const v = getLastSeen(tab);
        if (!v) {
          markTabSeen(tab);
          return new Date().toISOString();
        }
        return v;
      };

      const res = await notificationsApi.getSidebarCounts({
        branchId: activeBranchId || undefined,
        topshiriqlarSince: ensure('topshiriqlar'),
        mijozlarSince: ensure('mijozlar'),
        hamkorlarSince: ensure('hamkorlar'),
      });
      if (res.data && typeof res.data === 'object') {
        setCounts({ ...EMPTY, ...res.data });
      }
    } catch {
      // tinch o'tib ketamiz — sidebar badge'lari kritik emas
    } finally {
      inFlight.current = false;
    }
  }, [activeBranchId]);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 60_000);
    const onFocus = () => fetchCounts();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchCounts]);

  return { counts, refresh: fetchCounts };
}
