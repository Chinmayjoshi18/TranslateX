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
  private readonly minInterval = 100; // 100ms between requests

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
const CHUNK_LIMIT = 1000; // Conservative limit to avoid URL length issues

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

// Enhanced free translation service
const freeGoogleTranslate = async (text: string): Promise<TranslationResult> => {
  try {
    const chunks = chunkText(text, CHUNK_LIMIT);
    console.log(`Translating ${chunks.length} chunks for text of length ${text.length}`);

    const translateChunks = async (targetLang: string): Promise<string> => {
      const translatedChunks: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk.trim()) {
          translatedChunks.push(chunk);
          continue;
        }

        await rateLimiter.waitIfNeeded();

        const translatedChunk = await withRetry(async () => {
          // Better URL encoding to handle special characters
          const encodedText = encodeURIComponent(chunk)
            .replace(/'/g, '%27')
            .replace(/"/g, '%22')
            .replace(/&/g, '%26');

          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodedText}`;
          
          // Check URL length
          if (url.length > 8000) { // Conservative limit
            throw new Error('URL too long, chunk needs further splitting');
          }

          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });

          if (!response.ok) {
            if (response.status === 429) {
              throw new Error('Rate limited, retrying...');
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

          return translatedParts.join('');
        });

        translatedChunks.push(translatedChunk);
        
        // Progress logging for debugging
        if (chunks.length > 1) {
          console.log(`Translated chunk ${i + 1}/${chunks.length} for ${targetLang}`);
        }
      }

      return translatedChunks.join('\n');
    };

    // Translate to all languages in parallel with controlled concurrency
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

    // Limit concurrent requests to avoid overwhelming the API
    const batchSize = 3;
    const results: any = {};

    for (let i = 0; i < languages.length; i += batchSize) {
      const batch = languages.slice(i, i + batchSize);
      const batchPromises = batch.map(lang => 
        translateChunks(lang.code).then(result => ({ [lang.key]: result }))
      );

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(result => Object.assign(results, result));

      // Small delay between batches
      if (i + batchSize < languages.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return results as TranslationResult;

  } catch (error) {
    console.error('Free Google Translate failed:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Rate limited')) {
        throw new Error('Translation service is temporarily busy. Please wait a moment and try again.');
      } else if (error.message.includes('Network')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      } else if (error.message.includes('URL too long')) {
        throw new Error('Text is too long for translation. Please try with shorter content.');
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

// Main translation function - Real translations only
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
    // Using robust Google Translate service (no API key required)
    return await freeGoogleTranslate(text);
    
    // Alternative real translation options (uncomment functions above to use):
    // return await googleTranslate(text); // Official Google API with key (more reliable)
    // return await openAITranslate(text); // OpenAI API with key (AI-powered)
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}; 