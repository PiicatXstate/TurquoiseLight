<script setup lang="ts">
import { ref } from 'vue'
import { useGlobalSettings, presetColors, presetModels } from '@/composables/useGlobalSettings'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { settings, updateSettings, resetSettings } = useGlobalSettings()
const showApiKey = ref(false)
const activeTab = ref<'ai' | 'appearance' | 'general'>('ai')

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
    <div class="settings-modal" @click.stop>
      <div class="settings-header">
        <h2>设置</h2>
        <button class="close-btn" @click="emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="settings-tabs">
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'ai' }"
          @click="activeTab = 'ai'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z"></path>
            <path d="M12 16v-4"></path>
            <path d="M12 8h.01"></path>
          </svg>
          AI设置
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'appearance' }"
          @click="activeTab = 'appearance'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"></circle>
            <path d="M12 1v2"></path>
            <path d="M12 21v2"></path>
            <path d="M4.22 4.22l1.42 1.42"></path>
            <path d="M18.36 18.36l1.42 1.42"></path>
            <path d="M1 12h2"></path>
            <path d="M21 12h2"></path>
            <path d="M4.22 19.78l1.42-1.42"></path>
            <path d="M18.36 5.64l1.42-1.42"></path>
          </svg>
          外观设置
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'general' }"
          @click="activeTab = 'general'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          通用设置
        </button>
      </div>

      <div class="settings-content">
        <!-- AI设置 -->
        <div v-if="activeTab === 'ai'" class="settings-section">
          <h3>AI模型配置</h3>
          
          <div class="setting-item">
            <label>AI模型</label>
            <select v-model="settings.aiModel" class="setting-select">
              <option v-for="model in presetModels" :key="model.value" :value="model.value">
                {{ model.name }}
              </option>
            </select>
            <span class="setting-desc">选择要使用的AI模型</span>
          </div>

          <div class="setting-item" v-if="settings.aiModel === 'custom'">
            <label>自定义模型名称</label>
            <input 
              type="text" 
              v-model="settings.customModelName"
              placeholder="输入模型名称，例如: gpt-4o-mini"
              class="setting-input"
            />
            <span class="setting-desc">输入自定义AI模型的名称</span>
          </div>

          <div class="setting-item">
            <label>思考模型</label>
            <label class="switch">
              <input type="checkbox" v-model="settings.isThinkingModel">
              <span class="slider"></span>
            </label>
            <span class="setting-desc">启用后会解析AI的思考过程（DeepSeek-R1等模型）</span>
          </div>

          <div class="setting-item">
            <label>API Key</label>
            <div class="api-key-input">
              <input 
                :type="showApiKey ? 'text' : 'password'" 
                v-model="settings.apiKey"
                placeholder="输入你的API Key"
                class="setting-input"
              />
              <button class="toggle-btn" @click="showApiKey = !showApiKey">
                <svg v-if="!showApiKey" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              </button>
            </div>
            <span class="setting-desc">你的SiliconFlow API Key</span>
          </div>

          <div class="setting-item">
            <label>API Base URL</label>
            <input 
              type="text" 
              v-model="settings.apiBaseUrl"
              placeholder="https://api.siliconflow.cn/v1"
              class="setting-input"
            />
            <span class="setting-desc">API基础地址（一般不需要修改）</span>
          </div>
        </div>

        <!-- 外观设置 -->
        <div v-if="activeTab === 'appearance'" class="settings-section">
          <h3>主题设置</h3>
          
          <div class="setting-item">
            <label>主题色</label>
            <div class="color-picker">
              <button 
                v-for="color in presetColors" 
                :key="color.value"
                class="color-btn"
                :class="{ active: settings.primaryColor === color.value }"
                :style="{ backgroundColor: color.value }"
                :title="color.name"
                @click="updateSettings({ primaryColor: color.value })"
              >
                <svg v-if="settings.primaryColor === color.value" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </button>
            </div>
            <span class="setting-desc">选择应用的主题颜色</span>
          </div>

          <div class="setting-item">
            <label>自定义颜色</label>
            <div class="custom-color">
              <input 
                type="color" 
                v-model="settings.primaryColor"
                class="color-input"
              />
              <input 
                type="text" 
                v-model="settings.primaryColor"
                class="setting-input color-text"
                placeholder="#14b8a6"
              />
            </div>
            <span class="setting-desc">输入自定义颜色代码</span>
          </div>

          <div class="setting-item">
            <label>暗黑模式</label>
            <label class="switch">
              <input type="checkbox" v-model="settings.isDarkMode">
              <span class="slider"></span>
            </label>
            <span class="setting-desc">切换暗黑/明亮模式</span>
          </div>
        </div>

        <!-- 通用设置 -->
        <div v-if="activeTab === 'general'" class="settings-section">
          <h3>显示设置</h3>
          
          <div class="setting-item">
            <label>全局缩放</label>
            <div class="range-setting">
              <input 
                type="range" 
                v-model.number="settings.globalScale"
                min="0.8"
                max="1.5"
                step="0.05"
                class="range-input"
              />
              <span class="range-value">{{ Math.round(settings.globalScale * 100) }}%</span>
            </div>
            <span class="setting-desc">调整整个应用的显示比例</span>
          </div>
        </div>
      </div>

      <div class="settings-footer">
        <button class="btn-text" @click="handleReset">重置设置</button>
        <button class="btn-primary" @click="handleSave">完成</button>
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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.settings-modal {
  background: var(--bg-primary);
  border-radius: 16px;
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--gray-200);
}

