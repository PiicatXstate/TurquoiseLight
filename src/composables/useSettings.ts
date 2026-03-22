import { ref, watch } from 'vue'
import type { ReaderSettings } from '@/types'
import { loadSettings, saveSettings } from '@/utils/storage'

const settings = ref<ReaderSettings>(loadSettings())

watch(settings, (newSettings) => {
  saveSettings(newSettings)
}, { deep: true })

export function useSettings() {
  function updateSettings(updates: Partial<ReaderSettings>): void {
    settings.value = { ...settings.value, ...updates }
  }

  function resetSettings(): void {
    settings.value = {
      fontSize: 18,
      letterSpacing: 2,
      lineHeight: 1.8,
      fontFamily: 'serif',
      annotationFontSize: 14
    }
  }

  return {
    settings,
    updateSettings,
    resetSettings
  }
}
