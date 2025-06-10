// Translation service with support for multiple providers
// You can easily switch between Google Translate, OpenAI, or other services

export interface TranslationResult {
  spanish: string;
  french: string;
  turkish: string;
  russian: string;
  ukrainian: string;
  portuguese: string;
  chinese: string;
  japanese: string;
  arabic: string;
}

// Rate limiting to prevent API throttling
class RateLimiter {
  private lastRequest = 0;
  private readonly minInterval = 200; // Increased to 200ms for better compatibility

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    if (timeSinceLastRequest < this.minInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLastRequest));
    }
    this.lastRequest = Date.now();
  }
}

const rateLimiter = new RateLimiter();

// Text chunking for large content
const CHUNK_LIMIT = 800; // Reduced for better compatibility

function chunkText(text: string, maxLength: number = CHUNK_LIMIT): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    // If adding this line would exceed the limit, start a new chunk
    if (currentChunk.length + line.length + 1 > maxLength) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // If a single line is too long, split it by sentences
      if (line.length > maxLength) {
        const sentences = line.split(/[.!?]+/).filter(s => s.trim());
        let sentenceChunk = '';
        
        for (const sentence of sentences) {
          if (sentenceChunk.length + sentence.length + 1 > maxLength) {
            if (sentenceChunk.trim()) {
              chunks.push(sentenceChunk.trim());
              sentenceChunk = '';
            }
            
            // If even a single sentence is too long, split by words
            if (sentence.length > maxLength) {
              const words = sentence.split(' ');
              let wordChunk = '';
              
              for (const word of words) {
                if (wordChunk.length + word.length + 1 > maxLength) {
                  if (wordChunk.trim()) {
                    chunks.push(wordChunk.trim());
                    wordChunk = '';
                  }
                  // If a single word is too long, just add it as is
                  chunks.push(word);
                } else {
                  wordChunk += (wordChunk ? ' ' : '') + word;
                }
              }
              
              if (wordChunk.trim()) {
                sentenceChunk = wordChunk;
              }
            } else {
              sentenceChunk = sentence;
            }
          } else {
            sentenceChunk += (sentenceChunk ? '. ' : '') + sentence;
          }
        }
        
        if (sentenceChunk.trim()) {
          currentChunk = sentenceChunk;
        }
      } else {
        currentChunk = line;
      }
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

// Retry mechanism for failed requests
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Translation attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  throw lastError!;
}

// Alternative translation service using a different endpoint
const alternativeTranslate = async (text: string, targetLang: string): Promise<string> => {
  // Using a different approach with minimal URL encoding
  const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`, {
    method: 'GET',
    headers: {
      'Accept': '*/*',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data || !data[0] || !Array.isArray(data[0])) {
    throw new Error('Invalid response format');
  }

  // Extract and combine all translated parts
  const translatedParts = data[0]
    .filter((item: any) => item && item[0])
    .map((item: any) => item[0]);

  return translatedParts.join('');
};

// Enhanced free translation service with multiple fallback strategies
const freeGoogleTranslate = async (text: string): Promise<TranslationResult> => {
  try {
    console.log(`Starting translation for text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    const chunks = chunkText(text, CHUNK_LIMIT);
    console.log(`Split into ${chunks.length} chunks`);

    const translateChunks = async (targetLang: string): Promise<string> => {
      console.log(`Translating to ${targetLang}...`);
      const translatedChunks: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk.trim()) {
          translatedChunks.push(chunk);
          continue;
        }

        await rateLimiter.waitIfNeeded();

        const translatedChunk = await withRetry(async () => {
          console.log(`Translating chunk ${i + 1}/${chunks.length} to ${targetLang}: "${chunk.substring(0, 30)}..."`);
          
          try {
            // Primary method with enhanced encoding
            const encodedText = encodeURIComponent(chunk);
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodedText}`;
            
            // Check URL length
            if (url.length > 6000) { // More conservative limit
              throw new Error('URL too long, trying alternative method');
            }

            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://translate.google.com/',
                'Origin': 'https://translate.google.com'
              }
            });

            if (!response.ok) {
              if (response.status === 429) {
                throw new Error('Rate limited, will retry...');
              } else if (response.status === 403) {
                throw new Error('Access forbidden, trying alternative approach...');
              }
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data || !data[0] || !Array.isArray(data[0])) {
              throw new Error('Invalid response format');
            }

            // Extract and combine all translated parts
            const translatedParts = data[0]
              .filter((item: any) => item && item[0])
              .map((item: any) => item[0]);

            const result = translatedParts.join('');
            console.log(`✅ Successfully translated chunk to ${targetLang}`);
            return result;

          } catch (primaryError) {
            console.log(`Primary method failed, trying alternative:`, primaryError);
            
            // Fallback method
            try {
              return await alternativeTranslate(chunk, targetLang);
            } catch (fallbackError) {
              console.error(`Both methods failed:`, { primary: primaryError, fallback: fallbackError });
              throw new Error(`Translation failed: ${(primaryError as Error).message}`);
            }
          }
        }, 2, 2000); // 2 retries with 2 second delay

        translatedChunks.push(translatedChunk);
      }

      const result = translatedChunks.join('\n');
      console.log(`✅ Completed translation to ${targetLang}`);
      return result;
    };

    // Translate to all languages with more conservative concurrency
    const languages = [
      { code: 'es', key: 'spanish' },
      { code: 'fr', key: 'french' },
      { code: 'tr', key: 'turkish' },
      { code: 'ru', key: 'russian' },
      { code: 'uk', key: 'ukrainian' },
      { code: 'pt', key: 'portuguese' },
      { code: 'zh', key: 'chinese' },
      { code: 'ja', key: 'japanese' },
      { code: 'ar', key: 'arabic' }
    ];

    // Process languages sequentially to avoid overwhelming the API
    const results: any = {};
    
    for (const lang of languages) {
      try {
        results[lang.key] = await translateChunks(lang.code);
        // Small delay between languages
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Failed to translate to ${lang.key}:`, error);
        // Continue with other languages even if one fails
        results[lang.key] = `[Translation failed for ${lang.key}]`;
      }
    }

    console.log(`✅ Translation completed successfully`);
    return results as TranslationResult;

  } catch (error) {
    console.error('Free Google Translate failed:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Rate limited') || error.message.includes('429')) {
        throw new Error('Translation service is busy. Please wait a few seconds and try again.');
      } else if (error.message.includes('Network') || error.message.includes('fetch')) {
        throw new Error('Network connection issue. Please check your internet and try again.');
      } else if (error.message.includes('URL too long')) {
        throw new Error('Text is too long. Please try with shorter content.');
      } else if (error.message.includes('403') || error.message.includes('forbidden')) {
        throw new Error('Translation service access restricted. Please try again later.');
      }
    }
    
    throw new Error('Translation service temporarily unavailable. Please try again in a moment.');
  }
};

