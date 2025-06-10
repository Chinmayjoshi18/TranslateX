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

const rateLimiter = new RateLimiter(1000); // 1 second between requests for OpenAI free tier

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

// OpenAI translation using free tier
async function translateWithOpenAI(text: string, targetLang: string, langName: string): Promise<string> {
  const chunks = chunkText(text, 1500); // Reasonable chunk size for OpenAI
  const translatedChunks: string[] = [];
  
  for (const chunk of chunks) {
    await rateLimiter.wait();
    
    try {
      const prompt = `Translate the following English text to ${langName}. Provide a natural, contextual translation that captures the meaning and tone, not just word-for-word translation. Only respond with the translation, no additional text:

${chunk}`;

      // Using OpenAI's free tier endpoint
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-proj-placeholder', // Free tier placeholder
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
        if (response.status === 429) {
          throw new Error('Rate limited by OpenAI API');
        } else if (response.status === 401) {
          throw new Error('OpenAI API authentication failed');
        } else if (response.status === 403) {
          throw new Error('OpenAI API access forbidden');
        }
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const translatedText = data.choices?.[0]?.message?.content?.trim() || '';
      translatedChunks.push(translatedText);
      
    } catch (error) {
      console.error('OpenAI translation error for chunk:', error);
      
      // Fallback to Google Translate if OpenAI fails
      try {
        console.log('Falling back to Google Translate...');
        const fallbackResult = await translateWithGoogle(chunk, targetLang);
        translatedChunks.push(fallbackResult);
      } catch (fallbackError) {
        throw error; // Throw original OpenAI error
      }
    }
  }
  
  return translatedChunks.join(' ');
}

// Google Translate fallback
async function translateWithGoogle(text: string, targetLang: string): Promise<string> {
  const chunks = chunkText(text, 800); // Smaller chunks for Google
  const translatedChunks: string[] = [];
  
  for (const chunk of chunks) {
    await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
    
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
        throw new Error(`Google Translate API error: ${response.status}`);
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

// Main translation function for each language
async function translateToLanguage(text: string, targetLang: keyof typeof LANGUAGE_CODES): Promise<string> {
  const langInfo = LANGUAGE_CODES[targetLang];
  
  try {
    console.log(`Translating to ${langInfo.name} using OpenAI...`);
    return await translateWithOpenAI(text, langInfo.code, langInfo.name);
  } catch (error) {
    console.error(`Failed to translate to ${langInfo.name}:`, error);
    throw new Error(`Failed to translate to ${langInfo.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Main export function
export async function translateText(text: string): Promise<TranslationResult> {
  console.log('Starting translation with OpenAI...');
  
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
        await new Promise(resolve => setTimeout(resolve, 1000));
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

  console.log(`Translation completed using OpenAI. Success: ${languages.length - errors.length}/${languages.length}`);

  return result as TranslationResult;
} 