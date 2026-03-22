<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ArticleList from '@/components/ArticleList.vue'
import Reader from '@/components/Reader.vue'
import AuthModal from '@/components/AuthModal.vue'
import ArticleSquare from '@/components/ArticleSquare.vue'
import { useAuth } from '@/composables/useAuth'
import type { SharedArticle } from '@/types'

const { init, logout } = useAuth()

const currentView = ref<'list' | 'reader' | 'square'>('list')
const currentArticleId = ref<string | null>(null)
const showAuthModal = ref(false)
const authMode = ref<'login' | 'register'>('login')
const sharedArticle = ref<SharedArticle | null>(null)

onMounted(() => {
  init()
})

function openArticle(id: string) {
  currentArticleId.value = id
  currentView.value = 'reader'
}

function goBack() {
  currentView.value = 'list'
  currentArticleId.value = null
  sharedArticle.value = null
}

function openLogin() {
  authMode.value = 'login'
  showAuthModal.value = true
}

function openSquare() {
  currentView.value = 'square'
}

function handleLogout() {
  logout()
}

function openSharedArticle(article: SharedArticle) {
  sharedArticle.value = article
  currentView.value = 'reader'
}
</script>

<template>
  <div class="app">
    <ArticleList
      v-if="currentView === 'list'"
      @openArticle="openArticle"
      @openSquare="openSquare"
      @openLogin="openLogin"
      @logout="handleLogout"
    />
    <Reader
      v-else-if="currentView === 'reader' && (currentArticleId || sharedArticle)"
      :articleId="currentArticleId || ''"
      :sharedArticle="sharedArticle"
      @back="goBack"
    />
    <ArticleSquare
      v-else-if="currentView === 'square'"
      @close="currentView = 'list'"
      @openArticle="openSharedArticle"
    />

    <AuthModal
      v-if="showAuthModal"
      @close="showAuthModal = false"
    />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f0fdfa;
  min-height: 100vh;
}

.app {
  min-height: 100vh;
}
</style>
