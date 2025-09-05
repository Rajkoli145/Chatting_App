import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class TranslationService {
  private rapidApiKey = '88ee2cabcemsh738ab4f522c7f86p1ccd3djsn33cbd644dc8e';
  private rapidApiHost = 'google-translate113.p.rapidapi.com';

  async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    // Skip translation if source and target are the same
    if (sourceLang === targetLang) {
      console.log(`🌐 Skipping translation: same language (${sourceLang})`);
      return text;
    }

    console.log(`🌐 Attempting translation: "${text}" from ${sourceLang} to ${targetLang}`);

    // Try LibreTranslate (free API) first
    try {
      const response = await axios.post(
        'https://libretranslate.de/translate',
        {
          q: text,
          source: sourceLang,
          target: targetLang,
          format: 'text'
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 5000
        }
      );

      if (response.data && response.data.translatedText) {
        const translatedText = response.data.translatedText;
        console.log(`🌐 LibreTranslate Success: "${text}" → "${translatedText}"`);
        return translatedText;
      }
    } catch (error) {
      console.error('🌐 LibreTranslate error:', error.response?.data || error.message);
    }

    // Fallback to Google Translate API (JSON format)
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
          timeout: 5000
        }
      );

      if (response.data && response.data.trans && response.data.trans.message) {
        const translatedText = response.data.trans.message;
        console.log(`🌐 Google Translate Success: "${text}" → "${translatedText}"`);
        return translatedText;
      }
    } catch (error) {
      console.error('🌐 Google Translate error:', error.response?.data || error.message);
      console.log('🌐 Falling back to mock translation');
    }

    // Enhanced mock translation for development/fallback
    const mockTranslations = {
      'hello': { 'es': 'hola', 'fr': 'bonjour', 'de': 'hallo', 'hi': 'नमस्ते', 'zh': '你好', 'ja': 'こんにちは', 'ko': '안녕하세요', 'ar': 'مرحبا' },
      'hi': { 'es': 'hola', 'fr': 'salut', 'de': 'hallo', 'hi': 'नमस्ते', 'zh': '你好', 'ja': 'こんにちは', 'ko': '안녕하세요', 'ar': 'مرحبا' },
      'hii': { 'es': 'hola', 'fr': 'salut', 'de': 'hallo', 'hi': 'नमस्ते', 'zh': '你好', 'ja': 'こんにちは', 'ko': '안녕하세요', 'ar': 'مرحبا' },
      'hiii': { 'es': 'hola', 'fr': 'salut', 'de': 'hallo', 'hi': 'नमस्ते', 'zh': '你好', 'ja': 'こんにちは', 'ko': '안녕하세요', 'ar': 'مرحبا' },
      'heelo': { 'es': 'hola', 'fr': 'bonjour', 'de': 'hallo', 'hi': 'नमस्ते', 'zh': '你好', 'ja': 'こんにちは', 'ko': '안녕하세요', 'ar': 'مرحبا' },
      'how are you': { 'es': '¿cómo estás?', 'fr': 'comment allez-vous?', 'de': 'wie geht es dir?', 'hi': 'आप कैसे हैं?', 'zh': '你好吗？', 'ja': '元気ですか？', 'ko': '어떻게 지내세요?', 'ar': 'كيف حالك؟' },
      'how are u': { 'es': '¿cómo estás?', 'fr': 'comment allez-vous?', 'de': 'wie geht es dir?', 'hi': 'आप कैसे हैं?', 'zh': '你好吗？', 'ja': '元気ですか？', 'ko': '어떻게 지내세요?', 'ar': 'كيف حالك؟' },
      'how are u ?': { 'es': '¿cómo estás?', 'fr': 'comment allez-vous?', 'de': 'wie geht es dir?', 'hi': 'आप कैसे हैं?', 'zh': '你好吗？', 'ja': '元気ですか？', 'ko': '어떻게 지내세요?', 'ar': 'كيف حالك؟' },
      'how are u ??': { 'es': '¿cómo estás?', 'fr': 'comment allez-vous?', 'de': 'wie geht es dir?', 'hi': 'आप कैसे हैं?', 'zh': '你好吗？', 'ja': '元気ですか？', 'ko': '어떻게 지내세요?', 'ar': 'कैसे हो?' },
      'how are u bro': { 'es': '¿cómo estás hermano?', 'fr': 'comment ça va frère?', 'de': 'wie geht es dir bruder?', 'hi': 'कैसे हो भाई?', 'zh': '你好吗兄弟？', 'ja': '元気ですか兄弟？', 'ko': '어떻게 지내세요 형?', 'ar': 'كيف حالك أخي؟' },
      'how are u bro ?': { 'es': '¿cómo estás hermano?', 'fr': 'comment ça va frère?', 'de': 'wie geht es dir bruder?', 'hi': 'कैसे हो भाई?', 'zh': '你好吗兄弟？', 'ja': '元気ですか兄弟？', 'ko': '어떻게 지내세요 형?', 'ar': 'كيف حالك أخي؟' },
      'how are u brother': { 'es': '¿cómo estás hermano?', 'fr': 'comment ça va frère?', 'de': 'wie geht es dir bruder?', 'hi': 'कैसे हो भाई?', 'zh': '你好吗兄弟？', 'ja': '元気ですか兄弟？', 'ko': '어떻게 지내세요 형?', 'ar': 'كيف حالك أخي؟' },
      'how are u brother ?': { 'es': '¿cómo estás hermano?', 'fr': 'comment ça va frère?', 'de': 'wie geht es dir bruder?', 'hi': 'कैसे हो भाई?', 'zh': '你好吗兄弟？', 'ja': '元気ですか兄弟？', 'ko': '어떻게 지내세요 형?', 'ar': 'كيف حالك أخي؟' },
      'hiiii': { 'es': 'hola', 'fr': 'salut', 'de': 'hallo', 'hi': 'नमस्ते', 'zh': '你好', 'ja': 'こんにちは', 'ko': '안녕하세요', 'ar': 'مرحبا' },
      'bhai': { 'es': 'hermano', 'fr': 'frère', 'de': 'bruder', 'hi': 'भाई', 'zh': '兄弟', 'ja': '兄弟', 'ko': '형', 'ar': 'أخي' },
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
