import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      title: 'Universal Translator',
      english: 'English',
      spanish: 'Spanish',
      french: 'French',
      turkish: 'Turkish',
      russian: 'Russian',
      ukrainian: 'Ukrainian',
      portuguese: 'Portuguese',
      chinese: 'Chinese',
      japanese: 'Japanese',
      arabic: 'Arabic',
      copy: 'Copy',
      copied: 'Copied!',
      switchLanguage: 'Switch to Chinese',
      enterText: 'Enter text to translate...',
      translating: 'Translating...',
      error: 'Translation failed. Please check your internet connection and try again.',
      clearText: 'Clear',
    }
  },
  zh: {
    translation: {
      title: '通用翻译器',
      english: '英文',
      spanish: '西班牙文',
      french: '法文',
      turkish: '土耳其文',
      russian: '俄文',
      ukrainian: '乌克兰文',
      portuguese: '葡萄牙文',
      chinese: '中文',
      japanese: '日文',
      arabic: '阿拉伯文',
      copy: '复制',
      copied: '已复制！',
      switchLanguage: 'Switch to English',
      enterText: '输入要翻译的文本...',
      translating: '翻译中...',
      error: '翻译失败，请检查网络连接后重试。',
      clearText: '清除',
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n; 