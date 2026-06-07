<script setup lang="ts">
import { ref } from 'vue'
import { useGlobalSettings, presetModels } from '@/composables/useGlobalSettings'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { settings, resetSettings } = useGlobalSettings()
const showApiKey = ref(false)

function handleReset() {
  if (confirm('确定要重置所有设置吗？这将恢复默认配置。')) {
    resetSettings()
  }
}

function handleSave() {
  emit('close')
}
</script>

<template>
  <div class="settings-overlay" @click="emit('close')">
    <div class="settings-window" @click.stop>
      <div class="settings-header">
        <h1>设置</h1>
        <button class="close-btn" @click="emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="settings-content">
        <section class="settings-section">
          <h2>AI 助手</h2>
          
          <div class="settings-card">
            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-label">AI 模型</span>
                <span class="setting-desc">选择用于 AI 聊天和注释功能</span>
              </div>
              <div class="setting-control">
                <select v-model="settings.aiModel" class="setting-select">
                  <option v-for="model in presetModels" :key="model.value" :value="model.value">
                    {{ model.name }}
                  </option>
                </select>
              </div>
            </div>

            <div class="setting-row" v-if="settings.aiModel === 'custom'">
              <div class="setting-info">
                <span class="setting-label">自定义模型名称</span>
                <span class="setting-desc">输入自定义 AI 模型名称</span>
              </div>
              <div class="setting-control">
                <input 
                  type="text" 
                  v-model="settings.customModelName"
                  placeholder="gpt-4o-mini"
                  class="setting-input"
                />
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-label">思考模型</span>
                <span class="setting-desc">解析 AI 的思考过程</span>
              </div>
              <div class="setting-control">
                <label class="toggle">
                  <input type="checkbox" v-model="settings.isThinkingModel">
                  <span class="toggle-track">
                    <span class="toggle-thumb"></span>
                  </span>
                </label>
              </div>
            </div>
          </div>
        </section>

        <section class="settings-section">
          <h2>API 配置</h2>
          
          <div class="settings-card">
            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-label">API Key</span>
                <span class="setting-desc">你的 API 密钥</span>
              </div>
              <div class="setting-control">
                <div class="api-key-wrapper">
                  <input 
                    :type="showApiKey ? 'text' : 'password'" 
                    v-model="settings.apiKey"
                    placeholder="输入你的 API Key"
                    class="setting-input api-input"
                  />
                  <button class="api-toggle" @click="showApiKey = !showApiKey">
                    <svg v-if="!showApiKey" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-label">API 地址</span>
                <span class="setting-desc">API 基础 URL</span>
              </div>
              <div class="setting-control">
                <input 
                  type="text" 
                  v-model="settings.apiBaseUrl"
                  placeholder="https://api.siliconflow.cn/v1"
                  class="setting-input"
                />
              </div>
            </div>
          </div>
        </section>

        <section class="settings-section">
          <h2>显示</h2>
          
          <div class="settings-card">
            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-label">缩放</span>
                <span class="setting-desc">调整界面显示大小</span>
              </div>
              <div class="setting-control">
                <div class="scale-wrapper">
                  <input 
                    type="range" 
                    v-model.number="settings.globalScale"
                    min="0.8"
                    max="1.5"
                    step="0.05"
                    class="scale-input"
                  />
                  <span class="scale-value">{{ Math.round(settings.globalScale * 100) }}%</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="settings-footer">
        <button class="reset-btn" @click="handleReset">重置</button>
        <button class="done-btn" @click="handleSave">完成</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 24px;
}

.settings-window {
  width: 100%;
  max-width: 560px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f7;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 
    0 32px 80px rgba(0, 0, 0, 0.24),
    0 0 0 0.5px rgba(0, 0, 0, 0.08);
}

:global(.dark-mode) .settings-window {
  background: #1c1c1e;
  box-shadow: 
    0 32px 80px rgba(0, 0, 0, 0.6),
    0 0 0 0.5px rgba(255, 255, 255, 0.1);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
}

:global(.dark-mode) .settings-header {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.settings-header h1 {
  font-size: 18px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0;
  letter-spacing: -0.01em;
}

:global(.dark-mode) .settings-header h1 {
  color: #f5f5f7;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #86868b;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #1d1d1f;
}

:global(.dark-mode) .close-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f5f5f7;
}

