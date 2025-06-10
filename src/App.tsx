import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Globe, Loader2, Plus, Trash2, Download, FileSpreadsheet, ChevronUp, ChevronDown } from 'lucide-react';
import { translateText, TranslationResult } from './services/translationService';
import * as XLSX from 'xlsx';

interface TableRow {
  id: string;
  english: string;
  translations: TranslationResult;
  isTranslating: boolean;
  height: number;
  error?: string;
  translationProgress?: {
    chunksTotal: number;
    chunksCompleted: number;
    currentLanguage: string;
  };
}

interface CopyState {
  [key: string]: boolean;
}

interface ColumnWidths {
  [key: string]: number;
}

interface Language {
  key: string;
  name: string;
  flag: string;
  code: string;
}

function App() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<TableRow[]>([
    {
      id: '1',
      english: '',
      translations: { spanish: '', french: '', turkish: '', russian: '', ukrainian: '', portuguese: '', chinese: '', japanese: '', arabic: '' },
      isTranslating: false,
      height: 80,
      error: undefined,
      translationProgress: undefined
    }
  ]);
  const [copyStates, setCopyStates] = useState<CopyState>({});
  const [globalCopied, setGlobalCopied] = useState(false);
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({
    rowNumber: 80,
    english: 300,
    spanish: 300,
    french: 300,
    turkish: 300,
    russian: 300,
    ukrainian: 300,
    portuguese: 300,
    chinese: 300,
    japanese: 300,
    arabic: 300,
    actions: 100
  });
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width?: number; height?: number }>({ x: 0, y: 0 });
  const [translationStats, setTranslationStats] = useState({
    totalTranslations: 0,
    successfulTranslations: 0,
    failedTranslations: 0,
    lastTranslationTime: null as Date | null
  });

  // Default language order (English first, others can be reordered)
  const [languageOrder, setLanguageOrder] = useState<Language[]>([
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
  ]);

  // Column reordering functions
  const moveLanguage = (fromIndex: number, toIndex: number) => {
    if (fromIndex === 0 || toIndex === 0) return; // Don't move English column
    
    const newOrder = [...languageOrder];
    const [movedItem] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedItem);
    setLanguageOrder(newOrder);
  };

  const moveLanguageUp = (index: number) => {
    if (index <= 1) return; // Can't move English or first translation column up
    moveLanguage(index, index - 1);
  };

  const moveLanguageDown = (index: number) => {
    if (index === 0 || index >= languageOrder.length - 1) return; // Can't move English or last column down
    moveLanguage(index, index + 1);
  };

  // Column resize handlers
  const handleColumnResizeStart = (columnKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(columnKey);
    setResizeStart({ 
      x: e.clientX, 
      y: e.clientY, 
      width: columnWidths[columnKey] 
    });
  };

  const handleColumnResize = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeStart.width) return;
    
    const deltaX = e.clientX - resizeStart.x;
    // Set minimum widths based on column type
    const minWidth = isResizing === 'rowNumber' ? 60 : 
                    isResizing === 'actions' ? 80 : 200;
    const newWidth = Math.max(minWidth, resizeStart.width + deltaX);
    
    setColumnWidths(prev => ({
      ...prev,
      [isResizing]: newWidth
    }));
  }, [isResizing, resizeStart]);

  const handleColumnResizeEnd = useCallback(() => {
    setIsResizing(null);
    setResizeStart({ x: 0, y: 0 });
  }, []);

  // Row resize handlers
  const handleRowResizeStart = (rowId: string, e: React.MouseEvent) => {
    e.preventDefault();
    const row = rows.find(r => r.id === rowId);
    if (!row) return;
    
    setIsResizing(`row-${rowId}`);
    setResizeStart({ 
      x: e.clientX, 
      y: e.clientY, 
      height: row.height 
    });
  };

  const handleRowResize = useCallback((e: MouseEvent) => {
    if (!isResizing?.startsWith('row-') || !resizeStart.height) return;
    
    const deltaY = e.clientY - resizeStart.y;
    const newHeight = Math.max(60, resizeStart.height + deltaY);
    const rowId = isResizing.replace('row-', '');
    
    setRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, height: newHeight } : row
    ));
  }, [isResizing, resizeStart, rows]);

  const handleResizeEnd = useCallback(() => {
    if (isResizing?.startsWith('row-')) {
      handleColumnResizeEnd();
    } else {
      handleColumnResizeEnd();
    }
  }, [isResizing, handleColumnResizeEnd]);

  // Global mouse event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      const handleMouseMove = (e: MouseEvent) => {
        if (isResizing.startsWith('row-')) {
          handleRowResize(e);
        } else {
          handleColumnResize(e);
        }
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleResizeEnd);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleColumnResize, handleRowResize, handleResizeEnd]);

  // Enhanced translation with better error handling and retries
  const translateRow = useCallback(async (rowId: string, text: string) => {
    if (!text.trim()) {
      setRows(prev => prev.map(row => 
        row.id === rowId 
          ? { ...row, translations: { spanish: '', french: '', turkish: '', russian: '', ukrainian: '', portuguese: '', chinese: '', japanese: '', arabic: '' }, error: undefined, translationProgress: undefined }
          : row
      ));
      return;
    }

    setRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, isTranslating: true, error: undefined, translationProgress: undefined } : row
    ));

    try {
      // Add progress tracking
      const chunks = Math.ceil(text.length / 1000); // Estimate chunks
      const languages = ['Spanish', 'French', 'Turkish', 'Russian', 'Ukrainian', 'Portuguese', 'Chinese', 'Japanese', 'Arabic'];
      
      let currentLangIndex = 0;
      const progressInterval = setInterval(() => {
        if (currentLangIndex < languages.length) {
          setRows(prev => prev.map(row => 
            row.id === rowId 
              ? { 
                  ...row, 
                  translationProgress: {
                    chunksTotal: chunks * languages.length,
                    chunksCompleted: currentLangIndex * chunks,
                    currentLanguage: languages[currentLangIndex]
                  }
                }
              : row
          ));
          currentLangIndex++;
        }
      }, 500);

      const result = await translateText(text);
      
      clearInterval(progressInterval);
      
      // Update success stats
      setTranslationStats(prev => ({
        ...prev,
        totalTranslations: prev.totalTranslations + 1,
        successfulTranslations: prev.successfulTranslations + 1,
        lastTranslationTime: new Date()
      }));
      
      setRows(prev => prev.map(row => 
        row.id === rowId 
          ? { ...row, translations: result, isTranslating: false, error: undefined, translationProgress: undefined }
          : row
      ));
    } catch (error) {
      console.error('Translation failed for row', rowId, ':', error);
      const errorMessage = error instanceof Error ? error.message : 'Translation failed';
      
      // Update failure stats
      setTranslationStats(prev => ({
        ...prev,
        totalTranslations: prev.totalTranslations + 1,
        failedTranslations: prev.failedTranslations + 1,
        lastTranslationTime: new Date()
      }));
      
      setRows(prev => prev.map(row => 
        row.id === rowId 
          ? { 
              ...row, 
              isTranslating: false, 
              error: errorMessage,
              translationProgress: undefined,
              // Clear translations on error to avoid showing stale data
              translations: { spanish: '', french: '', turkish: '', russian: '', ukrainian: '', portuguese: '', chinese: '', japanese: '', arabic: '' }
            } 
          : row
      ));
      
      // Auto-retry after a delay for certain errors
      if (errorMessage.includes('temporarily busy') || errorMessage.includes('Rate limited')) {
        setTimeout(() => {
          translateRow(rowId, text);
        }, 3000 + Math.random() * 2000); // Random delay to avoid thundering herd
      }
    }
  }, []);

  // Enhanced debounce implementation with stale prevention
  useEffect(() => {
    const timeouts: { [key: string]: number } = {};
    
    rows.forEach(row => {
      if (row.english && row.english.trim() && !row.isTranslating && !row.error) {
        timeouts[row.id] = window.setTimeout(() => {
          // Double-check the row still exists and hasn't changed
          const currentRow = rows.find(r => r.id === row.id);
          if (currentRow && currentRow.english === row.english && !currentRow.isTranslating) {
            translateRow(row.id, row.english);
          }
        }, 800); // Slightly longer delay to reduce API calls
      }
    });

    return () => {
      Object.values(timeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, [rows.map(row => `${row.id}:${row.english}:${row.isTranslating}:${!!row.error}`).join('|'), translateRow]);

  // Add new row
  const addRow = () => {
    const newRow: TableRow = {
      id: Date.now().toString(),
      english: '',
      translations: { spanish: '', french: '', turkish: '', russian: '', ukrainian: '', portuguese: '', chinese: '', japanese: '', arabic: '' },
      isTranslating: false,
      height: 80,
      error: undefined,
      translationProgress: undefined
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
      const headers = languageOrder.map(lang => lang.name).join('\t');
      const rowsData = rows
        .filter(row => row.english.trim())
        .map(row => {
          return languageOrder.map(lang => {
            if (lang.key === 'english') {
              return row.english.replace(/\t/g, ' ').replace(/\n/g, ' ');
            } else {
              return (row.translations[lang.key as keyof TranslationResult] || '').replace(/\t/g, ' ').replace(/\n/g, ' ');
            }
          }).join('\t');
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

    const headers = languageOrder.map(lang => lang.name);
    const csvData = [headers.join(',')];
    
    rows.filter(row => row.english.trim()).forEach(row => {
      const rowData = languageOrder.map(lang => {
        const text = lang.key === 'english' 
          ? row.english 
          : row.translations[lang.key as keyof TranslationResult] || '';
        return `"${text.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
      });
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

    const headers = languageOrder.map(lang => lang.name);
    const data = [headers];
    
    rows.filter(row => row.english.trim()).forEach(row => {
      const rowData = languageOrder.map(lang => {
        return lang.key === 'english' 
          ? row.english 
          : row.translations[lang.key as keyof TranslationResult] || '';
      });
      data.push(rowData);
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
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{t('title')}</h1>
              {translationStats.totalTranslations > 0 && (
                <div className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                    {translationStats.successfulTranslations} successful
                  </span>
                  {translationStats.failedTranslations > 0 && (
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">
                      {translationStats.failedTranslations} failed
                    </span>
                  )}
                  {translationStats.lastTranslationTime && (
                    <span className="text-xs text-gray-500">
                      Last: {translationStats.lastTranslationTime.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}
            </div>
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
          {/* Scroll Indicator */}
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-sm text-blue-700 text-center">
            ← Scroll horizontally to view all languages →
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[80vh]" style={{ scrollbarWidth: 'thin' }}>
            <table className="border-collapse" style={{ 
              width: 'max-content', 
              minWidth: '100%',
              tableLayout: 'fixed'
            }}>
              {/* Table Header */}
              <thead className="bg-gray-50">
                <tr>
                  {/* Row Number Column */}
                  <th 
                    className="px-3 py-4 text-left text-sm font-medium text-gray-700 border-b border-r border-gray-200 relative"
                    style={{ 
                      width: columnWidths.rowNumber,
                      minWidth: columnWidths.rowNumber,
                      maxWidth: columnWidths.rowNumber
                    }}
                  >
                    #
                    {/* Column resize handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                      onMouseDown={(e) => handleColumnResizeStart('rowNumber', e)}
                    />
                  </th>

                  {/* Language Columns with Reordering Controls */}
                  {languageOrder.map((lang, index) => (
                    <th
                      key={lang.key}
                      className="px-4 py-4 text-left text-sm font-medium text-gray-700 border-b border-r border-gray-200 relative"
                      style={{ 
                        width: columnWidths[lang.key],
                        minWidth: columnWidths[lang.key],
                        maxWidth: columnWidths[lang.key]
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{lang.flag}</span>
                          <span>{lang.name}</span>
                          {i18n.language === 'zh' && lang.key !== 'english' && (
                            <span className="text-xs text-gray-500">{t(lang.key)}</span>
                          )}
                        </div>
                        
                        {/* Column Reordering Controls (only for non-English columns) */}
                        {lang.key !== 'english' && (
                          <div className="flex flex-col">
                            <button
                              onClick={() => moveLanguageUp(index)}
                              disabled={index <= 1}
                              className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move Up"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => moveLanguageDown(index)}
                              disabled={index >= languageOrder.length - 1}
                              className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move Down"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Column resize handle */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                        onMouseDown={(e) => handleColumnResizeStart(lang.key, e)}
                      />
                    </th>
                  ))}

                  {/* Actions Column */}
                  <th 
                    className="px-3 py-4 text-center text-sm font-medium text-gray-700 border-b border-gray-200 relative"
                    style={{ 
                      width: columnWidths.actions,
                      minWidth: columnWidths.actions,
                      maxWidth: columnWidths.actions
                    }}
                  >
                    Actions
                    {/* Column resize handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                      onMouseDown={(e) => handleColumnResizeStart('actions', e)}
                    />
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-gray-50 relative group">
                    {/* Row Number */}
                    <td 
                      className="px-3 text-sm text-gray-500 border-b border-r border-gray-200 text-center relative"
                      style={{ 
                        width: columnWidths.rowNumber, 
                        minWidth: columnWidths.rowNumber,
                        maxWidth: columnWidths.rowNumber,
                        height: row.height 
                      }}
                    >
                      <div className="flex items-center justify-center h-full">
                        {index + 1}
                      </div>
                      {/* Row resize handle */}
                      <div
                        className="absolute left-0 right-0 bottom-0 h-1 cursor-row-resize hover:bg-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                        onMouseDown={(e) => handleRowResizeStart(row.id, e)}
                      />
                    </td>

                    {/* Dynamic Language Columns */}
                    {languageOrder.map((lang) => (
                      <td 
                        key={lang.key} 
                        className="px-4 border-b border-r border-gray-200 relative"
                        style={{ 
                          width: columnWidths[lang.key], 
                          minWidth: columnWidths[lang.key],
                          maxWidth: columnWidths[lang.key],
                          height: row.height 
                        }}
                      >
                        <div className="relative h-full">
                          {lang.key === 'english' ? (
                            // English Column (Editable)
                            <>
                              <textarea
                                value={row.english}
                                onChange={(e) => updateEnglishText(row.id, e.target.value)}
                                placeholder="Enter English text here..."
                                className={`w-full h-full p-3 border rounded-md resize-none focus:ring-2 focus:border-transparent outline-none ${
                                  row.error 
                                    ? 'border-red-300 focus:ring-red-500 bg-red-50' 
                                    : 'border-gray-300 focus:ring-indigo-500'
                                }`}
                                style={{ whiteSpace: 'pre-wrap', minHeight: '60px' }}
                              />
                              {row.english && !row.error && (
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
                              {row.error && (
                                <div className="absolute bottom-2 left-2 right-2">
                                  <div className="bg-red-100 border border-red-300 rounded-md p-2 text-xs text-red-700">
                                    <div className="flex items-start justify-between gap-2">
                                      <span className="flex-1">{row.error}</span>
                                      <button
                                        onClick={() => translateRow(row.id, row.english)}
                                        className="flex-shrink-0 px-2 py-1 bg-red-200 hover:bg-red-300 rounded text-xs transition-colors"
                                      >
                                        Retry
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            // Translation Columns (Read-only)
                            <>
                              <textarea
                                value={row.translations[lang.key as keyof TranslationResult]}
                                readOnly
                                className="w-full h-full p-3 border border-gray-200 rounded-md resize-none bg-gray-50 text-gray-700 overflow-y-auto"
                                style={{ 
                                  whiteSpace: 'pre-wrap',
                                  direction: lang.code === 'ar' ? 'rtl' : 'ltr',
                                  minHeight: '60px',
                                  wordWrap: 'break-word',
                                  overflowWrap: 'break-word'
                                }}
                              />
                              {row.isTranslating && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 bg-opacity-95 rounded-md p-2">
                                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600 mb-2" />
                                  {row.translationProgress ? (
                                    <div className="text-center">
                                      <div className="text-xs text-gray-600 mb-1">
                                        Translating to {row.translationProgress.currentLanguage}
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                        <div 
                                          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                                          style={{ 
                                            width: `${Math.min(100, (row.translationProgress.chunksCompleted / row.translationProgress.chunksTotal) * 100)}%` 
                                          }}
                                        />
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {row.translationProgress.chunksCompleted} / {row.translationProgress.chunksTotal} chunks
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-600">Preparing translation...</span>
                                  )}
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
                            </>
                          )}
                        </div>
                        {/* Row resize handle */}
                        <div
                          className="absolute left-0 right-0 bottom-0 h-1 cursor-row-resize hover:bg-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                          onMouseDown={(e) => handleRowResizeStart(row.id, e)}
                        />
                      </td>
                    ))}

                    {/* Actions Column */}
                    <td 
                      className="px-3 border-b border-gray-200 text-center relative"
                      style={{ 
                        width: columnWidths.actions, 
                        minWidth: columnWidths.actions,
                        maxWidth: columnWidths.actions,
                        height: row.height 
                      }}
                    >
                      <div className="flex items-center justify-center h-full">
                        <button
                          onClick={() => removeRow(row.id)}
                          disabled={rows.length === 1}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete Row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {/* Row resize handle */}
                      <div
                        className="absolute left-0 right-0 bottom-0 h-1 cursor-row-resize hover:bg-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                        onMouseDown={(e) => handleRowResizeStart(row.id, e)}
                      />
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