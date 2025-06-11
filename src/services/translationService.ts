// Translation service using only OpenAI - Optimized for Speed
// Fast, parallel translation with minimal delays

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

export interface TranslationProgress {
  chunksTotal: number;
  chunksCompleted: number;
  currentLanguage: string;
}

// Language mappings
const LANGUAGE_CODES = {
  spanish: { code: 'es', name: 'Spanish' },
  french: { code: 'fr', name: 'French' },
  turkish: { code: 'tr', name: 'Turkish' },
  russian: { code: 'ru', name: 'Russian' },
  ukrainian: { code: 'uk', name: 'Ukrainian' },
  portuguese: { code: 'pt', name: 'Portuguese' },
  chinese: { code: 'zh', name: 'Chinese' },
  japanese: { code: 'ja', name: 'Japanese' },
  arabic: { code: 'ar', name: 'Arabic' }
};

// Minimal rate limiter for API protection
class RateLimiter {
  private lastCall = 0;
  private interval: number;

  constructor(minInterval: number) {
    this.interval = minInterval;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCall;
    
    if (timeSinceLastCall < this.interval) {
      const waitTime = this.interval - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastCall = Date.now();
  }
}

// Reduced rate limiting for faster translation
const openaiRateLimiter = new RateLimiter(100); // 100ms for faster requests

// Fast retry logic with reduced delays
async function withRetry<T>(
  operation: () => Promise<T>, 
  maxRetries: number = 2,
  baseDelay: number = 500
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = baseDelay * attempt; // Linear backoff for speed
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.log(`Translation attempt ${attempt + 1} failed:`, error);
      
      if (attempt === maxRetries) {
        break;
      }
    }
  }
  
  throw lastError!;
}

// Optimized text chunking for shorter texts
function chunkText(text: string, maxChunkSize: number = 2000): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + ' ' + sentence).length <= maxChunkSize) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = sentence;
      } else {
        // If single sentence is too long, split by words
        const words = sentence.split(' ');
        let wordChunk = '';
        
        for (const word of words) {
          if ((wordChunk + ' ' + word).length <= maxChunkSize) {
            wordChunk += (wordChunk ? ' ' : '') + word;
          } else {
            if (wordChunk) {
              chunks.push(wordChunk);
              wordChunk = word;
            } else {
              chunks.push(word); // Single word too long, just add it
            }
          }
        }
        
        if (wordChunk) {
          currentChunk = wordChunk;
        }
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [text];
}

// Get OpenAI API key from environment
function getOpenAIApiKey(): string {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not found. Please set VITE_OPENAI_API_KEY in your environment variables.');
  }
  return apiKey;
}

// Fast OpenAI translation with minimal chunking
async function translateWithOpenAI(text: string, targetLang: string, langName: string): Promise<string> {
  const chunks = chunkText(text, 2000);
  
  // Process chunks in parallel for speed
  const chunkPromises = chunks.map(async (chunk, index) => {
    // Only apply rate limiting for first chunk to reduce delays
    if (index === 0) {
      await openaiRateLimiter.wait();
    }
    
    const prompt = `Translate this English text to ${langName}. Respond only with the translation:

${chunk}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getOpenAIApiKey()}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a professional translator. Provide natural, accurate translations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2500,
        top_p: 1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const translatedText = data.choices?.[0]?.message?.content?.trim() || '';
    
    if (!translatedText) {
      throw new Error('Empty response from OpenAI API');
    }
    
    return translatedText;
  });
  
  const translatedChunks = await Promise.all(chunkPromises);
  return translatedChunks.join(' ');
}

// Fast translation for each language
async function translateToLanguage(text: string, targetLang: keyof typeof LANGUAGE_CODES): Promise<string> {
  const langInfo = LANGUAGE_CODES[targetLang];
  const result = await withRetry(() => translateWithOpenAI(text, langInfo.code, langInfo.name), 1, 300);
  return result;
}

// Main export function - PARALLEL PROCESSING for speed
export async function translateText(text: string): Promise<TranslationResult> {
  console.log('🚀 Starting fast OpenAI translation...');
  
  if (!text.trim()) {
    throw new Error('No text provided for translation');
  }

  const languages = Object.keys(LANGUAGE_CODES) as (keyof typeof LANGUAGE_CODES)[];
  
  // PARALLEL PROCESSING - All languages at once for maximum speed
  const translationPromises = languages.map(async (lang) => {
    try {
      console.log(`🔄 Starting ${LANGUAGE_CODES[lang].name}...`);
      const translation = await translateToLanguage(text, lang);
      console.log(`✅ ${LANGUAGE_CODES[lang].name} completed`);
      return { lang, translation, success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ ${LANGUAGE_CODES[lang].name} failed:`, errorMsg);
      return { lang, translation: '', success: false, error: errorMsg };
    }
  });

  // Wait for all translations to complete
  const results = await Promise.all(translationPromises);
  
  // Build result object
  const result: Partial<TranslationResult> = {};
  const errors: string[] = [];
  
  results.forEach(({ lang, translation, success, error }) => {
    result[lang] = translation;
    if (!success && error) {
      errors.push(`${LANGUAGE_CODES[lang].name}: ${error}`);
    }
  });

  // If all translations failed, throw an error
  if (errors.length === languages.length) {
    throw new Error(`All translations failed. Errors: ${errors.join('; ')}`);
  }

  // Log warnings for partial failures
  if (errors.length > 0) {
    console.warn(`Some translations failed: ${errors.join('; ')}`);
  }

  const successCount = languages.length - errors.length;
  console.log(`🎉 Fast translation completed in parallel! Success: ${successCount}/${languages.length}`);

  return result as TranslationResult;
}