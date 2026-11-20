
﻿// Єдиний модуль підключення Tower Defense Academy.
// Ніколи не розміщуй тут service_role, sk_ або інші секретні ключі.

let apiPromise;

const SITE_URL = 'https://deagorn.github.io/tower-defens/';

export const configured = () => {
  const c = window.TDA_CONFIG || {};

  return (
    /^pk_(test|live)_/.test(c.clerkPublishableKey || '') &&
    !c.clerkPublishableKey.includes('REPLACE') &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(c.supabaseUrl || '') &&
    /^(sb_publishable_|eyJ)/.test(c.supabasePublishableKey || '') &&
    !c.supabasePublishableKey.includes('REPLACE')
  );
};

export function connect() {
  if (!apiPromise) {
    apiPromise = (async () => {

      if (!configured()) {
        throw new Error('Спочатку заповни config.js');
      }

      // Завантажуємо Clerk і Supabase
      const [{ Clerk }, { createClient }] = await Promise.all([
        import('https://esm.sh/@clerk/clerk-js@6'),
        import('https://esm.sh/@supabase/supabase-js@2')
      ]);

      const cfg = window.TDA_CONFIG;

      // Отримуємо домен Clerk із публічного ключа
      const clerkDomain = atob(
        cfg.clerkPublishableKey.split('_')[2] || ''
      ).slice(0, -1);

      if (!/^[a-zA-Z0-9.-]+$/.test(clerkDomain)) {
        throw new Error('Некоректний Clerk Publishable Key');
      }

      // Завантажуємо інтерфейс Clerk
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');

        script.src =
          `https://${clerkDomain}/npm/@clerk/ui@1/dist/ui.browser.js`;

        script.crossOrigin = 'anonymous';

        script.onload = resolve;

        script.onerror = () => {
          reject(new Error('Не вдалося завантажити інтерфейс Clerk'));
        };

        document.head.append(script);
      });

      // Створюємо екземпляр Clerk
      const clerk = new Clerk(cfg.clerkPublishableKey);

      // Ініціалізуємо Clerk та налаштовуємо перенаправлення
      await clerk.load({
        ui: {
          ClerkUI: window.__internal_ClerkUICtor
        },

        signInForceRedirectUrl: SITE_URL,
        signInFallbackRedirectUrl: SITE_URL,

        signUpForceRedirectUrl: SITE_URL,
        signUpFallbackRedirectUrl: SITE_URL
      });

      // Підключаємо Supabase
      const db = createClient(
        cfg.supabaseUrl,
        cfg.supabasePublishableKey,
        {
          accessToken: async () => {
            return await clerk.session?.getToken() ?? null;
          },

          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );

      return { clerk, db };

    })().catch(error => {
      apiPromise = null;
      throw error;
    });
  }

  return apiPromise;
}

// Отримуємо ID поточного користувача
export const myId = clerk => clerk.user?.id || null;

// Обробка помилок Supabase
export const queryError = error => {
  if (error) {
    throw new Error(error.message || 'Помилка запиту');
  }
};

// Отримуємо профіль користувача з Supabase
export const getProfile = async (db, id) => {
  const { data, error } = await db
    .from('profiles')
    .select('clerk_id,nickname,username,role,group_id')
    .eq('clerk_id', id)
    .maybeSingle();

  queryError(error);

  return data;
};
