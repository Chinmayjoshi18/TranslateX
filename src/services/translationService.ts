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



// Google Translate API implementation (you'll need to add your API key)
const googleTranslate = async (text: string): Promise<TranslationResult> => {
  const API_KEY = import.meta.env.VITE_GOOGLE_TRANSLATE_API_KEY;
  
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

  const [spanish, french] = await Promise.all([
    translateToLanguage('es'),
    translateToLanguage('fr')
  ]);

  return { spanish, french };
};

// OpenAI API implementation (alternative option)
const openAITranslate = async (text: string): Promise<TranslationResult> => {
  const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
  
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
          content: 'You are a professional translator. Translate the given English text to Spanish and French. Return only a JSON object with "spanish" and "french" keys containing the translations.'
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

// Free translation service using Google Translate (no API key required)
const freeGoogleTranslate = async (text: string): Promise<TranslationResult> => {
  try {
    // Preserve formatting by splitting on line breaks and translating each part
    const lines = text.split('\n');
    
    const translateLines = async (targetLang: string) => {
      const translatedLines = await Promise.all(
        lines.map(async (line) => {
          if (!line.trim()) {
            return line; // Preserve empty lines
          }
          
          const response = await fetch(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(line)}`
          );
          
          if (!response.ok) {
            throw new Error('Translation failed');
          }
          
          const data = await response.json();
          return data[0][0][0]; // Extract translated text
        })
      );
      
      return translatedLines.join('\n');
    };

    const [spanish, french, turkish, russian, ukrainian, portuguese, chinese, japanese, arabic] = await Promise.all([
      translateLines('es'),
      translateLines('fr'),
      translateLines('tr'),
      translateLines('ru'),
      translateLines('uk'),
      translateLines('pt'),
      translateLines('zh'),
      translateLines('ja'),
      translateLines('ar')
    ]);

    return { spanish, french, turkish, russian, ukrainian, portuguese, chinese, japanese, arabic };
  } catch (error) {
    console.error('Free Google Translate failed:', error);
    throw new Error('Translation service unavailable. Please check your internet connection.');
  }
};

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
    // Using real Google Translate service (no API key required)
    return await freeGoogleTranslate(text);
    
    // Alternative real translation options:
    // return await googleTranslate(text); // Official Google API with key (more reliable)
    // return await openAITranslate(text); // OpenAI API with key (AI-powered)
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}; 