<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import L, { Map as LeafletMap, Marker } from 'leaflet'
import JSZip from 'jszip'
import * as exifr from 'exifr'

import 'leaflet/dist/leaflet.css'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
type ImagePointCode = string

interface ImageMetadata {
  file: File
  title: string
  code: ImagePointCode
  lat?: number
  lng?: number
  isCondemned: boolean
}

interface ImagePoint {
  code: ImagePointCode
  lat?: number
  lng?: number
  images: ImageMetadata[]
}

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

const fileInput = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const allImages = ref<ImageMetadata[]>([])
const points = ref<ImagePoint[]>([])

const mapContainer = ref<HTMLDivElement | null>(null)
let map: LeafletMap | null = null
let markers: Marker[] = []

// ---------------------------------------------------------------------------
// Helpers de parsing
// ---------------------------------------------------------------------------

function extractTitleFromExif(meta: any): string | null {
  const rawTitle: unknown =
    meta?.ImageDescription || meta?.XPTitle || meta?.ObjectName || meta?.Title

  const title =
    typeof rawTitle === 'string' ? rawTitle.trim() : String(rawTitle ?? '').trim()

  if (!title) return null
  return title
}

// Pega a última linha não vazia do título (ex.: "P36 LE")
function extractCodeFromTitle(title: string): string | null {
  const lines = title
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (!lines.length) return null
  const last = lines[lines.length - 1]!
  return last || null
}

function extractLatLngFromExif(meta: any): { lat?: number; lng?: number } {
  const lat = (meta?.latitude ?? meta?.GPSLatitude) as number | undefined
  const lng = (meta?.longitude ?? meta?.GPSLongitude) as number | undefined

  if (typeof lat === 'number' && typeof lng === 'number') {
    return { lat, lng }
  }

  return {}
}

function detectCondemned(title: string, meta: any): boolean {
  const text = `${title} ${JSON.stringify(meta ?? {})}`.toLowerCase()
  return text.includes('condenada') || text.includes('condenado')
}

// ---------------------------------------------------------------------------
// Processamento de arquivos
// ---------------------------------------------------------------------------

