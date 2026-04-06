<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ArticleList from '@/components/ArticleList.vue'
import Reader from '@/components/Reader.vue'
import Settings from '@/components/Settings.vue'
import { useGlobalSettings } from '@/composables/useGlobalSettings'

const { loadSettings } = useGlobalSettings()

const currentView = ref<'list' | 'reader'>('list')
const currentArticleId = ref<string | null>(null)
const showSettings = ref(false)

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

function openSettings() {
  showSettings.value = true
}
</script>

<template>
  <div class="app">
    <ArticleList
      v-if="currentView === 'list'"
      @openArticle="openArticle"
      @openSettings="openSettings"
    />
    <Reader
      v-else-if="currentView === 'reader' && currentArticleId"
      :articleId="currentArticleId || ''"
      :sharedArticle="null"
      @back="goBack"
    />

    <Settings
      v-if="showSettings"
      @close="showSettings = false"
    />
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
}
</style>