.close-btn svg {
  width: 18px;
  height: 18px;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.settings-section {
  margin-bottom: 28px;
}

.settings-section:last-child {
  margin-bottom: 0;
}

.settings-section h2 {
  font-size: 14px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0 0 10px 0;
  letter-spacing: -0.01em;
}

:global(.dark-mode) .settings-section h2 {
  color: #f5f5f7;
}

.settings-card {
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
  border: 0.5px solid rgba(0, 0, 0, 0.08);
}

:global(.dark-mode) .settings-card {
  background: #2c2c2e;
  border-color: rgba(255, 255, 255, 0.08);
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  min-height: 52px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.05);
}

.setting-row:last-child {
  border-bottom: none;
}

:global(.dark-mode) .setting-row {
  border-bottom-color: rgba(255, 255, 255, 0.05);
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  padding-right: 16px;
  min-width: 0;
}

.setting-label {
  font-size: 14px;
  font-weight: 500;
  color: #1d1d1f;
}

:global(.dark-mode) .setting-label {
  color: #f5f5f7;
}

.setting-desc {
  font-size: 12px;
  color: #86868b;
}

:global(.dark-mode) .setting-desc {
  color: #86868b;
}

.setting-control {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.setting-input,
.setting-select {
  padding: 8px 12px;
  border: 0.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  font-size: 14px;
  color: #1d1d1f;
  background: #f5f5f7;
  outline: none;
  transition: all 0.2s ease;
  min-width: 160px;
  max-width: 200px;
}

:global(.dark-mode) .setting-input,
:global(.dark-mode) .setting-select {
  background: #1c1c1e;
  color: #f5f5f7;
  border-color: rgba(255, 255, 255, 0.12);
}

.setting-input:focus,
.setting-select:focus {
  border-color: var(--primary-color);
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(var(--primary-color-rgb), 0.12);
}

:global(.dark-mode) .setting-input:focus,
:global(.dark-mode) .setting-select:focus {
  background: #1c1c1e;
}

.api-key-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.api-input {
  width: 160px;
}

.api-toggle {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #86868b;
  transition: all 0.15s ease;
}

.api-toggle:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #1d1d1f;
}

:global(.dark-mode) .api-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f5f5f7;
}

.api-toggle svg {
  width: 18px;
  height: 18px;
}

.toggle {
  position: relative;
  display: inline-block;
  cursor: pointer;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.toggle-track {
  display: block;
  width: 51px;
  height: 31px;
  background: #e9e9eb;
  border-radius: 31px;
  position: relative;
  transition: background 0.2s ease;
}

:global(.dark-mode) .toggle-track {
  background: #3a3a3c;
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 27px;
  height: 27px;
  background: #ffffff;
  border-radius: 50%;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15), 0 1px 1px rgba(0, 0, 0, 0.08);
  transition: transform 0.25s cubic-bezier(0.36, 0, 0.18, 1);
}

.toggle input:checked + .toggle-track {
  background: #34c759;
}

.toggle input:checked + .toggle-track .toggle-thumb {
  transform: translateX(20px);
}

.scale-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.scale-input {
  width: 140px;
  height: 4px;
  border-radius: 2px;
  background: #e9e9eb;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

:global(.dark-mode) .scale-input {
  background: #3a3a3c;
}

.scale-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  border: 0.5px solid rgba(0, 0, 0, 0.1);
}

.scale-input::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.scale-value {
  font-size: 13px;
  font-weight: 500;
  color: #1d1d1f;
  min-width: 40px;
  text-align: right;
}

:global(.dark-mode) .scale-value {
  color: #f5f5f7;
}

.settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 14px 24px;
  border-top: 0.5px solid rgba(0, 0, 0, 0.08);
  background: rgba(0, 0, 0, 0.02);
}

:global(.dark-mode) .settings-footer {
  border-top-color: rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.04);
}

.reset-btn {
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--primary-color);
  font-size: 14px;
  font-weight: 400;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.reset-btn:hover {
  background: rgba(var(--primary-color-rgb), 0.08);
}

.done-btn {
  padding: 8px 24px;
  border: none;
  background: var(--primary-color);
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.done-btn:hover {
  background: var(--primary-600);
}

@media (max-width: 520px) {
  .settings-overlay {
    padding: 0;
  }
  
  .settings-window {
    border-radius: 0;
    max-width: 100%;
    max-height: 100vh;
  }
  
  .setting-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .setting-info {
    padding-right: 0;
  }
  
  .setting-control {
    width: 100%;
  }
  
  .setting-input,
  .setting-select {
    width: 100%;
    max-width: 100%;
  }
  
  .api-key-wrapper {
    width: 100%;
  }
  
  .api-input {
    flex: 1;
  }
}
</style>
