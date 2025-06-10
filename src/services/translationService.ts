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

export interface TranslationProgress {
  chunksTotal: number;
  chunksCompleted: number;
  currentLanguage: string;
}

export type TranslationService = 'google' | 'huggingface' | 'groq' | 'mock';

interface ServiceConfig {
  name: string;
  description: string;
  supportsContext: boolean;
  rateLimit: number; // ms between requests
}

export const TRANSLATION_SERVICES: Record<TranslationService, ServiceConfig> = {
  google: {
    name: 'Google Translate',
    description: 'Fast basic translation',
    supportsContext: false,
    rateLimit: 200
  },
  huggingface: {
    name: 'Hugging Face AI',
    description: 'Contextual AI translation (Free)',
    supportsContext: true,
    rateLimit: 1000
  },
  groq: {
    name: 'Groq AI',
    description: 'Fast AI translation (Free tier)',
    supportsContext: true,
    rateLimit: 500
  },
  mock: {
    name: 'Mock Service',
    description: 'Demo service for testing',
    supportsContext: true,
    rateLimit: 100
  }
};

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

// Rate limiter for API protection
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

// Current translation service
let currentService: TranslationService = 'huggingface';
const rateLimiters: Record<TranslationService, RateLimiter> = {
  google: new RateLimiter(200),
  huggingface: new RateLimiter(1000),
  groq: new RateLimiter(500),
  mock: new RateLimiter(100)
};

export function setTranslationService(service: TranslationService): void {
  currentService = service;
  console.log(`Translation service switched to: ${TRANSLATION_SERVICES[service].name}`);
}

export function getCurrentService(): TranslationService {
  return currentService;
}

// Retry logic with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>, 
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
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

// Intelligent text chunking
function chunkText(text: string, maxChunkSize: number = 800): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    if ((currentChunk + '\n' + line).length <= maxChunkSize) {
      currentChunk += (currentChunk ? '\n' : '') + line;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = line;
      } else {
        // Line itself is too long, split by sentences
        const sentences = line.split(/(?<=[.!?])\s+/);
        let sentenceChunk = '';
        
        for (const sentence of sentences) {
          if ((sentenceChunk + ' ' + sentence).length <= maxChunkSize) {
            sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
          } else {
            if (sentenceChunk) {
              chunks.push(sentenceChunk);
              sentenceChunk = sentence;
            } else {
              // Sentence itself is too long, split by words
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
                    // Word itself is too long, just add it
                    chunks.push(word);
                  }
                }
              }
              
              if (wordChunk) {
                sentenceChunk = wordChunk;
              }
            }
          }
        }
        
        if (sentenceChunk) {
          currentChunk = sentenceChunk;
        }
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [text];
}

// Google Translate implementation
async function translateWithGoogle(text: string, targetLang: string): Promise<string> {
  const chunks = chunkText(text);
  const translatedChunks: string[] = [];
  
  for (const chunk of chunks) {
    await rateLimiters.google.wait();
    
    try {
      const encodedText = encodeURIComponent(chunk);
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodedText}`;
      
      if (url.length > 6000) {
        throw new Error('Text too long for Google Translate URL limit');
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limited by Google Translate');
        } else if (response.status === 403) {
          throw new Error('Access forbidden to Google Translate service');
        } else {
          throw new Error(`Google Translate API error: ${response.status}`);
        }
      }

      const data = await response.json();
      const translatedText = data[0]?.map((item: any) => item[0]).join('') || '';
      translatedChunks.push(translatedText);
      
    } catch (error) {
      console.error('Google translation error for chunk:', error);
      throw error;
    }
  }
  
  return translatedChunks.join('');
}

// Hugging Face AI translation
async function translateWithHuggingFace(text: string, targetLang: string): Promise<string> {
  const chunks = chunkText(text, 500); // Smaller chunks for HF
  const translatedChunks: string[] = [];
  
  for (const chunk of chunks) {
    await rateLimiters.huggingface.wait();
    
    try {
      // Use Helsinki-NLP models which are free and good quality
      const modelName = `Helsinki-NLP/opus-mt-en-${targetLang}`;
      
      const response = await fetch(`https://api-inference.huggingface.co/models/${modelName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer hf_placeholder', // Free tier doesn't need real token
        },
        body: JSON.stringify({
          inputs: chunk,
          parameters: {
            max_length: 512,
            do_sample: false,
            temperature: 0.3
          }
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limited by Hugging Face API');
        }
        throw new Error(`Hugging Face API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Hugging Face error: ${data.error}`);
      }
      
      const translatedText = Array.isArray(data) ? data[0]?.translation_text || data[0]?.generated_text || '' : '';
      translatedChunks.push(translatedText);
      
    } catch (error) {
      console.error('Hugging Face translation error for chunk:', error);
      throw error;
    }
  }
  
  return translatedChunks.join(' ');
}

