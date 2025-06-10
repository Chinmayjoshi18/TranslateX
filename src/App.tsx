import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Globe, Loader2, Plus, Trash2, Download, FileSpreadsheet } from 'lucide-react';
import { translateText, TranslationResult } from './services/translationService';
import * as XLSX from 'xlsx';

interface TableRow {
  id: string;
  english: string;
  translations: TranslationResult;
  isTranslating: boolean;
}

interface CopyState {
  [key: string]: boolean;
}

function App() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<TableRow[]>([
    {
      id: '1',
      english: '',
      translations: { spanish: '', french: '', turkish: '', russian: '', ukrainian: '', portuguese: '', chinese: '', japanese: '', arabic: '' },
      isTranslating: false
    }
  ]);
  const [copyStates, setCopyStates] = useState<CopyState>({});
  const [globalCopied, setGlobalCopied] = useState(false);

  // Language configurations
  const languages = [
    { key: 'english', name: 'English', flag: '🇺🇸', code: 'en' },
    { key: 'spanish', name: 'Spanish', flag: '🇪🇸', code: 'es' },
    { key: 'french', name: 'French', flag: '🇫🇷', code: 'fr' },
    { key: 'turkish', name: 'Turkish', flag: '🇹🇷', code: 'tr' },
    { key: 'russian', name: 'Russian', flag: '🇷🇺', code: 'ru' },
    { key: 'ukrainian', name: 'Ukrainian', flag: '🇺🇦', code: 'uk' },
    { key: 'portuguese', name: 'Portuguese', flag: '🇵🇹', code: 'pt' },
    { key: 'chinese', name: 'Chinese', flag: '🇨🇳', code: 'zh' },
    { key: 'japanese', name: 'Japanese', flag: '🇯🇵', code: 'ja' },
    { key: 'arabic', name: 'Arabic', flag: '🇸🇦', code: 'ar' }
  ];

  // Debounced translation for individual rows
  const translateRow = useCallback(async (rowId: string, text: string) => {
    if (!text.trim()) {
      setRows(prev => prev.map(row => 
        row.id === rowId 
          ? { ...row, translations: { spanish: '', french: '', turkish: '', russian: '', ukrainian: '', portuguese: '', chinese: '', japanese: '', arabic: '' } }
          : row
      ));
      return;
    }

    setRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, isTranslating: true } : row
    ));

    try {
      const result = await translateText(text);
      setRows(prev => prev.map(row => 
        row.id === rowId 
          ? { ...row, translations: result, isTranslating: false }
          : row
      ));
    } catch (error) {
      console.error('Translation failed:', error);
      setRows(prev => prev.map(row => 
        row.id === rowId ? { ...row, isTranslating: false } : row
      ));
    }
  }, []);

  // Debounce implementation
  useEffect(() => {
    const timeouts: { [key: string]: NodeJS.Timeout } = {};
    
    rows.forEach(row => {
      if (row.english && row.english.trim()) {
        timeouts[row.id] = setTimeout(() => {
          translateRow(row.id, row.english);
        }, 500);
      }
    });

    return () => {
      Object.values(timeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, [rows.map(row => row.english).join('|'), translateRow]);

  // Add new row
  const addRow = () => {
    const newRow: TableRow = {
      id: Date.now().toString(),
      english: '',
      translations: { spanish: '', french: '', turkish: '', russian: '', ukrainian: '', portuguese: '', chinese: '', japanese: '', arabic: '' },
      isTranslating: false
    };
    setRows(prev => [...prev, newRow]);
  };

  // Remove row
  const removeRow = (rowId: string) => {
    if (rows.length > 1) {
      setRows(prev => prev.filter(row => row.id !== rowId));
    }
  };

  // Update English text
  const updateEnglishText = (rowId: string, text: string) => {
    setRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, english: text } : row
    ));
  };

  // Copy individual cell
  const handleCellCopy = async (text: string, cellId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStates(prev => ({ ...prev, [cellId]: true }));
      setTimeout(() => {
        setCopyStates(prev => ({ ...prev, [cellId]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  // Universal copy - copy entire table
  const copyEntireTable = async () => {
    try {
      const hasContent = rows.some(row => row.english.trim());
      if (!hasContent) {
        alert('Please add some content to copy');
        return;
      }

      // Create tab-separated values (TSV) format for easy Excel paste
      const headers = languages.map(lang => lang.name).join('\t');
      const rowsData = rows
        .filter(row => row.english.trim())
        .map(row => {
          const rowData = [
            row.english,
            row.translations.spanish,
            row.translations.french,
            row.translations.turkish,
            row.translations.russian,
            row.translations.ukrainian,
            row.translations.portuguese,
            row.translations.chinese,
            row.translations.japanese,
            row.translations.arabic
          ];
          return rowData.join('\t');
        }).join('\n');

      const tableText = headers + '\n' + rowsData;
      await navigator.clipboard.writeText(tableText);
      
      setGlobalCopied(true);
      setTimeout(() => setGlobalCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy table:', err);
      alert('Failed to copy table. Please try again.');
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const hasContent = rows.some(row => row.english.trim());
    if (!hasContent) {
      alert('Please add some content to export');
      return;
    }

    const headers = languages.map(lang => lang.name);
    const csvData = [headers.join(',')];
    
    rows.filter(row => row.english.trim()).forEach(row => {
      const rowData = [
        `"${row.english.replace(/"/g, '""')}"`,
        `"${row.translations.spanish.replace(/"/g, '""')}"`,
        `"${row.translations.french.replace(/"/g, '""')}"`,
        `"${row.translations.turkish.replace(/"/g, '""')}"`,
        `"${row.translations.russian.replace(/"/g, '""')}"`,
        `"${row.translations.ukrainian.replace(/"/g, '""')}"`,
        `"${row.translations.portuguese.replace(/"/g, '""')}"`,
        `"${row.translations.chinese.replace(/"/g, '""')}"`,
        `"${row.translations.japanese.replace(/"/g, '""')}"`,
        `"${row.translations.arabic.replace(/"/g, '""')}"`
      ];
      csvData.push(rowData.join(','));
    });

    const csvContent = csvData.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `TranslateX_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to Excel
  const exportToExcel = () => {
    const hasContent = rows.some(row => row.english.trim());
    if (!hasContent) {
      alert('Please add some content to export');
      return;
    }

    const headers = languages.map(lang => lang.name);
    const data = [headers];
    
    rows.filter(row => row.english.trim()).forEach(row => {
      data.push([
        row.english,
        row.translations.spanish,
        row.translations.french,
        row.translations.turkish,
        row.translations.russian,
        row.translations.ukrainian,
        row.translations.portuguese,
        row.translations.chinese,
        row.translations.japanese,
        row.translations.arabic
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Translations');
    XLSX.writeFile(wb, `TranslateX_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'zh' : 'en');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Globe className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-800">{t('title')}</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={toggleLanguage}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200"
            >
              {t('switchLanguage')}
            </button>
            
            {rows.some(row => row.english.trim()) && (
              <>
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>
                <button
                  onClick={exportToExcel}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors duration-200 flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel
                </button>
                <button
                  onClick={copyEntireTable}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2 font-medium"
                >
                  {globalCopied ? (
                    <>
                      <Check className="w-5 h-5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      Copy Table
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              {/* Table Header */}
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-12 px-3 py-4 text-left text-sm font-medium text-gray-700 border-b border-r border-gray-200">
                    #
                  </th>
                  {languages.map((lang) => (
                    <th
                      key={lang.key}
                      className="px-4 py-4 text-left text-sm font-medium text-gray-700 border-b border-r border-gray-200 min-w-[200px]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{lang.flag}</span>
                        <span>{lang.name}</span>
                        {i18n.language === 'zh' && lang.key !== 'english' && (
                          <span className="text-xs text-gray-500">{t(lang.key)}</span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="w-16 px-3 py-4 text-center text-sm font-medium text-gray-700 border-b border-gray-200">
                    Actions
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    {/* Row Number */}
                    <td className="px-3 py-4 text-sm text-gray-500 border-b border-r border-gray-200 text-center">
                      {index + 1}
                    </td>

                    {/* English Column (Editable) */}
                    <td className="px-4 py-4 border-b border-r border-gray-200">
                      <div className="relative">
                        <textarea
                          value={row.english}
                          onChange={(e) => updateEnglishText(row.id, e.target.value)}
                          placeholder="Enter English text here..."
                          className="w-full min-h-[60px] p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                          style={{ whiteSpace: 'pre-wrap' }}
                        />
                        {row.english && (
                          <button
                            onClick={() => handleCellCopy(row.english, `${row.id}-english`)}
                            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {copyStates[`${row.id}-english`] ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Translation Columns */}
                    {languages.slice(1).map((lang) => (
                      <td key={lang.key} className="px-4 py-4 border-b border-r border-gray-200">
                        <div className="relative">
                          <textarea
                            value={row.translations[lang.key as keyof TranslationResult]}
                            readOnly
                            className="w-full min-h-[60px] p-3 border border-gray-200 rounded-md resize-none bg-gray-50 text-gray-700"
                            style={{ 
                              whiteSpace: 'pre-wrap',
                              direction: lang.code === 'ar' ? 'rtl' : 'ltr'
                            }}
                          />
                          {row.isTranslating && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-75 rounded-md">
                              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                            </div>
                          )}
                          {row.translations[lang.key as keyof TranslationResult] && (
                            <button
                              onClick={() => handleCellCopy(row.translations[lang.key as keyof TranslationResult], `${row.id}-${lang.key}`)}
                              className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              {copyStates[`${row.id}-${lang.key}`] ? (
                                <Check className="w-4 h-4 text-green-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    ))}

                    {/* Actions Column */}
                    <td className="px-3 py-4 border-b border-gray-200 text-center">
                      <button
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length === 1}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete Row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Row Button */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={addRow}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200"
            >
              <Plus className="w-4 h-4" />
              Add Row
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-gray-600">
          <p className="text-sm">
            TranslateX - Universal Translation Table | Built for Team Operations
          </p>
        </div>
      </div>
    </div>
  );
}

export default App; 