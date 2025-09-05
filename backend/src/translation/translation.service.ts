import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class TranslationService {
  private rapidApiKey = '072b6adbc1msh3a56854cd14a96ap1406d3jsn48a320c4e7e8';
  private rapidApiHost = 'google-translate113.p.rapidapi.com';

  async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    // Skip translation if source and target are the same
    if (sourceLang === targetLang) {
      console.log(`🌐 Skipping translation: same language (${sourceLang})`);
      return text;
    }

    console.log(`🌐 Attempting translation: "${text}" from ${sourceLang} to ${targetLang}`);

    // Use RapidAPI Google Translate service (JSON endpoint)
    try {
      const response = await axios.post(
        'https://google-translate113.p.rapidapi.com/api/v1/translator/json',
        {
          from: sourceLang === 'auto' ? 'auto' : sourceLang,
          to: targetLang,
          json: { message: text }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-host': this.rapidApiHost,
            'x-rapidapi-key': this.rapidApiKey,
          },
          timeout: 2000
        }
      );

      if (response.data && response.data.trans && response.data.trans.message) {
        const translatedText = response.data.trans.message;
        console.log(`🌐 RapidAPI Success: "${text}" → "${translatedText}"`);
        return translatedText;
      } else {
        console.error('🌐 RapidAPI: Invalid response structure:', response.data);
        throw new Error('Invalid response structure');
      }
    } catch (error) {
      console.error('🌐 RapidAPI Translation error:', error.response?.data || error.message);
      console.log('🌐 Falling back to mock translation');
      // Fall back to mock translation on API error
    }

    // Mock translation for development/fallback
    const mockTranslations = {
      'hello': { 'es': 'hola', 'fr': 'bonjour', 'de': 'hallo', 'hi': 'नमस्ते', 'zh': '你好', 'ja': 'こんにちは', 'ko': '안녕하세요', 'ar': 'مرحبا' },
      'how are you': { 'es': '¿cómo estás?', 'fr': 'comment allez-vous?', 'de': 'wie geht es dir?', 'hi': 'आप कैसे हैं?', 'zh': '你好吗？', 'ja': '元気ですか？', 'ko': '어떻게 지내세요?', 'ar': 'كيف حالك؟' },
      'good morning': { 'es': 'buenos días', 'fr': 'bonjour', 'de': 'guten morgen', 'hi': 'सुप्रभात', 'zh': '早上好', 'ja': 'おはよう', 'ko': '좋은 아침', 'ar': 'صباح الخير' },
      'thank you': { 'es': 'gracias', 'fr': 'merci', 'de': 'danke', 'hi': 'धन्यवाद', 'zh': '谢谢', 'ja': 'ありがとう', 'ko': '감사합니다', 'ar': 'شكرا لك' },
      'yes': { 'es': 'sí', 'fr': 'oui', 'de': 'ja', 'hi': 'हाँ', 'zh': '是的', 'ja': 'はい', 'ko': '네', 'ar': 'نعم' },
      'no': { 'es': 'no', 'fr': 'non', 'de': 'nein', 'hi': 'नहीं', 'zh': '不', 'ja': 'いいえ', 'ko': '아니요', 'ar': 'لا' },
    };

    const lowerText = text.toLowerCase();
    const translation = mockTranslations[lowerText]?.[targetLang];
    
    console.log(`🔄 Mock translation: "${text}" (${sourceLang} → ${targetLang}) = "${translation || text}"`);
    return translation || text;
  }

  getSupportedLanguages(): string[] {
    return ['en', 'es', 'fr', 'de', 'hi', 'zh', 'ja', 'ko', 'ar', 'pt', 'ru', 'it'];
  }
}
