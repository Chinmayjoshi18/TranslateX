import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Globe, Loader2, X, Bold, Italic, Underline } from 'lucide-react';
import { translateText, TranslationResult } from './services/translationService';

interface CopyState {
  [key: string]: boolean;
}

function App() {
  const { t, i18n } = useTranslation();
  const [inputText, setInputText] = useState('');
  const [translations, setTranslations] = useState<TranslationResult>({
    spanish: '',
    french: '',
    turkish: '',
    russian: '',
    ukrainian: '',
    portuguese: '',
    chinese: '',
    japanese: '',
    arabic: ''
  });
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState('');
  const [copyStates, setCopyStates] = useState<CopyState>({});
  const editorRef = useRef<HTMLDivElement>(null);

  // Extract plain text from HTML content for translation while preserving line breaks
  const getPlainText = (html: string) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Replace <br> tags and block elements with line breaks
    const htmlWithBreaks = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(div|p|h[1-6]|li|blockquote)[^>]*>/gi, '\n')
      .replace(/<[^>]*>/g, ''); // Remove remaining HTML tags
    
    // Create a temporary element to decode HTML entities
    const tempElement = document.createElement('div');
    tempElement.innerHTML = htmlWithBreaks;
    const text = tempElement.textContent || tempElement.innerText || '';
    
    // Clean up excessive line breaks and return
    return text.replace(/\n\s*\n/g, '\n').trim();
  };

  // Debounced translation
  const debounceTranslate = useCallback(() => {
    const timeoutId = setTimeout(async () => {
      const plainText = getPlainText(inputText);
      if (plainText.trim()) {
        setIsTranslating(true);
        setError('');
        try {
          const result = await translateText(plainText);
          setTranslations(result);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : t('error');
          setError(errorMessage);
          console.error('Translation failed:', err);
        } finally {
          setIsTranslating(false);
        }
      } else {
        setTranslations({ 
          spanish: '', 
          french: '', 
          turkish: '', 
          russian: '', 
          ukrainian: '', 
          portuguese: '', 
          chinese: '', 
          japanese: '', 
          arabic: '' 
        });
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [inputText, t]);

  useEffect(() => {
    const cleanup = debounceTranslate();
    return cleanup;
  }, [debounceTranslate]);

  const handleCopy = async (text: string, language: string) => {
    try {
      // For English, extract plain text from HTML
      const textToCopy = language === 'english' ? getPlainText(text) : text;
      await navigator.clipboard.writeText(textToCopy);
      setCopyStates(prev => ({ ...prev, [language]: true }));
      setTimeout(() => {
        setCopyStates(prev => ({ ...prev, [language]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const formatText = (command: string) => {
    document.execCommand(command, false);
    if (editorRef.current) {
      setInputText(editorRef.current.innerHTML);
    }
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      setInputText(editorRef.current.innerHTML);
    }
  };

  const handleClear = () => {
    setInputText('');
    setTranslations({ 
      spanish: '', 
      french: '', 
      turkish: '', 
      russian: '', 
      ukrainian: '', 
      portuguese: '', 
      chinese: '', 
      japanese: '', 
      arabic: '' 
    });
    setError('');
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'zh' : 'en');
  };

  // Define available languages with their configurations
  const targetLanguages = [
    { key: 'spanish', flag: '🇪🇸', code: 'es' },
    { key: 'french', flag: '🇫🇷', code: 'fr' },
    { key: 'turkish', flag: '🇹🇷', code: 'tr' },
    { key: 'russian', flag: '🇷🇺', code: 'ru' },
    { key: 'ukrainian', flag: '🇺🇦', code: 'uk' },
    { key: 'portuguese', flag: '🇵🇹', code: 'pt' },
    { key: 'chinese', flag: '🇨🇳', code: 'zh' },
    { key: 'japanese', flag: '🇯🇵', code: 'ja' },
    { key: 'arabic', flag: '🇸🇦', code: 'ar' }
  ];

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex flex-col">
      <div className="w-full flex flex-col flex-1">
        {/* Header */}
        <div className="text-center mb-6 flex-shrink-0">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Globe className="w-6 h-6 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-800">{t('title')}</h1>
          </div>
          <button
            onClick={toggleLanguage}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200"
          >
            {t('switchLanguage')}
          </button>
        </div>

        {/* Translation Interface */}
        <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
          {/* English Input */}
          <div className="lg:w-1/3 bg-white rounded-lg shadow-lg p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <span className="text-2xl">🇺🇸</span>
                {t('english')} <span className="text-sm text-gray-500">英文</span>
              </h2>
              {inputText && getPlainText(inputText).trim() && (
                <button
                  onClick={handleClear}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title={t('clearText')}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {/* Rich Text Formatting Toolbar */}
            <div className="flex gap-2 mb-3 p-2 bg-gray-50 rounded-lg border">
              <button
                onClick={() => formatText('bold')}
                className="p-2 hover:bg-gray-200 rounded transition-colors"
                title="Bold"
                type="button"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                onClick={() => formatText('italic')}
                className="p-2 hover:bg-gray-200 rounded transition-colors"
                title="Italic"
                type="button"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                onClick={() => formatText('underline')}
                className="p-2 hover:bg-gray-200 rounded transition-colors"
                title="Underline"
                type="button"
              >
                <Underline className="w-4 h-4" />
              </button>
            </div>
            
            {/* Rich Text Editor */}
            <div
              ref={editorRef}
              contentEditable
              onInput={handleEditorInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  document.execCommand('insertHTML', false, '<br><br>');
                }
              }}
              onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData.getData('text/plain');
                const formattedText = text.replace(/\n/g, '<br>');
                document.execCommand('insertHTML', false, formattedText);
              }}
              className="flex-1 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white overflow-y-auto"
              style={{ 
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap'
              }}
              data-placeholder={t('enterText')}
            />
            <button
              onClick={() => handleCopy(inputText, 'english')}
              disabled={!inputText || !getPlainText(inputText).trim()}
              className="w-full mt-4 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center gap-2"
            >
              {copyStates.english ? (
                <>
                  <Check className="w-4 h-4" />
                  {t('copied')}
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  {t('copy')}
                </>
              )}
            </button>
          </div>

          {/* Translation Results with Horizontal Scroll */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-x-auto pb-4">
              <div className="flex h-full gap-6" style={{ width: `${Math.ceil(targetLanguages.length / 3) * 100}%` }}>
                {Array.from({ length: Math.ceil(targetLanguages.length / 3) }, (_, pageIndex) => (
                  <div key={pageIndex} className="grid grid-cols-3 gap-6 h-full flex-shrink-0" style={{ width: `${100 / Math.ceil(targetLanguages.length / 3)}%` }}>
                    {targetLanguages.slice(pageIndex * 3, (pageIndex + 1) * 3).map((lang) => (
                      <div key={lang.key} className="bg-white rounded-lg shadow-lg p-6 flex flex-col h-full">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2 flex-shrink-0">
                          <span className="text-2xl">{lang.flag}</span>
                          {t(lang.key)} <span className="text-sm text-gray-500">{i18n.language === 'zh' ? t(lang.key) : ''}</span>
                        </h2>
                        <div className="relative flex-1 mb-4">
                          <textarea
                            value={translations[lang.key as keyof TranslationResult]}
                            readOnly
                            placeholder={isTranslating ? t('translating') : ''}
                            className="w-full h-full p-4 border border-gray-300 rounded-lg resize-none bg-gray-50 text-gray-700"
                            style={{ whiteSpace: 'pre-wrap', direction: lang.code === 'ar' ? 'rtl' : 'ltr' }}
                          />
                          {isTranslating && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-75 rounded-lg">
                              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleCopy(translations[lang.key as keyof TranslationResult], lang.key)}
                          disabled={!translations[lang.key as keyof TranslationResult] || isTranslating}
                          className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center gap-2 flex-shrink-0"
                        >
                          {copyStates[lang.key] ? (
                            <>
                              <Check className="w-4 h-4" />
                              {t('copied')}
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              {t('copy')}
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg flex-shrink-0">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 text-center text-gray-600 flex-shrink-0">
          <p className="text-xs">
            TranslateX - Universal Translator | Built with React + TypeScript
          </p>
        </div>
      </div>
    </div>
  );
}

export default App; 