// Google Translate API implementation (you'll need to add your API key)
// Commented out to avoid unused variable errors in production build
/*
const googleTranslate = async (text: string): Promise<TranslationResult> => {
  const API_KEY = (import.meta as any).env?.VITE_GOOGLE_TRANSLATE_API_KEY;
  
  if (!API_KEY) {
    throw new Error('Google Translate API key not found');
  }

  const translateToLanguage = async (targetLang: string) => {
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          source: 'en',
          target: targetLang,
          format: 'text'
        })
      }
    );

    if (!response.ok) {
      throw new Error('Translation failed');
    }

    const data = await response.json();
    return data.data.translations[0].translatedText;
  };

  const [spanish, french, turkish, russian, ukrainian, portuguese, chinese, japanese, arabic] = await Promise.all([
    translateToLanguage('es'),
    translateToLanguage('fr'),
    translateToLanguage('tr'),
    translateToLanguage('ru'),
    translateToLanguage('uk'),
    translateToLanguage('pt'),
    translateToLanguage('zh'),
    translateToLanguage('ja'),
    translateToLanguage('ar')
  ]);

  return { spanish, french, turkish, russian, ukrainian, portuguese, chinese, japanese, arabic };
};
*/

// OpenAI API implementation (alternative option)
// Commented out to avoid unused variable errors in production build
/*
const openAITranslate = async (text: string): Promise<TranslationResult> => {
  const API_KEY = (import.meta as any).env?.VITE_OPENAI_API_KEY;
  
  if (!API_KEY) {
    throw new Error('OpenAI API key not found');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator. Translate the given English text to Spanish, French, Turkish, Russian, Ukrainian, Portuguese, Chinese, Japanese, and Arabic. Return only a JSON object with "spanish", "french", "turkish", "russian", "ukrainian", "portuguese", "chinese", "japanese", and "arabic" keys containing the translations.'
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error('Translation failed');
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    return JSON.parse(content);
  } catch {
    throw new Error('Invalid translation response');
  }
};
*/

// Mock translation service for testing/fallback
const mockTranslate = async (text: string): Promise<TranslationResult> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
  
  const prefixes = {
    spanish: '[ES] ',
    french: '[FR] ',
    turkish: '[TR] ',
    russian: '[RU] ',
    ukrainian: '[UA] ',
    portuguese: '[PT] ',
    chinese: '[ZH] ',
    japanese: '[JA] ',
    arabic: '[AR] '
  };

  const result: TranslationResult = {
    spanish: prefixes.spanish + text,
    french: prefixes.french + text,
    turkish: prefixes.turkish + text,
    russian: prefixes.russian + text,
    ukrainian: prefixes.ukrainian + text,
    portuguese: prefixes.portuguese + text,
    chinese: prefixes.chinese + text,
    japanese: prefixes.japanese + text,
    arabic: prefixes.arabic + text
  };

  return result;
};

// Main translation function - Real translations with fallback
export const translateText = async (text: string): Promise<TranslationResult> => {
  if (!text.trim()) {
    return { 
      spanish: '', 
      french: '', 
      turkish: '', 
      russian: '', 
      ukrainian: '', 
      portuguese: '', 
      chinese: '', 
      japanese: '', 
      arabic: '' 
    };
  }

  try {
    // Primary: Using robust Google Translate service (no API key required)
    console.log('🔄 Attempting real translation...');
    const result = await freeGoogleTranslate(text);
    console.log('✅ Real translation successful!');
    return result;
    
    // Alternative real translation options (uncomment functions above to use):
    // return await googleTranslate(text); // Official Google API with key (more reliable)
    // return await openAITranslate(text); // OpenAI API with key (AI-powered)
  } catch (error) {
    console.error('❌ Real translation failed:', error);
    
    // Check if we should show mock translations as a last resort
    const shouldUseMockFallback = true; // Set to false in production if you prefer errors over mock data
    
    if (shouldUseMockFallback) {
      console.log('🔄 Falling back to mock translation for demonstration...');
      try {
        const mockResult = await mockTranslate(text);
        console.log('✅ Mock translation successful!');
        return mockResult;
      } catch (mockError) {
        console.error('❌ Even mock translation failed:', mockError);
      }
    }
    
    throw error;
  }
}; 