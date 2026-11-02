import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import pt from './pt.json';

// Idiomas de la app. El español es el original (voseo tico) y el que se usa
// si falta una clave en otro idioma.
//
// Se elige en Configuración → Idioma y en el registro. La primera vez se toma
// el idioma del teléfono si es uno de estos; si no, español.
//
// Cómo usarlo:
//   - En componentes: const { t } = useTranslation();  t('settings.title')
//   - Fuera de React (servicios, lib/format.js): import i18n from '../i18n';
//     i18n.t('...'). Ojo: eso no re-renderiza nada por sí solo, así que el
//     componente que lo muestra tiene que usar useTranslation().
//
// Lo que escriben los usuarios (eventos, comentarios, mensajes) NO se traduce.
export const LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
];
const SUPPORTED = LANGUAGES.map(l => l.code);
const STORAGE_KEY = 'appLanguage';

// Locale para Intl / toLocaleDateString según el idioma de la app.
const INTL_LOCALES = { es: 'es-CR', en: 'en-US', fr: 'fr-FR', pt: 'pt-BR' };
export const intlLocale = () => INTL_LOCALES[i18n.language] ?? 'es-CR';

function deviceLanguage() {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale || '';
    const code = tag.slice(0, 2).toLowerCase();
    return SUPPORTED.includes(code) ? code : 'es';
  } catch {
    return 'es';
  }
}

i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
    fr: { translation: fr },
    pt: { translation: pt },
  },
  lng: deviceLanguage(),
  fallbackLng: 'es',
  interpolation: { escapeValue: false }, // React ya escapa
  returnNull: false,
});

// Lee el idioma guardado. App.js lo espera antes del primer render para que
// no aparezca un instante en otro idioma.
export async function loadSavedLanguage() {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved) && saved !== i18n.language) {
      await i18n.changeLanguage(saved);
    }
  } catch {}
}

export async function setLanguage(code) {
  if (!SUPPORTED.includes(code)) return;
  await i18n.changeLanguage(code);
  try { await AsyncStorage.setItem(STORAGE_KEY, code); } catch {}
}

export default i18n;
