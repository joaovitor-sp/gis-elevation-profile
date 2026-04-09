<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import L, { Map as LeafletMap, Marker, Polyline } from 'leaflet'
import JSZip from 'jszip'
import type { ImportedKmzPoint, KmzTablePoint, LatLng } from '../types/profile'

import 'leaflet/dist/leaflet.css'

const props = defineProps<{
  profileCoordinates?: LatLng[]
}>()

const emit = defineEmits<{
  (e: 'update:kmzPoints', points: ImportedKmzPoint[]): void
}>()

const mapContainer = ref<HTMLDivElement | null>(null)
let map: LeafletMap | null = null
let markers: Marker[] = []
let polylines: Polyline[] = []
let profilePolyline: Polyline | null = null

const kmzPointIcon = L.divIcon({
  className: 'kmz-map__marker',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
})

const loading = ref(false)
const error = ref<string | null>(null)
const kmzPoints = ref<KmzTablePoint[]>([])

const litologiaOptions = computed(() => {
  const set = new Set<string>()
  kmzPoints.value.forEach((p) => {
    const value = p.litologia.trim()
    if (value) set.add(value)
  })
  return Array.from(set)
})

const unidadeGeologicaOptions = computed(() => {
  const set = new Set<string>()
  kmzPoints.value.forEach((p) => {
    const value = p.unidadeGeologica.trim()
    if (value) set.add(value)
  })
  return Array.from(set)
})

