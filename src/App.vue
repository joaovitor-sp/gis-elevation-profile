<script setup lang="ts">
import { ref } from 'vue'
import ElevationInput from './components/ElevationInput.vue'
import ElevationChart from './components/ElevationChart.vue'

const elevations = ref<number[]>([])

function handleUpdateElevations(values: number[]) {
  elevations.value = values
}
</script>

<template>
  <main class="app">
    <ElevationInput @update:elevations="handleUpdateElevations" />
    <ElevationChart :elevations="elevations" />
  </main>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding: 2rem 0;
  color: #e5e7eb;
}

@media (max-width: 640px) {
  .app {
    padding: 1.5rem 0;
  }
}
</style>