async function handleFilesSelected(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files

  error.value = null
  allImages.value = []
  points.value = []
  clearMarkers()

  if (!files || !files.length) return

  loading.value = true

  try {
    const loaded: ImageMetadata[] = []

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue

      try {
        const meta: any = await exifr.parse(file, {
          gps: true,
          xmp: true,
          iptc: true,
          tiff: true,
        })

        const title = extractTitleFromExif(meta)

        // Ignora imagens sem título
        if (!title) continue

        const code = extractCodeFromTitle(title)
        if (!code) continue

        const { lat, lng } = extractLatLngFromExif(meta)
        const isCondemned = detectCondemned(title, meta)

        loaded.push({
          file,
          title,
          code,
          lat,
          lng,
          isCondemned,
        })
      } catch (innerError) {
        console.error('Erro ao ler metadados da imagem', file.name, innerError)
      }
    }

    allImages.value = loaded
    buildPointsFromImages()
    renderMarkers()
  } catch (e: any) {
    console.error(e)
    error.value = e?.message || 'Erro ao processar as imagens.'
  } finally {
    loading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

function buildPointsFromImages() {
  const mapByCode = new Map<ImagePointCode, ImagePoint>()

  for (const img of allImages.value) {
    let point = mapByCode.get(img.code)
    if (!point) {
      point = {
        code: img.code,
        lat: undefined,
        lng: undefined,
        images: [],
      }
      mapByCode.set(img.code, point)
    }

    point.images.push(img)

    // Usa a primeira coordenada disponível para o ponto
    if (
      point.lat === undefined &&
      point.lng === undefined &&
      img.lat !== undefined &&
      img.lng !== undefined
    ) {
      point.lat = img.lat
      point.lng = img.lng
    }
  }

  points.value = Array.from(mapByCode.values())
}

const totalPoints = computed(() => points.value.length)
const totalImages = computed(() => allImages.value.length)
const totalCondemnedImages = computed(
  () => allImages.value.filter((img) => img.isCondemned).length,
)

// ---------------------------------------------------------------------------
// Mapa Leaflet
// ---------------------------------------------------------------------------

function clearMarkers() {
  markers.forEach((m) => m.remove())
  markers = []
}

function renderMarkers() {
  if (!map) return

  clearMarkers()

  const boundsLatLng: [number, number][] = []

  for (const point of points.value) {
    if (point.lat === undefined || point.lng === undefined) continue

    const marker = L.marker([point.lat, point.lng])
    const condemnedCount = point.images.filter((i) => i.isCondemned).length

    const popupLines: string[] = []
    popupLines.push(`<strong>Ponto:</strong> ${point.code}`)
    popupLines.push(`<strong>Imagens:</strong> ${point.images.length}`)

    if (condemnedCount > 0) {
      popupLines.push(`<strong>Condenadas:</strong> ${condemnedCount}`)
    }

    popupLines.push('<hr />')
    popupLines.push(
      '<ul style="padding-left:16px; margin:0; max-height:160px; overflow:auto;">',
    )

    for (const img of point.images) {
      popupLines.push(
        `<li>${img.file.name}${img.isCondemned ? ' (condenada)' : ''}</li>`,
      )
    }

    popupLines.push('</ul>')

    marker.bindPopup(popupLines.join('<br />'))
    marker.addTo(map)
    markers.push(marker)

    boundsLatLng.push([point.lat, point.lng])
  }

  if (boundsLatLng.length) {
    const bounds = L.latLngBounds(boundsLatLng)
    map!.fitBounds(bounds, { padding: [30, 30] })
  }
}

// ---------------------------------------------------------------------------
// Exportação KMZ
// ---------------------------------------------------------------------------

function generateKml(): string {
  const placemarks: string[] = []

  for (const point of points.value) {
    if (point.lat === undefined || point.lng === undefined) continue

    const condemnedCount = point.images.filter((i) => i.isCondemned).length
    const descriptionLines: string[] = []

    descriptionLines.push(`Ponto: ${point.code}`)
    descriptionLines.push(`Imagens: ${point.images.length}`)

    if (condemnedCount > 0) {
      descriptionLines.push(`Condenadas: ${condemnedCount}`)
    }

    descriptionLines.push('')
    descriptionLines.push('Arquivos:')

    for (const img of point.images) {
      descriptionLines.push(
        `- ${img.file.name}${img.isCondemned ? ' (condenada)' : ''}`,
      )
    }

    const description = descriptionLines.join('\n')

    placemarks.push(`
      <Placemark>
        <name>${point.code}</name>
        <description><![CDATA[${description}]]></description>
        <Point>
          <coordinates>${point.lng},${point.lat},0</coordinates>
        </Point>
      </Placemark>
    `)
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Pontos de imagens</name>
    ${placemarks.join('\n')}
  </Document>
</kml>`
}

async function exportKmz() {
  if (!points.value.length) return

  try {
    const kml = generateKml()
    const zip = new JSZip()
    zip.file('doc.kml', kml)

    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'pontos-imagens.kmz'
    link.click()
    URL.revokeObjectURL(url)
  } catch (e: any) {
    console.error(e)
    error.value = e?.message || 'Erro ao exportar KMZ.'
  }
}

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

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
})

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
  clearMarkers()
})
</script>

<template>
  <section class="img-map">
    <header class="img-map__header">
      <h2>Imagens e Metadados (Mapa)</h2>
      <p>
        Carregue uma pasta com fotos georreferenciadas e veja, em um único
        mapa, <strong>todos os pontos</strong> e o conjunto de imagens
        associados a cada um deles.
      </p>

      <p class="img-map__example">
        Exemplo de título em 3 linhas:<br />
        Trecho BR-135<br />
        Mapeamento geológico (DNIT L3 - OS-40A)<br />
        <strong>P36 LE</strong>
      </p>

      <ul class="img-map__rules">
        <li>
          Apenas a <strong>última linha</strong> do título (ex.: <strong>P36 LE</strong>)
          é usada como <strong>código do ponto</strong>.
        </li>
        <li>
          Todas as imagens com o <strong>mesmo código final</strong> são
          agrupadas em <strong>um único marcador</strong> no mapa.
        </li>
        <li>
          Imagens <strong>sem título</strong> são ignoradas e não entram na
          contagem nem na lista.
        </li>
        <li>
          Se o título ou os metadados contiverem a palavra
          <strong>"condenada"</strong>, a imagem será destacada como
          <span class="img-map__badge img-map__badge--danger">condenada</span>
          na lista e no resumo exportado para KMZ.
        </li>
      </ul>
    </header>

    <div class="img-map__controls">
      <label class="img-map__file-label">
        <span>Selecionar pasta de imagens</span>
        <input
          ref="fileInput"
          type="file"
          class="img-map__file-input"
          accept="image/*"
          multiple
          webkitdirectory
          @change="handleFilesSelected"
        />
      </label>

      <button
        type="button"
        class="img-map__export-button"
        :disabled="!points.length"
        @click="exportKmz"
      >
        Exportar pontos para KMZ
      </button>

      <span v-if="loading" class="img-map__status">Lendo metadados...</span>
      <span v-if="error" class="img-map__error">{{ error }}</span>
    </div>

    <section class="img-map__summary" v-if="totalImages || totalPoints">
      <p>
        Pontos distintos: <strong>{{ totalPoints }}</strong> · Imagens
        consideradas: <strong>{{ totalImages }}</strong> · Imagens condenadas:
        <strong>{{ totalCondemnedImages }}</strong>
      </p>
    </section>

    <div class="img-map__layout">
      <div ref="mapContainer" class="img-map__map"></div>

      <div class="img-map__list" v-if="points.length">
        <h3>Pontos e imagens</h3>
        <ul>
          <li v-for="point in points" :key="point.code">
            <div class="img-map__point-header">
              <span class="img-map__point-code">{{ point.code }}</span>
              <span class="img-map__point-count">
                {{ point.images.length }} imagem(ns)
              </span>
            </div>
            <ul class="img-map__images">
              <li
                v-for="img in point.images"
                :key="img.file.name + img.title"
              >
                <span>
                  {{ img.file.name }}
                  <span
                    v-if="img.isCondemned"
                    class="img-map__badge img-map__badge--danger"
                  >
                    condenada
                  </span>
                </span>
                <div class="img-map__image-title">
                  {{ img.title }}
                </div>
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.img-map {
  max-width: 1200px;
  margin: 0 auto 2rem;
  padding: 0 1.5rem 2rem;
}

.img-map__header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.img-map__header h2 {
  margin: 0;
  font-size: 1.4rem;
}

.img-map__header p {
  margin: 0;
  color: #d1d5db;
  font-size: 0.9rem;
}

.img-map__example {
  margin: 0.25rem 0;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  background: radial-gradient(circle at top left, #1f2937, #020617);
  border: 1px solid #334155;
  font-size: 0.9rem;
}

.img-map__rules {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
  font-size: 0.85rem;
  color: #cbd5e1;
}

.img-map__rules li {
  margin-bottom: 0.3rem;
}

.img-map__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.img-map__file-label {
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

.img-map__file-input {
  display: none;
}

.img-map__export-button {
  padding: 0.45rem 1.1rem;
  border-radius: 999px;
  border: 1px solid #4b5563;
  background: #0f172a;
  color: #e5e7eb;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}

.img-map__export-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.img-map__export-button:not(:disabled):hover {
  background: #111827;
  border-color: #9ca3af;
}

.img-map__status {
  font-size: 0.85rem;
  color: #e5e7eb;
}

.img-map__error {
  font-size: 0.85rem;
  color: #f97373;
}

.img-map__summary {
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  color: #e5e7eb;
}

.img-map__layout {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1.5fr);
  gap: 1rem;
}

.img-map__map {
  width: 100%;
  height: 420px;
  border-radius: 1rem;
  overflow: hidden;
  border: 1px solid #1f2937;
}

.img-map__list {
  background-color: #020617;
  border-radius: 1rem;
  border: 1px solid #1f2937;
  padding: 0.75rem 0.9rem;
  max-height: 420px;
  overflow: auto;
}

.img-map__list h3 {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
}

.img-map__list > ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.img-map__point-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.img-map__point-code {
  font-weight: 600;
}

.img-map__point-count {
  font-size: 0.8rem;
  color: #9ca3af;
}

.img-map__images {
  list-style: none;
  margin: 0 0 0.5rem;
  padding: 0 0 0 0.75rem;
  border-left: 1px solid #1f2937;
}

.img-map__images li {
  margin-bottom: 0.4rem;
  font-size: 0.85rem;
}

.img-map__image-title {
  margin-top: 0.1rem;
  color: #9ca3af;
}

.img-map__badge {
  margin-left: 0.25rem;
  padding: 0.05rem 0.3rem;
  border-radius: 999px;
  font-size: 0.7rem;
}

.img-map__badge--danger {
  background-color: #7f1d1d;
  color: #fee2e2;
}

:global(.leaflet-container) {
  width: 100%;
  height: 100%;
}

@media (max-width: 900px) {
  .img-map__layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .img-map__list {
    max-height: 260px;
  }
}
</style>
