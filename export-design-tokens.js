#!/usr/bin/env node

/**
 * Экспорт дизайн-токенов для Figma
 * Генерирует JSON файл с цветами, типографикой и размерами
 */

const fs = require('fs');
const path = require('path');

const designTokens = {
  colors: {
    primary: {
      value: '#155EEF',
      type: 'color',
      description: 'Основной цвет - кнопки, ссылки, акценты'
    },
    background: {
      value: '#FFFFFF',
      type: 'color',
      description: 'Основной фон страниц'
    },
    backgroundMuted: {
      value: '#F6F8FA',
      type: 'color',
      description: 'Приглушенный фон - карточки, ховер'
    },
    text: {
      value: '#0B1220',
      type: 'color',
      description: 'Основной текст'
    },
    textMuted: {
      value: '#5B6877',
      type: 'color',
      description: 'Приглушенный текст'
    },
    border: {
      value: '#E5E7EB',
      type: 'color',
      description: 'Границы карточек, разделители'
    },
    gradientPrimary: {
      value: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
      type: 'gradient',
      description: 'Градиент для primary кнопок'
    }
  },
  typography: {
    fontFamily: {
      primary: {
        value: 'Inter',
        type: 'fontFamily',
        description: 'Основной шрифт'
      },
      heading: {
        value: 'Manrope',
        type: 'fontFamily',
        description: 'Шрифт для заголовков'
      }
    },
    fontSize: {
      h1: {
        value: '52px',
        type: 'fontSize',
        description: 'Hero заголовок'
      },
      h2: {
        value: '36px',
        type: 'fontSize',
        description: 'Заголовок секции'
      },
      h3: {
        value: '24px',
        type: 'fontSize',
        description: 'Подзаголовок'
      },
      body: {
        value: '16px',
        type: 'fontSize',
        description: 'Основной текст'
      },
      small: {
        value: '14px',
        type: 'fontSize',
        description: 'Мелкий текст'
      }
    },
    fontWeight: {
      regular: { value: '400', type: 'fontWeight' },
      medium: { value: '500', type: 'fontWeight' },
      semibold: { value: '600', type: 'fontWeight' },
      bold: { value: '700', type: 'fontWeight' },
      extrabold: { value: '800', type: 'fontWeight' }
    },
    lineHeight: {
      tight: { value: '1.05', type: 'lineHeight' },
      normal: { value: '1.2', type: 'lineHeight' },
      relaxed: { value: '1.6', type: 'lineHeight' }
    }
  },
  spacing: {
    xs: { value: '4px', type: 'spacing' },
    sm: { value: '8px', type: 'spacing' },
    md: { value: '12px', type: 'spacing' },
    lg: { value: '16px', type: 'spacing' },
    xl: { value: '24px', type: 'spacing' },
    '2xl': { value: '32px', type: 'spacing' },
    '3xl': { value: '40px', type: 'spacing' },
    '4xl': { value: '56px', type: 'spacing' },
    '5xl': { value: '64px', type: 'spacing' }
  },
  borderRadius: {
    sm: { value: '8px', type: 'borderRadius' },
    md: { value: '10px', type: 'borderRadius' },
    lg: { value: '14px', type: 'borderRadius' },
    xl: { value: '16px', type: 'borderRadius' },
    '2xl': { value: '20px', type: 'borderRadius' },
    full: { value: '999px', type: 'borderRadius' }
  },
  shadows: {
    sm: {
      value: '0 4px 20px rgba(0, 0, 0, 0.08)',
      type: 'shadow',
      description: 'Тень для карточек'
    },
    md: {
      value: '0 8px 25px rgba(102, 126, 234, 0.4)',
      type: 'shadow',
      description: 'Тень для кнопок'
    },
    lg: {
      value: '0 12px 40px rgba(0, 0, 0, 0.15)',
      type: 'shadow',
      description: 'Тень для карточек при hover'
    }
  },
  breakpoints: {
    mobile: { value: '768px', type: 'breakpoint' },
    tablet: { value: '1024px', type: 'breakpoint' },
    desktop: { value: '1200px', type: 'breakpoint' }
  }
};

// Экспорт в JSON
const outputPath = path.join(__dirname, 'design-tokens.json');
fs.writeFileSync(outputPath, JSON.stringify(designTokens, null, 2));

console.log('✅ Дизайн-токены экспортированы в design-tokens.json');
console.log('\n📋 Что дальше:');
console.log('1. Открой design-tokens.json');
console.log('2. Используй плагин "Figma Tokens" в Figma');
console.log('3. Импортируй JSON файл');
console.log('\nИли используй DESIGN_SYSTEM.md для ручного переноса');