// Util simples para limpar as camadas anteriores
function clearLayers() {
  markers.forEach((m) => m.remove())
  polylines.forEach((p) => p.remove())
  markers = []
  polylines = []
  kmzPoints.value = []
  emit('update:kmzPoints', [])
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

  type ParsedPoint = { lat: number; lng: number; name?: string }

  const points: ParsedPoint[] = []
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
      let name = ''
      const placemark = pointNode.closest('Placemark')
      if (placemark) {
        const nameNode = placemark.getElementsByTagName('name')[0]
        if (nameNode && nameNode.textContent) {
          name = nameNode.textContent.trim()
        }
      }

      points.push({ lat, lng, name })
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
  const lowerName = file.name.toLowerCase()
  if (!lowerName.endsWith('.kmz') && !lowerName.endsWith('.kml')) {
    error.value = 'Por favor, selecione um arquivo KMZ ou KML válido.'
    return
  }

  loading.value = true
  clearLayers()

  try {
    let kmlText: string

    if (lowerName.endsWith('.kml')) {
      kmlText = await file.text()
    } else {
      const arrayBuffer = await file.arrayBuffer()
      const zip = await JSZip.loadAsync(arrayBuffer)

      // Tenta encontrar o primeiro arquivo .kml dentro do KMZ
      const kmlFileEntry = Object.values(zip.files).find((f) =>
        f.name.toLowerCase().endsWith('.kml'),
      )

      if (!kmlFileEntry) {
        throw new Error('KMZ não contém nenhum arquivo KML interno.')
      }

      kmlText = await kmlFileEntry.async('text')
    }

    const { points, lines } = parseKmlCoordinates(kmlText)

    if (!map) return

    const allCoords: [number, number][] = []

    kmzPoints.value = points.map((p, index) => ({
      id: index + 1,
      name: p.name || `Ponto ${index + 1}`,
      lat: p.lat,
      lng: p.lng,
      litologia: '',
      unidadeGeologica: '',
      mergulho: '',
    }))

    emit(
      'update:kmzPoints',
      kmzPoints.value.map((p) => ({
        id: p.id,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
      })),
    )

    // Adiciona marcadores para pontos
    points.forEach(({ lat, lng, name }) => {
      const marker = L.marker([lat, lng], { icon: kmzPointIcon })
      if (name) {
        marker.bindPopup(name)
      }
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
      error.value = 'Nenhuma coordenada encontrada dentro do arquivo.'
      return
    }

    // Ajusta o mapa para enquadrar todos os pontos
    const bounds = L.latLngBounds(allCoords)
    map.fitBounds(bounds, { padding: [30, 30] })
  } catch (e: any) {
    console.error(e)
    error.value = e?.message || 'Erro ao processar o arquivo KMZ/KML.'
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
      <h2>Mapa (KMZ / KML)</h2>
      <p>
        Selecione um arquivo <strong>.kmz</strong> ou <strong>.kml</strong> (por exemplo, exportado do QGIS
        ou do Google Earth) e os pontos/linhas serão exibidos no mapa.
      </p>
    </header>

    <div class="kmz-map__controls">
      <label class="kmz-map__file-label">
        <span>Selecione o arquivo KMZ ou KML</span>
        <input
          type="file"
          accept=".kmz,.kml"
          class="kmz-map__file-input"
          @change="handleFileChange"
        />
      </label>

      <span v-if="loading" class="kmz-map__status">Carregando arquivo...</span>
      <span v-if="error" class="kmz-map__error">{{ error }}</span>
    </div>

    <div ref="mapContainer" class="kmz-map__map"></div>

    <div v-if="kmzPoints.length" class="kmz-map__table-wrapper">
      <h3>Informações dos pontos</h3>
      <div class="kmz-map__table-scroll">
        <table class="kmz-map__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nome do ponto</th>
              <th>Coordenadas</th>
              <th>Litologia</th>
              <th>Unidade geológica</th>
              <th>Mergulho da camada</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(ponto, index) in kmzPoints" :key="ponto.id">
              <td>{{ index + 1 }}</td>
              <td>
                <input v-model="ponto.name" type="text" />
              </td>
              <td>
                {{ ponto.lat.toFixed(5) }}, {{ ponto.lng.toFixed(5) }}
              </td>
              <td>
                <input v-model="ponto.litologia" type="text" list="litologia-options" />
              </td>
              <td>
                <input
                  v-model="ponto.unidadeGeologica"
                  type="text"
                  list="unidade-geologica-options"
                />
              </td>
              <td>
                <input v-model="ponto.mergulho" type="text" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <datalist id="litologia-options">
      <option v-for="opt in litologiaOptions" :key="opt" :value="opt" />
    </datalist>

    <datalist id="unidade-geologica-options">
      <option v-for="opt in unidadeGeologicaOptions" :key="opt" :value="opt" />
    </datalist>
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

:global(.kmz-map__marker) {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: radial-gradient(circle at 30% 30%, #dbeafe, #3b82f6 60%, #1d4ed8);
  border: 2px solid #1e3a8a;
  box-shadow:
    0 0 0 2px rgba(59, 130, 246, 0.35),
    0 6px 10px rgba(0, 0, 0, 0.45);
}

.kmz-map__table-wrapper {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px solid #1f2937;
  background: #020617;
}

.kmz-map__table-wrapper h3 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
}

.kmz-map__table-scroll {
  max-height: 260px;
  overflow: auto;
}

.kmz-map__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.kmz-map__table thead {
  position: sticky;
  top: 0;
  background: #020617;
  z-index: 1;
}

.kmz-map__table th,
.kmz-map__table td {
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid #1f2937;
  text-align: left;
}

.kmz-map__table th {
  font-weight: 500;
  color: #e5e7eb;
  white-space: nowrap;
}

.kmz-map__table td {
  color: #e5e7eb;
}

.kmz-map__table input {
  width: 100%;
  padding: 0.25rem 0.4rem;
  border-radius: 0.375rem;
  border: 1px solid #4b5563;
  background: #020617;
  color: #e5e7eb;
  font-size: 0.8rem;
}

.kmz-map__table input:focus {
  outline: none;
  border-color: #22c55e;
  box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.4);
}

/* Garante que o CSS do Leaflet funcione bem dentro do escopo */
:global(.leaflet-container) {
  width: 100%;
  height: 100%;
}
</style>