.settings-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: var(--bg-tertiary);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--gray-200);
}

.close-btn svg {
  width: 20px;
  height: 20px;
  color: var(--text-secondary);
}

.settings-tabs {
  display: flex;
  gap: 8px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--gray-200);
  overflow-x: auto;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--text-secondary);
  transition: all 0.2s;
  white-space: nowrap;
}

.tab-btn:hover {
  background: var(--bg-tertiary);
  color: var(--gray-700);
}

.tab-btn.active {
  background: var(--primary-color-light, var(--primary-100));
  color: var(--primary-color, var(--primary-color));
  font-weight: 500;
}

.tab-btn svg {
  width: 18px;
  height: 18px;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.settings-section {
  margin-bottom: 32px;
}

.settings-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 20px 0;
}

.setting-item {
  margin-bottom: 24px;
}

.setting-item > label:first-child {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-700);
  margin-bottom: 8px;
}

.setting-desc {
  display: block;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: 6px;
}

.setting-input,
.setting-select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--gray-300);
  border-radius: 8px;
  font-size: 0.875rem;
  transition: all 0.2s;
  background: var(--bg-primary);
}

.setting-input:focus,
.setting-select:focus {
  outline: none;
  border-color: var(--primary-color, var(--primary-color));
  box-shadow: 0 0 0 3px var(--primary-color-light, var(--primary-100));
}

.api-key-input {
  display: flex;
  gap: 8px;
}

.api-key-input .setting-input {
  flex: 1;
}

.toggle-btn {
  width: 44px;
  height: 44px;
  border: 1px solid var(--gray-300);
  background: var(--bg-primary);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.toggle-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--text-tertiary);
}

.toggle-btn svg {
  width: 20px;
  height: 20px;
  color: var(--text-secondary);
}

.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.color-btn {
  width: 40px;
  height: 40px;
  border: 3px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.color-btn:hover {
  transform: scale(1.1);
}

.color-btn.active {
  border-color: var(--bg-primary);
  box-shadow: 0 0 0 2px var(--primary-color, var(--primary-color)), 0 4px 8px rgba(0, 0, 0, 0.2);
}

.color-btn svg {
  width: 20px;
  height: 20px;
}

.custom-color {
  display: flex;
  gap: 12px;
  align-items: center;
}

.color-input {
  width: 50px;
  height: 44px;
  border: 1px solid var(--gray-300);
  border-radius: 8px;
  cursor: pointer;
  padding: 4px;
}

.color-text {
  flex: 1;
  max-width: 120px;
}

/* Switch Toggle */
.switch {
  position: relative;
  display: inline-block;
  width: 52px;
  height: 28px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--gray-300);
  transition: 0.3s;
  border-radius: 28px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 4px;
  bottom: 4px;
  background-color: var(--bg-primary);
  transition: 0.3s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

input:checked + .slider {
  background-color: var(--primary-color, var(--primary-color));
}

input:checked + .slider:before {
  transform: translateX(24px);
}

.range-setting {
  display: flex;
  align-items: center;
  gap: 16px;
}

.range-input {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--gray-200);
  outline: none;
  -webkit-appearance: none;
}

.range-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--primary-color, var(--primary-color));
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.range-input::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--primary-color, var(--primary-color));
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.range-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-700);
  min-width: 48px;
  text-align: right;
}

.settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid var(--gray-200);
  background: var(--bg-secondary);
}

.btn-text {
  padding: 10px 20px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}

.btn-text:hover {
  background: var(--bg-tertiary);
  color: var(--gray-700);
}

.btn-primary {
  padding: 10px 24px;
  border: none;
  background: var(--primary-color, var(--primary-color));
  color: var(--bg-primary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: var(--primary-color-dark, var(--primary-600));
}

/* Dark mode support */
:global(.dark-mode) .settings-modal {
  background: var(--gray-800);
}

:global(.dark-mode) .settings-header,
:global(.dark-mode) .settings-tabs,
:global(.dark-mode) .settings-footer {
  border-color: var(--gray-700);
}

:global(.dark-mode) .settings-header h2,
:global(.dark-mode) .settings-section h3 {
  color: var(--bg-secondary);
}

:global(.dark-mode) .setting-item > label:first-child {
  color: var(--gray-200);
}

:global(.dark-mode) .setting-input,
:global(.dark-mode) .setting-select {
  background: var(--gray-700);
  border-color: var(--gray-600);
  color: var(--bg-secondary);
}

:global(.dark-mode) .tab-btn {
  color: var(--text-tertiary);
}

:global(.dark-mode) .tab-btn:hover {
  background: var(--gray-700);
  color: var(--gray-200);
}

:global(.dark-mode) .close-btn {
  background: var(--gray-700);
}

:global(.dark-mode) .close-btn:hover {
  background: var(--gray-600);
}

:global(.dark-mode) .close-btn svg {
  color: var(--gray-200);
}

:global(.dark-mode) .toggle-btn {
  background: var(--gray-700);
  border-color: var(--gray-600);
}

:global(.dark-mode) .toggle-btn svg {
  color: var(--gray-200);
}

:global(.dark-mode) .settings-footer {
  background: var(--text-primary);
}

:global(.dark-mode) .btn-text {
  color: var(--text-tertiary);
}

:global(.dark-mode) .btn-text:hover {
  background: var(--gray-700);
  color: var(--gray-200);
}

:global(.dark-mode) .range-input {
  background: var(--gray-700);
}

:global(.dark-mode) .range-value {
  color: var(--gray-200);
}
</style>
