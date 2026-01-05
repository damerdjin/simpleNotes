
// i18n.js
// Handles language initialization and application

export const initLanguage = () => {
    // Check localStorage first
    let savedLang = localStorage.getItem('corrections-language');
    
    // If not set, detect from browser
    if (!savedLang) {
        const browserLang = navigator.language || navigator.userLanguage;
        if (browserLang.startsWith('ar')) {
            savedLang = 'ar';
        } else if (browserLang.startsWith('en')) {
            savedLang = 'en';
        } else {
            savedLang = 'fr';
        }
    }
    
    // Apply the language
    applyLanguage(savedLang);
    return savedLang;
};

export const changeLanguage = (lang) => {
    localStorage.setItem('corrections-language', lang);
    applyLanguage(lang);
    
    // Dispatch event so other components can react if needed
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
};

export const t = (key) => {
    const lang = localStorage.getItem('corrections-language') || 'fr';
    if (window.translations && window.translations[lang] && window.translations[lang][key]) {
        return window.translations[lang][key];
    }
    return key; // Fallback to key if not found
};
window.t = t;

export const applyLanguage = (lang) => {
    window.currentLanguage = lang;
    const isRTL = lang === 'ar';
    document.body.dir = isRTL ? 'rtl' : 'ltr';
    
    if (isRTL) {
        document.body.classList.add('rtl-layout');
        document.body.classList.remove('ltr-layout');
    } else {
        document.body.classList.add('ltr-layout');
        document.body.classList.remove('rtl-layout');
    }
    
    // Update translations if window.translations is available
    if (window.translations && window.translations[lang]) {
        const t = window.translations[lang];
        
        // Translate elements with data-translate attribute
        document.querySelectorAll('[data-translate]').forEach(el => {
            const key = el.getAttribute('data-translate');
            if (t[key]) {
                if (el.tagName === 'INPUT' && (el.type === 'submit' || el.type === 'button')) {
                    el.value = t[key];
                } else {
                    el.textContent = t[key];
                }
            }
        });
        
        // Translate placeholders
        document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
            const key = el.getAttribute('data-translate-placeholder');
            if (t[key]) {
                el.placeholder = t[key];
            }
        });

        // Translate titles
        document.querySelectorAll('[data-translate-title]').forEach(el => {
            const key = el.getAttribute('data-translate-title');
            if (t[key]) {
                el.title = t[key];
            }
        });
    }
};
