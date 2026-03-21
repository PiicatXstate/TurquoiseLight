<script setup lang="ts">
import { ref } from 'vue'
import ArticleList from '@/components/ArticleList.vue'
import Reader from '@/components/Reader.vue'

const currentView = ref<'list' | 'reader'>('list')
const currentArticleId = ref<string | null>(null)

function openArticle(id: string) {
  currentArticleId.value = id
  currentView.value = 'reader'
}

function goBack() {
  currentView.value = 'list'
  currentArticleId.value = null
}
</script>

<template>
  <div class="app">
    <ArticleList
      v-if="currentView === 'list'"
      @openArticle="openArticle"
    />
    <Reader
      v-else-if="currentView === 'reader' && currentArticleId"
      :articleId="currentArticleId"
      @back="goBack"
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
