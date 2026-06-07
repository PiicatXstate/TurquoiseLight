<template>
  <div class="custom-title-bar" @mousedown="startDrag">
    <div class="title-bar-left">
      <img src="/favicon.ico" alt="Logo" class="app-logo" />
      <h1 class="app-title">Turquoise</h1>
    </div>
    <div class="title-bar-right">
      <button class="title-bar-button" @click="minimize" title="最小化">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="4" y1="12" x2="20" y2="12"></line>
        </svg>
      </button>
      <button class="title-bar-button" @click="maximize" title="最大化">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="4" y="4" width="16" height="16"></rect>
        </svg>
      </button>
      <button class="title-bar-button close-button" @click="close" title="关闭">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// 窗口控制方法
const minimize = () => {
  if (window.electron) {
    window.electron.minimize()
  }
}

const maximize = () => {
  if (window.electron) {
    window.electron.maximize()
  }
}

const close = () => {
  if (window.electron) {
    window.electron.close()
  }
}

// 窗口拖动功能
const startDrag = (e: MouseEvent) => {
  if (window.electron?.startDrag) {
    window.electron.startDrag(e.clientX, e.clientY)
  }
}
</script>

<style scoped>
.custom-title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 32px;
  background-color: #f0f0f0;
  border-bottom: 1px solid #e0e0e0;
  padding: 0 10px;
  -webkit-app-region: drag;
}

.title-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-logo {
  width: 20px;
  height: 20px;
}

.app-title {
  font-size: 14px;
  font-weight: 500;
  margin: 0;
  color: #333;
}

.title-bar-right {
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.title-bar-button {
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333;
  transition: background-color 0.2s;
}

.title-bar-button:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.close-button:hover {
  background-color: #ff5f56;
  color: white;
}

.title-bar-button svg {
  width: 16px;
  height: 16px;
}
</style>
