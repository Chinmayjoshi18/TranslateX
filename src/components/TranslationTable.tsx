import { useState, useEffect, useMemo, useCallback } from 'react';
import { translateText, type TranslationResult } from '../services/translationService';
import { useDebounce } from '../hooks/useDebounce';
import { ChevronUpIcon, ChevronDownIcon, ArrowPathIcon, ExclamationTriangleIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

interface TranslationStatistics {
  totalTranslations: number;
  successfulTranslations: number;
  failedTranslations: number;
  lastUpdated: Date | null;
  averageResponseTime: number;
}

function TranslationTable() {
  const [englishText, setEnglishText] = useState('');
  const [translations, setTranslations] = useState<TranslationResult | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<TranslationStatistics>({
    totalTranslations: 0,
    successfulTranslations: 0,
    failedTranslations: 0,
    lastUpdated: null,
    averageResponseTime: 0
  });
  
  // Column order management
  const [columnOrder, setColumnOrder] = useState([
    'spanish', 'french', 'turkish', 'russian', 'ukrainian', 
    'portuguese', 'chinese', 'japanese', 'arabic'
  ]);

  const debouncedText = useDebounce(englishText, 300);

  const languageNames = {
    spanish: 'Spanish',
    french: 'French', 
    turkish: 'Turkish',
    russian: 'Russian',
    ukrainian: 'Ukrainian',
    portuguese: 'Portuguese',
    chinese: 'Chinese',
    japanese: 'Japanese',
    arabic: 'Arabic'
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...columnOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < newOrder.length) {
      [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
      setColumnOrder(newOrder);
    }
  };

  const orderedLanguages = useMemo(() => {
    return columnOrder.map(lang => ({
      key: lang as keyof TranslationResult,
      name: languageNames[lang as keyof typeof languageNames]
    }));
  }, [columnOrder]);

  const handleTranslate = useCallback(async () => {
    if (!debouncedText.trim() || isTranslating) return;

    setIsTranslating(true);
    setError(null);
    const startTime = Date.now();

    try {
      const result = await translateText(debouncedText);
      setTranslations(result);
      
      // Update statistics
      const responseTime = Date.now() - startTime;
      const successCount = Object.values(result).filter(text => text && text.trim().length > 0).length;
      const totalCount = Object.keys(result).length;
      
      setStatistics(prev => ({
        totalTranslations: prev.totalTranslations + totalCount,
        successfulTranslations: prev.successfulTranslations + successCount,
        failedTranslations: prev.failedTranslations + (totalCount - successCount),
        lastUpdated: new Date(),
        averageResponseTime: prev.totalTranslations > 0 
          ? (prev.averageResponseTime + responseTime) / 2 
          : responseTime
      }));
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Translation failed';
      setError(errorMessage);
      
      setStatistics(prev => ({
        ...prev,
        failedTranslations: prev.failedTranslations + Object.keys(languageNames).length,
        lastUpdated: new Date()
      }));
    } finally {
      setIsTranslating(false);
    }
  }, [debouncedText, isTranslating, languageNames]);

  useEffect(() => {
    if (debouncedText.trim()) {
      handleTranslate();
    } else {
      setTranslations(null);
      setError(null);
    }
  }, [debouncedText, handleTranslate]);

  const retryTranslation = useCallback(() => {
    handleTranslate();
  }, [handleTranslate]);

  const successRate = statistics.totalTranslations > 0 
    ? Math.round((statistics.successfulTranslations / statistics.totalTranslations) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header with Statistics */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            TranslateX
            <span className="text-sm font-normal text-gray-500 ml-2">
              AI Translation powered by OpenAI
            </span>
          </h1>
          
          {/* Statistics Dashboard */}
          <div className="flex flex-wrap justify-center gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-md px-4 py-2">
              <div className="text-sm text-gray-600">Success Rate</div>
              <div className={`text-lg font-bold ${successRate >= 90 ? 'text-green-600' : successRate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                {successRate}%
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md px-4 py-2">
              <div className="text-sm text-gray-600">Total Translations</div>
              <div className="text-lg font-bold text-blue-600">
                {statistics.totalTranslations}
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md px-4 py-2">
              <div className="text-sm text-gray-600">Avg Response</div>
              <div className="text-lg font-bold text-purple-600">
                {Math.round(statistics.averageResponseTime)}ms
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md px-4 py-2">
              <div className="text-sm text-gray-600">Last Updated</div>
              <div className="text-lg font-bold text-gray-600">
                {statistics.lastUpdated ? statistics.lastUpdated.toLocaleTimeString() : 'Never'}
              </div>
            </div>
          </div>
        </div>

        {/* Translation Input */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="mb-4">
            <label htmlFor="englishText" className="block text-sm font-medium text-gray-700 mb-2">
              English Text
            </label>
            <textarea
              id="englishText"
              value={englishText}
              onChange={(e) => setEnglishText(e.target.value)}
              className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              rows={4}
              placeholder="Enter English text to translate using OpenAI..."
            />
          </div>

          {/* Translation Status */}
          {isTranslating && (
            <div className="flex items-center justify-center py-4">
              <ArrowPathIcon className="w-5 h-5 text-indigo-600 animate-spin mr-2" />
              <span className="text-sm font-medium">OpenAI translation in progress...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mr-2" />
                <span className="text-red-700 font-medium">Translation Error</span>
              </div>
              <p className="text-red-600 text-sm mt-1">{error}</p>
              <button
                onClick={retryTranslation}
                className="mt-2 inline-flex items-center gap-1 text-red-600 hover:text-red-800 text-sm font-medium"
              >
                <ArrowPathIcon className="w-4 h-4" />
                Retry Translation
              </button>
            </div>
          )}

          {translations && !isTranslating && !error && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <CheckCircleIcon className="w-5 h-5 text-green-500 mr-2" />
                <span className="text-green-700 font-medium">OpenAI translations ready</span>
              </div>
            </div>
          )}
        </div>

        {/* Translation Results */}
        {(translations || isTranslating) && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">
                    AI Translation Results
                  </h2>
                  <p className="text-indigo-100 mt-1">
                    Powered by OpenAI for natural, contextual translations
                  </p>
                </div>
                {statistics.lastUpdated && (
                  <div className="flex items-center text-indigo-100">
                    <ClockIcon className="w-4 h-4 mr-1" />
                    <span className="text-sm">
                      Updated: {statistics.lastUpdated.toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-4 font-semibold text-gray-700 border-b border-gray-200">
                      Language
                    </th>
                    <th className="text-left p-4 font-semibold text-gray-700 border-b border-gray-200">
                      Translation
                    </th>
                    <th className="text-center p-4 font-semibold text-gray-700 border-b border-gray-200">
                      Reorder
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orderedLanguages.map((lang, index) => (
                    <tr key={lang.key} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="p-4 border-b border-gray-100 font-medium text-gray-700">
                        {lang.name}
                      </td>
                      <td className="p-4 border-b border-gray-100">
                        {isTranslating ? (
                          <div className="flex items-center">
                            <ArrowPathIcon className="w-4 h-4 text-gray-400 animate-spin mr-2" />
                            <span className="text-gray-500 italic">Processing with OpenAI...</span>
                          </div>
                        ) : (
                          <span className="text-gray-800">
                            {translations?.[lang.key] || ''}
                          </span>
                        )}
                      </td>
                      <td className="p-4 border-b border-gray-100 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => moveColumn(index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronUpIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => moveColumn(index, 'down')}
                            disabled={index === orderedLanguages.length - 1}
                            className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronDownIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center gap-4">
                  <span>AI OpenAI</span>
                  <span>•</span>
                  <span>{orderedLanguages.length} languages</span>
                </div>
                <div className="text-gray-500">
                  Natural language processing powered by OpenAI
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TranslationTable; 