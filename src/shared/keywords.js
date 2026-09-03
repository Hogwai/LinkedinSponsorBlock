/**
 * Multi-language keyword sets for detecting sponsored/suggested/recommended posts.
 * Each keyword is lowercased and NFC-normalized. These are the embedded defaults;
 * remote config overrides may supplement or replace them at runtime.
 */

/**
 * Normalize text for keyword matching: lowercase + NFC (handles Unicode
 * composed/decomposed differences across scripts like Gurmukhi, Devanagari)
 * Strip invisible formatting characters (RLM, LRM, ZWJ, ZWNJ, etc.)
 * that LinkedIn inserts into right-to-left text.
 */
export function normalizeKeyword(text) {
    return text
        .toLowerCase()
        .normalize('NFC')
        .replace(/[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]+/g, '');
}

export const SHARED_KEYWORDS = {
    sponsored: new Set(
        [
            'Post sponsorisé', // FRENCH
            'Sponsorisé', // FRENCH
            'Sponsorisé par', // FRENCH
            'Sponsorisé • Partenariat avec', // FRENCH
            'En partenariat avec', // FRENCH
            'Promu(e) par', // FRENCH
            'Promu', // FRENCH
            'Promu • Partenariat avec', // FRENCH
            'Promu par', // FRENCH
            'Promues', // FRENCH
            'Promoted', // ENGLISH
            'Promoted by', // ENGLISH
            'Anzeige', // GERMAN
            'Gesponsert', // GERMAN
            'Gesponsert von', // GERMAN
            'Promocionado', // SPANISH
            'Promovida', // PORTUGUESE
            'الترويج', // ARABIC
            'تم الترويج', // ARABIC
            'Post sponsorizzato', // ITALIAN
            'Promosso da', // ITALIAN
            'Promosso', // ITALIAN
            'প্রমোটেড', // BANGLA
            'Propagováno', // CZECH
            'Propagace', // CZECH
            'Promoveret', // DANISH
            'Προωθημένη', // GREEK
            'تبلیغشده', // PERSIAN
            'Mainostettu', // FINNISH
            'प्रमोट किया गया', // HINDI
            'Kiemelt', // HUNGARIAN
            'Dipromosikan', // INDONESIAN / MALAYSIAN
            'ממומן', // HEBREW
            'プロモーション', // JAPANESE
            '광고', // KOREAN
            '주최:', // KOREAN
            'प्रमोट केले', // MARATHI
            'Gepromoot', // DUTCH
            'Promotert', // NORWEGIAN
            'ਪ੍ਰੋਮੋਟ ਕੀਤਾ ਗਿਆ', // PUNJABI
            'ਪ੍ਰੋਮੋਟ ਕੀਤਾ', // PUNJABI
            'Treść promowana', // POLISH
            'Promowane', // POLISH
            'Promovido', // PORTUGUESE
            'Promovat', // ROMANIAN
            'Продвигается', // RUSSIAN
            'Marknadsfört', // SWEDISH
            'ప్రమోట్ చేయబడింది', // TELUGU
            'ได้รับการโปรโมท', // THAI
            'Nai-promote', // TAGALOG
            'Öne çıkarılan içerik', // TURKISH
            'Tanıtılan içerik', // TURKISH
            'Просувається', // UKRAINIAN
            'Được quảng bá', // VIETNAMESE
            '广告', // CHINESE (SIMPLIFIED)
            '推广', // CHINESE (SIMPLIFIED)
            '促銷內容', // CHINESE (TRADITIONAL)
            '贊助', // CHINESE (TRADITIONAL)
            '宣傳單位：', // CHINESE (TRADITIONAL)
        ].map(normalizeKeyword),
    ),
    suggested: new Set(
        [
            'Suggestions', // FRENCH
            'D’après votre activité', // FRENCH
            'Suggested', // ENGLISH
            'From your activity', // ENGLISH
            'Vorgeschlagen', // GERMAN
            'Aus Ihren Aktivitäten', // GERMAN
            'Sugerencias', // SPANISH
            'De tu actividad', // SPANISH
            'Sugestões', // PORTUGUESE
            'Das suas atividades', // PORTUGUESE
            'Followed by', // ENGLISH
            'Suivi par', // FRENCH
            'Gefolgt von', // GERMAN
            'Sind Follower:innen', // GERMAN
            'ist Follower:in', // GERMAN
            'Seguido por', // SPANISH / PORTUGUESE
            'Seguito da', // ITALIAN
            'Gevolgd door', // DUTCH
            'Følges av', // NORWEGIAN
            'Följs av', // SWEDISH
            'Diikuti oleh', // INDONESIAN / MALAY
            'Urmărit de', // ROMANIAN
            'Следят', // BULGARIAN
            'Takip edilen', // TURKISH
            'ติดตามโดย', // THAI
            'Được theo dõi bởi', // VIETNAMESE
            'ακολουθείται από', // GREEK
            'によってフォロー', // JAPANESE
            'से अनुसरण', // HINDI
            '팔로우한 사람', // KOREAN
            'متابعة من', // ARABIC
            'ถูกติดตามโดย', // THAI alternative
        ].map(normalizeKeyword),
    ),
    recommended: new Set(
        [
            'Recommended for you', // ENGLISH
            'Recommandé pour vous', // FRENCH
            'Te recomendamos', // SPANISH
            'Recomendações para você', // PORTUGUESE
            'Für Sie empfohlen', // GERMAN
            'Consigliato per te', // ITALIAN
            'आपके लिए सुझाव', // HINDI
            'مقترح لك', // ARABIC
            '为您推荐', // CHINESE (SIMPLIFIED)
            '精選內容', // CHINESE (TRADITIONAL)
            'おすすめのコース', // JAPANESE
            'Рекомендуем для вас', // RUSSIAN
            'Polecane dla Ciebie', // POLISH
            '맞춤 추천', // KOREAN
            '추천됨', // KOREAN
            'Рекомендовані для вас', // UKRAINIAN
            'Aanbevolen voor u', // DUTCH
            'Doporučeno pro vás', // CZECH
            'Sizin için önerilenler', // TURKISH
            'আপনার জন্য সুপারিশকৃত', // BENGALI
            'Anbefalet til dig', // DANISH
            'Προτεινόμενα για εσάς', // GREEK
            'توصیهشده برای شما', // PERSIAN
            'Suositellut sinulle', // FINNISH
            'Önnek javasolt', // HUNGARIAN
            'Rekomendasi untuk Anda', // INDONESIAN
            'מומלצים עבורך', // HEBREW
            'तुमच्यासाठी शिफारस केलेले', // MARATHI
            'Dicadangkan untuk anda', // MALAY
            'Anbefalt for deg', // NORWEGIAN
            'ਤੁਹਾਡੇ ਲਈ ਸਿਫ਼ਾਰਸ਼ੀ', // PUNJABI
            'Recomandat pentru dvs.', // ROMANIAN
            'Rekommenderat för dig', // SWEDISH
            'మీ కోసం సిఫార్సు చేయబడినవి', // TELUGU
            'แนะนำสำหรับคุณ', // THAI
            'Inirerekomenda para sa iyo', // TAGALOG
            'Đề xuất cho bạn', // VIETNAMESE
        ].map(normalizeKeyword),
    ),
};