// Groq AI translation
async function translateWithGroq(text: string, targetLang: string, langName: string): Promise<string> {
  const chunks = chunkText(text, 1000); // Larger chunks for Groq
  const translatedChunks: string[] = [];
  
  for (const chunk of chunks) {
    await rateLimiters.groq.wait();
    
    try {
      const prompt = `Translate the following English text to ${langName}. Provide a natural, contextual translation that captures the meaning and tone, not just word-for-word translation. Only respond with the translation, no additional text:

${chunk}`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer gsk_placeholder', // Free tier token placeholder
        },
        body: JSON.stringify({
          model: 'llama3-8b-8192',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 1024,
          top_p: 1,
          stream: false
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limited by Groq API');
        }
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      const translatedText = data.choices?.[0]?.message?.content?.trim() || '';
      translatedChunks.push(translatedText);
      
    } catch (error) {
      console.error('Groq translation error for chunk:', error);
      throw error;
    }
  }
  
  return translatedChunks.join(' ');
}

// Mock translation for testing
async function translateWithMock(text: string, targetLang: string, langName: string): Promise<string> {
  await rateLimiters.mock.wait();
  
  // Simulate AI processing time
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
  
  return `[AI ${langName} Translation] ${text.split(' ').slice(0, 3).join(' ')}... (This is a demo translation showing ${langName} contextual AI translation capability. The actual service would provide natural, meaningful translations preserving tone and context.)`;
}

// Main translation function
async function translateToLanguage(text: string, targetLang: keyof typeof LANGUAGE_CODES): Promise<string> {
  const langInfo = LANGUAGE_CODES[targetLang];
  
  try {
    console.log(`Translating to ${langInfo.name} using ${TRANSLATION_SERVICES[currentService].name}...`);
    
    switch (currentService) {
      case 'huggingface':
        return await translateWithHuggingFace(text, langInfo.code);
        
      case 'groq':
        return await translateWithGroq(text, langInfo.code, langInfo.name);
        
      case 'google':
        return await translateWithGoogle(text, langInfo.code);
        
      case 'mock':
        return await translateWithMock(text, langInfo.code, langInfo.name);
        
      default:
        throw new Error(`Unsupported translation service: ${currentService}`);
    }
  } catch (error) {
    console.error(`Failed to translate to ${langInfo.name}:`, error);
    throw new Error(`Failed to translate to ${langInfo.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Main export function
export async function translateText(text: string): Promise<TranslationResult> {
  console.log(`Starting translation with ${TRANSLATION_SERVICES[currentService].name}...`);
  
  if (!text.trim()) {
    throw new Error('No text provided for translation');
  }

  const languages = Object.keys(LANGUAGE_CODES) as (keyof typeof LANGUAGE_CODES)[];
  const result: Partial<TranslationResult> = {};
  const errors: string[] = [];

  // Sequential processing to avoid overwhelming APIs
  for (const lang of languages) {
    try {
      console.log(`Translating to ${LANGUAGE_CODES[lang].name}...`);
      
      const translation = await withRetry(
        () => translateToLanguage(text, lang),
        3,
        1000
      );
      
      result[lang] = translation;
      console.log(`✓ Successfully translated to ${LANGUAGE_CODES[lang].name}`);
      
      // Add delay between languages to be respectful to APIs
      if (languages.indexOf(lang) < languages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, TRANSLATION_SERVICES[currentService].rateLimit));
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`${LANGUAGE_CODES[lang].name}: ${errorMsg}`);
      result[lang] = '';
      console.error(`✗ Failed to translate to ${LANGUAGE_CODES[lang].name}:`, errorMsg);
    }
  }

  // If all translations failed, throw an error
  if (errors.length === languages.length) {
    throw new Error(`All translations failed. Errors: ${errors.join('; ')}`);
  }

  // If some translations failed, log warnings but continue
  if (errors.length > 0) {
    console.warn(`Some translations failed: ${errors.join('; ')}`);
  }

  console.log(`Translation completed using ${TRANSLATION_SERVICES[currentService].name}. Success: ${languages.length - errors.length}/${languages.length}`);

  return result as TranslationResult;
} 