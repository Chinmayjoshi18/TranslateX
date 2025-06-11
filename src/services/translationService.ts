// Translation service using only OpenAI
// Simple, efficient translation with proper error handling and chunking

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

const openaiRateLimiter = new RateLimiter(1000); // 1 second for OpenAI

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
function chunkText(text: string, maxChunkSize: number = 1500): string[] {
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

// Get OpenAI API key from environment
function getOpenAIApiKey(): string {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not found. Please set VITE_OPENAI_API_KEY in your environment variables.');
  }
  return apiKey;
}

// OpenAI translation
async function translateWithOpenAI(text: string, targetLang: string, langName: string): Promise<string> {
  const chunks = chunkText(text, 1500);
  const translatedChunks: string[] = [];
  
  for (const chunk of chunks) {
    await openaiRateLimiter.wait();
    
    const prompt = `Translate the following English text to ${langName}. Provide a natural, contextual translation that captures the meaning and tone, not just word-for-word translation. Only respond with the translation, no additional text:

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
            content: 'You are a professional translator. Provide natural, contextual translations that preserve meaning and tone.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
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
    
    translatedChunks.push(translatedText);
  }
  
  return translatedChunks.join(' ');
}

// Main translation function for each language
async function translateToLanguage(text: string, targetLang: keyof typeof LANGUAGE_CODES): Promise<string> {
  const langInfo = LANGUAGE_CODES[targetLang];
  
  console.log(`🔄 Translating to ${langInfo.name}...`);
  
  const result = await withRetry(() => translateWithOpenAI(text, langInfo.code, langInfo.name), 2, 1000);
  
  console.log(`✅ Completed translation to ${langInfo.name}`);
  
  return result;
}

// Main export function
export async function translateText(text: string): Promise<TranslationResult> {
  console.log('🚀 Starting OpenAI translation...');
  
  if (!text.trim()) {
    throw new Error('No text provided for translation');
  }

  const languages = Object.keys(LANGUAGE_CODES) as (keyof typeof LANGUAGE_CODES)[];
  const result: Partial<TranslationResult> = {};
  const errors: string[] = [];

  // Sequential processing to avoid overwhelming the API
  for (const lang of languages) {
    try {
      console.log(`🔄 Processing ${LANGUAGE_CODES[lang].name}...`);
      
      const translation = await translateToLanguage(text, lang);
      result[lang] = translation;
      
      console.log(`✓ ${LANGUAGE_CODES[lang].name}: completed`);
      
      // Add delay between languages to respect rate limits
      if (languages.indexOf(lang) < languages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
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

  console.log(`🎉 OpenAI translation completed. Success: ${languages.length - errors.length}/${languages.length}`);

  return result as TranslationResult;
}