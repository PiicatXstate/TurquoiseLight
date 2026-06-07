<script setup lang="ts">
import { onMounted } from 'vue'
import ArticleList from '@/components/ArticleList.vue'
import Reader from '@/components/Reader.vue'
import { useGlobalSettings } from '@/composables/useGlobalSettings'
import { ref } from 'vue'

const { loadSettings } = useGlobalSettings()

const currentView = ref<'list' | 'reader'>('list')
const currentArticleId = ref<string | null>(null)

onMounted(() => {
  loadSettings()
})

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
      :articleId="currentArticleId || ''"
      :sharedArticle="null"
      @back="goBack"
    />
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
}
</style>
