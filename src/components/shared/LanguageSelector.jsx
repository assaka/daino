import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useTranslation } from '../../contexts/TranslationContext';

/**
 * Language Selector Component
 *
 * Dropdown for selecting the current language
 * Displays in both storefront and admin interfaces
 */
export default function LanguageSelector({ variant = 'default', className = '' }) {
  const {
    currentLanguage,
    availableLanguages,
    changeLanguage,
    loading
  } = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = async (langCode) => {
    await changeLanguage(langCode);
    setIsOpen(false);
  };

  const currentLang = availableLanguages.find(lang => lang.code === currentLanguage) ||
                      availableLanguages[0];

  if (loading || availableLanguages.length === 0) {
    return null;
  }

  // Don't show if only one language is available
  if (availableLanguages.length === 1) {
    return null;
  }

  // Variant styles
  const variants = {
    default: {
      button: 'bg-white hover:bg-gray-50 border border-gray-300 text-gray-700',
      dropdown: 'bg-white border border-gray-200 shadow-lg',
      item: 'hover:bg-gray-100 text-gray-700',
      itemActive: 'bg-blue-50 text-blue-700'
    },
    storefront: {
      button: 'bg-white hover:bg-gray-50 border border-gray-200 text-gray-700',
      dropdown: 'bg-white border border-gray-200 shadow-lg',
      item: 'hover:bg-gray-100 text-gray-700',
      itemActive: 'bg-blue-50 text-blue-700'
    },
    header: {
      button: 'bg-transparent hover:bg-gray-800/50 border border-gray-700 text-white',
      dropdown: 'bg-gray-800 border border-gray-700 shadow-xl',
      item: 'hover:bg-gray-700 text-gray-200',
      itemActive: 'bg-gray-700 text-white'
    }
  };

  const style = variants[variant] || variants.default;

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Language selector button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center gap-2 px-3 py-2 rounded-lg
          transition-colors duration-200 text-sm font-medium
          ${style.button}
        `}
        aria-label="Select language"
        aria-expanded={isOpen}
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{currentLang?.native_name || currentLang?.name}</span>
        <span className="sm:hidden">{currentLang?.code?.toUpperCase()}</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className={`
          absolute right-0 mt-2 w-56 rounded-lg overflow-hidden z-50
          ${style.dropdown}
        `}>
          <div className="py-1">
            {availableLanguages.map((language) => {
              const isActive = language.code === currentLanguage;

              return (
                <button
                  key={language.code}
                  onClick={() => handleLanguageChange(language.code)}
                  className={`
                    w-full px-4 py-2.5 text-left flex items-center justify-between
                    transition-colors duration-150
                    ${isActive ? style.itemActive : style.item}
                  `}
                >
                  <div className="flex items-center gap-3">
                    {/* Flag emoji or icon */}
                    <span className="text-lg">{getFlagEmoji(language.code)}</span>

                    <div>
                      <div className="text-sm font-medium">
                        {language.native_name}
                      </div>
                      <div className="text-xs opacity-70">
                        {language.name}
                      </div>
                    </div>
                  </div>

                  {isActive && (
                    <Check className="w-4 h-4" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer with language count */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2">
            <div className="text-xs opacity-60">
              {availableLanguages.length} {availableLanguages.length === 1 ? 'language' : 'languages'} available
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Get flag emoji for language code
 */
function getFlagEmoji(langCode) {
  const flags = {
    'en': '🇬🇧',
    'es': '🇪🇸',
    'fr': '🇫🇷',
    'de': '🇩🇪',
    'it': '🇮🇹',
    'pt': '🇵🇹',
    'nl': '🇳🇱',
    'pl': '🇵🇱',
    'ru': '🇷🇺',
    'zh': '🇨🇳',
    'ja': '🇯🇵',
    'ko': '🇰🇷',
    'ar': '🇸🇦',
    'he': '🇮🇱',
    'tr': '🇹🇷',
    'hi': '🇮🇳',
    'th': '🇹🇭',
    'vi': '🇻🇳',
    'sv': '🇸🇪',
    'no': '🇳🇴',
    'da': '🇩🇰',
    'fi': '🇫🇮'
  };

  return flags[langCode] || '🌐';
}

/**
 * Compact Language Selector (for mobile)
 */
export function CompactLanguageSelector({ className = '' }) {
  const { currentLanguage, availableLanguages, changeLanguage } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  if (availableLanguages.length <= 1) {
    return null;
  }

  const currentLang = availableLanguages.find(lang => lang.code === currentLanguage);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Select language"
      >
        <Globe className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {availableLanguages.map((language) => (
            <button
              key={language.code}
              onClick={() => {
                changeLanguage(language.code);
                setIsOpen(false);
              }}
              className={`
                w-full px-3 py-2 text-left text-sm
                ${language.code === currentLanguage ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-100'}
              `}
            >
              {getFlagEmoji(language.code)} {language.native_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Simple Language Toggle (2 languages only)
 */
export function LanguageToggle({ className = '' }) {
  const { currentLanguage, availableLanguages, changeLanguage } = useTranslation();

  if (availableLanguages.length !== 2) {
    return <LanguageSelector variant="storefront" className={className} />;
  }

  const otherLanguage = availableLanguages.find(lang => lang.code !== currentLanguage);

  if (!otherLanguage) {
    return null;
  }

  return (
    <button
      onClick={() => changeLanguage(otherLanguage.code)}
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
        bg-white hover:bg-gray-50 border border-gray-200
        text-sm font-medium text-gray-700 transition-colors
        ${className}
      `}
      aria-label={`Switch to ${otherLanguage.name}`}
    >
      <Globe className="w-4 h-4" />
      <span>{otherLanguage.code.toUpperCase()}</span>
    </button>
  );
}
