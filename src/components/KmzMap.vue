<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import L, { Map as LeafletMap, Marker, Polyline } from 'leaflet'
import JSZip from 'jszip'

import 'leaflet/dist/leaflet.css'

type LatLng = {
  lat: number
  lng: number
}

const props = defineProps<{
  profileCoordinates?: LatLng[]
}>()

const mapContainer = ref<HTMLDivElement | null>(null)
let map: LeafletMap | null = null
let markers: Marker[] = []
let polylines: Polyline[] = []
let profilePolyline: Polyline | null = null

const loading = ref(false)
const error = ref<string | null>(null)

// Util simples para limpar as camadas anteriores
function clearLayers() {
  markers.forEach((m) => m.remove())
  polylines.forEach((p) => p.remove())
  markers = []
  polylines = []
}

function updateProfilePolyline() {
  if (!map) return

  if (profilePolyline) {
    profilePolyline.remove()
    profilePolyline = null
  }

  const coords = props.profileCoordinates ?? []
  if (!coords.length) return

  const latlngs: [number, number][] = coords.map(({ lat, lng }) => [lat, lng])

  profilePolyline = L.polyline(latlngs, {
    color: '#22c55e',
    weight: 4,
  })

  profilePolyline.addTo(map)

  const bounds = profilePolyline.getBounds()
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [30, 30] })
  }
}

// Parse básico de KML (dentro do KMZ) para pegar coordenadas de Placemarks e LineString
function parseKmlCoordinates(kmlText: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(kmlText, 'application/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('Erro ao interpretar o KML dentro do KMZ.')
  }

  type LatLng = { lat: number; lng: number }

  const points: LatLng[] = []
  const lines: LatLng[][] = []

  // Placemarks com Point
  const pointNodes = Array.from(doc.getElementsByTagName('Point'))
  for (const pointNode of pointNodes) {
    const coordinatesNode = pointNode.getElementsByTagName('coordinates')[0]
    if (!coordinatesNode || !coordinatesNode.textContent) continue

    const raw = coordinatesNode.textContent.trim()
    // longitude,latitude[,altitude]
    const [lngStr, latStr] = raw.split(',')
    const lat = Number(latStr)
    const lng = Number(lngStr)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      points.push({ lat, lng })
    }
  }

  // LineString (ex: trilhas)
  const lineNodes = Array.from(doc.getElementsByTagName('LineString'))
  for (const lineNode of lineNodes) {
    const coordinatesNode = lineNode.getElementsByTagName('coordinates')[0]
    if (!coordinatesNode || !coordinatesNode.textContent) continue

    const raw = coordinatesNode.textContent.trim()
    const linePoints: LatLng[] = []

    raw
      .split(/\s+/)
      .map((c) => c.trim())
      .filter(Boolean)
      .forEach((coord) => {
        const [lngStr, latStr] = coord.split(',')
        const lat = Number(latStr)
        const lng = Number(lngStr)
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          linePoints.push({ lat, lng })
        }
      })

    if (linePoints.length) {
      lines.push(linePoints)
    }
  }

  return { points, lines }
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  error.value = null

  if (!file) return
  if (!file.name.toLowerCase().endsWith('.kmz')) {
    error.value = 'Por favor, selecione um arquivo KMZ válido.'
    return
  }

  loading.value = true
  clearLayers()

  try {
    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    // Tenta encontrar o primeiro arquivo .kml dentro do KMZ
    const kmlFileEntry = Object.values(zip.files).find((f) =>
      f.name.toLowerCase().endsWith('.kml'),
    )

    if (!kmlFileEntry) {
      throw new Error('KMZ não contém nenhum arquivo KML interno.')
    }

    const kmlText = await kmlFileEntry.async('text')
    const { points, lines } = parseKmlCoordinates(kmlText)

    if (!map) return

    const allCoords: [number, number][] = []

    // Adiciona marcadores para pontos
    points.forEach(({ lat, lng }) => {
      const marker = L.marker([lat, lng])
      marker.addTo(map!)
      markers.push(marker)
      allCoords.push([lat, lng])
    })

    // Adiciona polilinhas para caminhos/linhas
    lines.forEach((line) => {
      const latlngs: [number, number][] = line.map(({ lat, lng }) => [lat, lng])
      const polyline = L.polyline(latlngs, { color: '#2563eb' })
      polyline.addTo(map!)
      polylines.push(polyline)
      allCoords.push(...latlngs)
    })

    if (!allCoords.length) {
      error.value = 'Nenhuma coordenada encontrada dentro do KMZ.'
      return
    }

    // Ajusta o mapa para enquadrar todos os pontos
    const bounds = L.latLngBounds(allCoords)
    map.fitBounds(bounds, { padding: [30, 30] })
  } catch (e: any) {
    console.error(e)
    error.value = e?.message || 'Erro ao processar o arquivo KMZ.'
  } finally {
    loading.value = false
    // Limpa o valor do input para permitir selecionar o mesmo arquivo novamente
    const input = event.target as HTMLInputElement
    if (input) input.value = ''
  }
}

onMounted(() => {
  if (!mapContainer.value) return

  map = L.map(mapContainer.value, {
    center: [0, 0],
    zoom: 2,
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)

  // Desenha o perfil inicial, se já existir
  updateProfilePolyline()
})

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
  clearLayers()
  if (profilePolyline) {
    profilePolyline.remove()
    profilePolyline = null
  }
})

watch(
  () => props.profileCoordinates,
  () => {
    updateProfilePolyline()
  },
  { deep: true },
)
</script>

<template>
  <section class="kmz-map">
    <header class="kmz-map__header">
      <h2>Mapa (KMZ)</h2>
      <p>
        Selecione um arquivo <strong>.kmz</strong> (por exemplo, exportado do QGIS
        ou do Google Earth) e os pontos/linhas serão exibidos no mapa.
      </p>
    </header>

    <div class="kmz-map__controls">
      <label class="kmz-map__file-label">
        <span>Selecione o arquivo KMZ</span>
        <input
          type="file"
          accept=".kmz"
          class="kmz-map__file-input"
          @change="handleFileChange"
        />
      </label>

      <span v-if="loading" class="kmz-map__status">Carregando KMZ...</span>
      <span v-if="error" class="kmz-map__error">{{ error }}</span>
    </div>

    <div ref="mapContainer" class="kmz-map__map"></div>
  </section>
</template>

<style scoped>
.kmz-map {
  max-width: 1200px;
  margin: 0 auto 2rem;
  padding: 0 1.5rem 2rem;
}

.kmz-map__header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1rem;
}

.kmz-map__header h2 {
  margin: 0;
  font-size: 1.4rem;
}

.kmz-map__header p {
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.kmz-map__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.kmz-map__file-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 1rem;
  border-radius: 999px;
  border: 1px solid #4b5563;
  background: #020617;
  color: #e5e7eb;
  font-size: 0.9rem;
  cursor: pointer;
}

.kmz-map__file-input {
  display: none;
}

.kmz-map__status {
  font-size: 0.85rem;
  color: #e5e7eb;
}

.kmz-map__error {
  font-size: 0.85rem;
  color: #f97373;
}

.kmz-map__map {
  margin-top: 0.5rem;
  width: 100%;
  height: 420px;
  border-radius: 1rem;
  overflow: hidden;
  border: 1px solid #1f2937;
}

/* Garante que o CSS do Leaflet funcione bem dentro do escopo */
:global(.leaflet-container) {
  width: 100%;
  height: 100%;
}
</style>
