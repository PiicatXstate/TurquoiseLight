<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { login, register, loading } = useAuth()

const isLogin = ref(true)
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')

async function handleSubmit() {
  error.value = ''
  
  if (!username.value.trim()) {
    error.value = '请输入用户名'
    return
  }
  
  if (!password.value) {
    error.value = '请输入密码'
    return
  }
  
  if (!isLogin.value) {
    if (username.value.length < 2 || username.value.length > 20) {
      error.value = '用户名长度需在2-20个字符之间'
      return
    }
    
    if (password.value.length < 6) {
      error.value = '密码长度至少6个字符'
      return
    }
    
    if (password.value !== confirmPassword.value) {
      error.value = '两次输入的密码不一致'
      return
    }
    
    const result = await register(username.value.trim(), password.value)
    if (result.success) {
      emit('close')
    } else {
      error.value = result.error || '注册失败'
    }
  } else {
    const result = await login(username.value.trim(), password.value)
    if (result.success) {
      emit('close')
    } else {
      error.value = result.error || '登录失败'
    }
  }
}

function switchMode() {
  isLogin.value = !isLogin.value
  error.value = ''
  confirmPassword.value = ''
}
</script>

<template>
  <div class="auth-modal-overlay" @click.self="emit('close')">
    <div class="auth-modal">
      <div class="auth-header">
        <h2>{{ isLogin ? '登录' : '注册' }}</h2>
        <button class="close-btn" @click="emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <form class="auth-form" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label>用户名</label>
          <input 
            v-model="username" 
            type="text" 
            placeholder="输入用户名"
            :disabled="loading"
          />
        </div>
        
        <div class="form-group">
          <label>密码</label>
          <input 
            v-model="password" 
            type="password" 
            placeholder="输入密码"
            :disabled="loading"
          />
        </div>
        
        <div v-if="!isLogin" class="form-group">
          <label>确认密码</label>
          <input 
            v-model="confirmPassword" 
            type="password" 
            placeholder="再次输入密码"
            :disabled="loading"
          />
        </div>
        
        <div v-if="error" class="error-message">{{ error }}</div>
        
        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? '处理中...' : (isLogin ? '登录' : '注册') }}
        </button>
      </form>
      
      <div class="auth-footer">
        <span>{{ isLogin ? '还没有账号？' : '已有账号？' }}</span>
        <button class="switch-btn" @click="switchMode">
          {{ isLogin ? '立即注册' : '立即登录' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.auth-modal {
  background: var(--bg-primary);
  border-radius: 12px;
  width: 100%;
  max-width: 360px;
  overflow: hidden;
}

.auth-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.auth-header h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-tertiary);
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.close-btn svg {
  width: 18px;
  height: 18px;
}

.auth-form {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-group input {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.875rem;
  transition: all 0.15s;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.1);
}

.form-group input:disabled {
  background: var(--bg-tertiary);
  cursor: not-allowed;
}

.error-message {
  color: var(--error-color);
  font-size: 0.8125rem;
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: rgba(239, 68, 68, 0.05);
  border-radius: 6px;
}

.submit-btn {
  width: 100%;
  padding: 0.75rem;
  background: var(--primary-color);
  color: var(--bg-primary);
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.submit-btn:hover:not(:disabled) {
  background: var(--primary-color);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-footer {
  padding: 1rem 1.5rem;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  text-align: center;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.switch-btn {
  background: transparent;
  border: none;
  color: var(--primary-color);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  margin-left: 0.25rem;
}

.switch-btn:hover {
  text-decoration: underline;
}
</style>
