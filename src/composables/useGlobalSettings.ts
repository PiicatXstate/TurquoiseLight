import { ref, watch, onMounted } from 'vue'

export interface GlobalSettings {
  // AI设置
  aiModel: string
  customModelName: string
  isThinkingModel: boolean
  apiKey: string
  apiBaseUrl: string
  
  // 主题设置
  primaryColor: string
  isDarkMode: boolean
  
  // 全局缩放
  globalScale: number
}

const defaultSettings: GlobalSettings = {
  aiModel: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
  customModelName: '',
  isThinkingModel: true,
  apiKey: '',
  apiBaseUrl: 'https://api.siliconflow.cn/v1',
  
  primaryColor: '#14b8a6', // 默认 turquoise 色
  isDarkMode: false,
  
  globalScale: 1
}

// 预设主题色
export const presetColors = [
  { name: '青绿', value: '#14b8a6' },
  { name: '蓝色', value: '#3b82f6' },
  { name: '紫色', value: '#8b5cf6' },
  { name: '粉色', value: '#ec4899' },
  { name: '红色', value: '#ef4444' },
  { name: '橙色', value: '#f97316' },
  { name: '黄色', value: '#eab308' },
  { name: '绿色', value: '#22c55e' },
  { name: '青色', value: '#06b6d4' },
  { name: '靛蓝', value: '#6366f1' }
]

// 预设AI模型
export const presetModels = [
  { name: 'DeepSeek-R1-Distill-Qwen-7B', value: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B' },
  { name: 'DeepSeek-R1-Distill-Qwen-14B', value: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B' },
  { name: 'DeepSeek-R1-Distill-Qwen-32B', value: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B' },
  { name: 'Qwen2.5-7B-Instruct', value: 'Qwen/Qwen2.5-7B-Instruct' },
  { name: 'Qwen2.5-14B-Instruct', value: 'Qwen/Qwen2.5-14B-Instruct' },
  { name: 'Qwen2.5-32B-Instruct', value: 'Qwen/Qwen2.5-32B-Instruct' },
  { name: 'glm-4-9b-chat', value: 'THUDM/glm-4-9b-chat' },
  { name: '自定义模型', value: 'custom' }
]

const STORAGE_KEY = 'turquoise_global_settings'

// 辅助函数：将十六进制颜色转换为RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

// 辅助函数：将RGB转换为HSL
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255
  
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

// 辅助函数：将HSL转换为十六进制
function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = l - c / 2
  
  let r = 0, g = 0, b = 0
  
  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c
  } else {
    r = c; g = 0; b = x
  }
  
  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// 生成主色调色板
function generateColorPalette(baseColor: string): Record<string, string> {
  const rgb = hexToRgb(baseColor)
  if (!rgb) return {}
  
  const { h, s } = rgbToHsl(rgb.r, rgb.g, rgb.b)
  
  return {
    '--primary-color': baseColor,
    '--primary-color-rgb': `${rgb.r}, ${rgb.g}, ${rgb.b}`,
    '--primary-50': hslToHex(h, s, 95),
    '--primary-100': hslToHex(h, s, 90),
    '--primary-200': hslToHex(h, s, 80),
    '--primary-300': hslToHex(h, s, 70),
    '--primary-400': hslToHex(h, s, 60),
    '--primary-500': baseColor,
    '--primary-600': hslToHex(h, s, 40),
    '--primary-700': hslToHex(h, s, 30),
    '--primary-800': hslToHex(h, s, 20),
    '--primary-900': hslToHex(h, s, 10),
  }
}

export function useGlobalSettings() {
  const settings = ref<GlobalSettings>({ ...defaultSettings })

  // 从localStorage加载设置
  function loadSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        settings.value = { ...defaultSettings, ...parsed }
      }
    } catch (e) {
      console.error('Failed to load global settings:', e)
    }
  }

  // 保存设置到localStorage
  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
    } catch (e) {
      console.error('Failed to save global settings:', e)
    }
  }

  // 更新设置
  function updateSettings(updates: Partial<GlobalSettings>) {
    settings.value = { ...settings.value, ...updates }
  }

  // 重置设置
  function resetSettings() {
    settings.value = { ...defaultSettings }
  }

  // 应用主题色到CSS变量
  function applyThemeColor(color: string) {
    const root = document.documentElement
    const palette = generateColorPalette(color)
    
    // 应用所有生成的颜色变量
    Object.entries(palette).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })
  }

  // 应用全局缩放
  function applyGlobalScale(scale: number) {
    const root = document.documentElement
    root.style.setProperty('--global-scale', scale.toString())
  }

  // 应用暗黑模式
  function applyDarkMode(isDark: boolean) {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark-mode')
    } else {
      root.classList.remove('dark-mode')
    }
  }

  // 监听设置变化并应用
  watch(() => settings.value.primaryColor, (newColor) => {
    applyThemeColor(newColor)
  }, { immediate: true })

  watch(() => settings.value.globalScale, (newScale) => {
    applyGlobalScale(newScale)
  }, { immediate: true })

  watch(() => settings.value.isDarkMode, (isDark) => {
    applyDarkMode(isDark)
  }, { immediate: true })

  // 监听设置变化并保存
  watch(settings, () => {
    saveSettings()
  }, { deep: true })

  // 初始化
  onMounted(() => {
    loadSettings()
  })

  return {
    settings,
    presetColors,
    presetModels,
    updateSettings,
    resetSettings,
    loadSettings,
    saveSettings,
    applyThemeColor,
    applyGlobalScale,
    applyDarkMode
  }
}
