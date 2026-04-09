<script setup lang="ts">
import { ref, computed } from 'vue'
import ElevationInput from './components/ElevationInput.vue'
import ElevationChart from './components/ElevationChart.vue'
import KmzMap from './components/KmzMap.vue'
import ImageMetadataMap from './components/ImageMetadataMap.vue'

type LatLng = {
  lat: number
  lng: number
}

type ProfilePoint = {
  distanceMeters: number
  latitudeMeters: number
  longitudeMeters: number
  elevationMeters: number
}

const profilePoints = ref<ProfilePoint[]>([])
const profileCoordinates = ref<LatLng[]>([])

type KmzPointForEmit = {
  id: number
  name: string
  lat: number
  lng: number
}

type KmzMarkerOnProfile = {
  id: number
  name: string
  distanceMeters: number
  lat: number
  lng: number
}

const kmzPoints = ref<KmzPointForEmit[]>([])

const kmzMarkersOnProfile = computed<KmzMarkerOnProfile[]>(() => {
  if (!profilePoints.value.length || !profileCoordinates.value.length || !kmzPoints.value.length) {
    return []
  }

  const coords = profileCoordinates.value
  const profile = profilePoints.value

  return kmzPoints.value
    .map((point) => {
      let bestIndex = -1
      let bestDistSq = Number.POSITIVE_INFINITY

      for (let i = 0; i < coords.length; i++) {
        const c = coords[i]!
        const dx = c.lat - point.lat
        const dy = c.lng - point.lng
        const d2 = dx * dx + dy * dy
        if (d2 < bestDistSq) {
          bestDistSq = d2
          bestIndex = i
        }
      }

      if (bestIndex === -1 || !profile[bestIndex]) {
        return null
      }

      return {
        id: point.id,
        name: point.name,
        distanceMeters: profile[bestIndex]!.distanceMeters,
        lat: point.lat,
        lng: point.lng,
      }
    })
    .filter((m): m is KmzMarkerOnProfile => m !== null)
})

type View = 'profile' | 'images'
const currentView = ref<View>('profile')

function handleUpdateElevations(values: ProfilePoint[]) {
  profilePoints.value = values
}

function handleUpdateCoordinates(coords: LatLng[]) {
  profileCoordinates.value = coords
}

function handleUpdateKmzPoints(points: KmzPointForEmit[]) {
  kmzPoints.value = points
}
</script>

<template>
  <main class="app">
    <header class="app__nav">
      <button
        type="button"
        class="app__nav-button"
        :class="{ 'app__nav-button--active': currentView === 'profile' }"
        @click="currentView = 'profile'"
      >
        Perfil de Elevação
      </button>
      <button
        type="button"
        class="app__nav-button"
        :class="{ 'app__nav-button--active': currentView === 'images' }"
        @click="currentView = 'images'"
      >
        Imagens / Metadados
      </button>
    </header>

    <section v-if="currentView === 'profile'" class="app__section">
      <ElevationInput
        @update:elevations="handleUpdateElevations"
        @update:coordinates="handleUpdateCoordinates"
      />
      <ElevationChart
        :profile-points="profilePoints"
        :kmz-markers="kmzMarkersOnProfile"
      />
      <KmzMap
        :profile-coordinates="profileCoordinates"
        @update:kmzPoints="handleUpdateKmzPoints"
      />
    </section>

    <section v-else class="app__section">
      <ImageMetadataMap />
    </section>
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

.app__nav {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.app__nav-button {
  padding: 0.45rem 1.3rem;
  border-radius: 999px;
  border: 1px solid #4b5563;
  background: #020617;
  color: #e5e7eb;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}

.app__nav-button--active {
  background: linear-gradient(90deg, #2563eb, #22c55e);
  border-color: transparent;
  color: #ffffff;
}

.app__section {
  width: 100%;
}

@media (max-width: 640px) {
  .app {
    padding: 1.5rem 0;
  }
}
</style>
