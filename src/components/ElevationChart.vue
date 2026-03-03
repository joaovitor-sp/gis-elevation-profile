<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  elevations: number[]
}>()

// Configuração de visualização
const height = 380
const padding = 40
const width = 960

// Layout do histograma
const histogramPaddingTop = 50
const histogramPaddingBottom = 60
const histogramPaddingLeft = 60
const histogramPaddingRight = 30

const smoothEnabled = ref<boolean>(false)
const smoothWindow = ref<number>(5)

const bucketCount = ref<number>(5)

const hasData = computed(() => props.elevations.length > 0)

const stats = computed(() => {
  if (!props.elevations.length) {
    return undefined as
      | undefined
      | {
          min: number
          max: number
          range: number
          count: number
        }
  }

  const min = Math.min(...props.elevations)
  const max = Math.max(...props.elevations)
  const range = max - min || 1

  return {
    min,
    max,
    range,
    count: props.elevations.length,
  }
})

// Gera uma versão suavizada da série usando média móvel simples
const smoothedElevations = computed(() => {
  const n = props.elevations.length
  if (!smoothEnabled.value || n === 0) {
    return props.elevations
  }

  const windowSize = Math.max(1, Math.min(smoothWindow.value, n))
  if (windowSize === 1) return props.elevations

  const half = Math.floor(windowSize / 2)
  const result: number[] = []

  for (let i = 0; i < n; i++) {
    let sum = 0
    let count = 0

    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < n) {
        sum += props.elevations[j]!
        count += 1
      }
    }

    result.push(sum / (count || 1))
  }

  return result
})

const svgRef = ref<SVGSVGElement | null>(null)
const histogramSvgRef = ref<SVGSVGElement | null>(null)

type ElevationBucket = {
  index: number
  from: number
  to: number
  count: number
  percentage: number
}

const buckets = computed<ElevationBucket[] | null>(() => {
  const currentStats = stats.value
  const n = props.elevations.length
  const kRaw = Math.floor(bucketCount.value)
  const k = Math.max(1, kRaw)

  if (!currentStats || n === 0 || k <= 0) return null

  const { min, max } = currentStats
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null

  const start = Math.floor(min)
  const end = Math.ceil(max)
  const intRange = end - start

  if (intRange <= 0) {
    // Todos valores (praticamente) iguais: um único bucket inteiro 100%
    return [
      {
        index: 0,
        from: start,
        to: end,
        count: n,
        percentage: 100,
      },
    ]
  }

  // Limites inteiros das faixas (k buckets => k+1 fronteiras inteiras)
  const boundaries: number[] = Array.from({ length: k + 1 }, (_, i) => {
    return start + Math.round((intRange * i) / k)
  })

  const rawBuckets: ElevationBucket[] = Array.from({ length: k }, (_, i) => ({
    index: i,
    from: boundaries[i]!,
    to: boundaries[i + 1]!,
    count: 0,
    percentage: 0,
  }))

  for (const v of props.elevations) {
    if (!Number.isFinite(v)) continue
    const clamped = Math.max(start, Math.min(end, v))

    // Encontra o bucket: [boundary[i], boundary[i+1}), último inclui o fim
    let idx = k - 1
    for (let i = 0; i < k - 1; i++) {
      if (clamped < boundaries[i + 1]!) {
        idx = i
        break
      }
    }

    rawBuckets[idx]!.count += 1
  }

  return rawBuckets.map((b) => ({
    ...b,
    percentage: n ? Math.round((b.count / n) * 100) : 0,
  }))
})
type HistogramBar = ElevationBucket & {
  x: number
  y: number
  barWidth: number
  barHeight: number
}

type HistogramTick = {
  value: number
  y: number
}

const histogramMaxY = computed(() => {
  const list = buckets.value
  if (!list || !list.length) return 0
  const maxPercent = Math.max(...list.map((b) => b.percentage), 0)
  const base = Math.max(10, maxPercent)
  return Math.ceil(base / 10) * 10
})

const histogramBars = computed<HistogramBar[]>(() => {
  const list = buckets.value
  if (!list || !list.length) return []

  const innerWidth = width - histogramPaddingLeft - histogramPaddingRight
  const innerHeight = height - histogramPaddingTop - histogramPaddingBottom

  const maxY = histogramMaxY.value || 1
  const baseBarWidth = innerWidth / list.length

  return list.map((bucket, index) => {
    const barHeight = (bucket.percentage / maxY) * innerHeight
    const x = histogramPaddingLeft + index * baseBarWidth
    const y = histogramPaddingTop + (innerHeight - barHeight)
    const barWidth = Math.max(baseBarWidth * 0.7, 4)

    return {
      ...bucket,
      x,
      y,
      barWidth,
      barHeight,
    }
  })
})

const histogramTicks = computed<HistogramTick[]>(() => {
  const maxY = histogramMaxY.value
  if (!maxY) return []

  const innerHeight = height - histogramPaddingTop - histogramPaddingBottom
  const steps = 5
  const ticks: HistogramTick[] = []

  for (let i = 0; i <= steps; i++) {
    const value = (maxY / steps) * i
    const ratio = value / maxY
    const y = histogramPaddingTop + (innerHeight - ratio * innerHeight)
    ticks.push({ value, y })
  }

  return ticks
})

const points = computed(() => {
  const series = smoothedElevations.value
  const n = series.length
  const currentStats = stats.value

  if (!n || !currentStats) return ''

  const { max, range } = currentStats
  const innerWidth = width - 2 * padding
  const innerHeight = height - 2 * padding

  return series
    .map((elevation, index) => {
      const x =
        n === 1
          ? padding + innerWidth / 2
          : padding + (index / (n - 1)) * innerWidth

      const y = padding + ((max - elevation) / range) * innerHeight

      return `${x},${y}`
    })
    .join(' ')
})

async function exportAsPng() {
  if (!svgRef.value || !hasData.value) return

  const svgElement = svgRef.value
  const clone = svgElement.cloneNode(true) as SVGSVGElement

  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(clone)
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  const image = new Image()
  image.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(image, 0, 0)
      URL.revokeObjectURL(url)

      const pngUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = pngUrl
      link.download = 'perfil-elevacao.png'
      link.click()
    }
  }

  image.src = url
}

async function exportHistogramAsPng() {
  if (!histogramSvgRef.value || !buckets.value || !buckets.value.length) return

  const svgElement = histogramSvgRef.value
  const clone = svgElement.cloneNode(true) as SVGSVGElement

  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(clone)
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  const image = new Image()
  image.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(image, 0, 0)
      URL.revokeObjectURL(url)

      const pngUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = pngUrl
      link.download = 'histograma-frequencia-altimetrica.png'
      link.click()
    }
  }

  image.src = url
}
</script>

<template>
  <section class="elevation-chart">
    <header class="elevation-chart__header">
      <h2>Gráfico de elevação</h2>
      <p v-if="!hasData" class="elevation-chart__placeholder">
        Cole alguns valores de elevação e clique em "Gerar gráfico de elevação"
        para visualizar o perfil.
      </p>
      <p v-else-if="stats" class="elevation-chart__summary">
        Pontos: <strong>{{ stats.count }}</strong>
        · Mín: <strong>{{ stats.min.toFixed(2) }}</strong>
        · Máx: <strong>{{ stats.max.toFixed(2) }}</strong>
        · Amplitude: <strong>{{ stats.range.toFixed(2) }}</strong>
      </p>
    </header>

    <div v-if="hasData" class="elevation-chart__controls">
      <label class="elevation-chart__control">
        <input v-model="smoothEnabled" type="checkbox" />
        Suavizar perfil
      </label>

      <label v-if="smoothEnabled" class="elevation-chart__control">
        Janela de suavização: {{ smoothWindow }}
        <input
          v-model.number="smoothWindow"
          type="range"
          min="3"
          max="31"
          step="2"
        />
      </label>

      <label class="elevation-chart__control">
        Divisões de elevação: {{ bucketCount }}
        <input
          v-model.number="bucketCount"
          type="range"
          min="2"
          max="12"
          step="1"
        />
      </label>

      <button
        type="button"
        class="elevation-chart__export-button"
        @click="exportAsPng"
      >
        Exportar gráfico (PNG)
      </button>
    </div>

    <div v-if="hasData" class="elevation-chart__canvas-wrapper">
      <svg
        class="elevation-chart__canvas"
        ref="svgRef"
        :viewBox="`0 0 ${width} ${height}`"
        :width="width"
        :height="height"
        role="img"
        aria-label="Gráfico de perfil de elevação"
      >
        <!-- Área de fundo -->
        <defs>
          <linearGradient id="elevation-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#22c55e" stop-opacity="0.6" />
            <stop offset="100%" stop-color="#0f172a" stop-opacity="0.1" />
          </linearGradient>
        </defs>

        <!-- Eixos simples -->
        <g stroke="#64748b" stroke-width="1">
          <line :x1="padding" :y1="height - padding" :x2="width - padding" :y2="height - padding" />
          <line :x1="padding" :y1="padding" :x2="padding" :y2="height - padding" />
        </g>

        <!-- Linha de perfil -->
        <polyline
          :points="points"
          fill="none"
          stroke="#22c55e"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- Área sob a curva -->
        <polygon
          v-if="points"
          :points="`${points} ${width - padding},${height - padding} ${padding},${height - padding}`"
          fill="url(#elevation-gradient)"
          opacity="0.9"
        />
      </svg>
    </div>

    <div v-if="hasData && buckets && buckets.length" class="elevation-chart__buckets">
      <h3>Distribuição por faixas de elevação</h3>
      <table>
        <thead>
          <tr>
            <th>Faixa</th>
            <th>Pontos</th>
            <th>% dos pontos</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="bucket in buckets" :key="bucket.index">
            <td>
              {{ Math.floor(bucket.from) }} –
              {{ Math.ceil(bucket.to) }}
            </td>
            <td>{{ bucket.count }}</td>
            <td>{{ bucket.percentage }}%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="hasData && buckets && buckets.length" class="elevation-chart__histogram">
      <div class="elevation-chart__histogram-header">
        <h3>Histograma de frequência altimétrica</h3>
        <button
          type="button"
          class="elevation-chart__export-button-secondary"
          @click="exportHistogramAsPng"
        >
          Exportar histograma (PNG)
        </button>
      </div>

      <svg
        ref="histogramSvgRef"
        class="elevation-chart__histogram-canvas"
        :viewBox="`0 0 ${width} ${height}`"
        :width="width"
        :height="height"
        role="img"
        aria-label="Histograma de frequência altimétrica: Frequência altimétrica (%) por intervalo de altitude (m)"
      >
        <!-- Fundo branco -->
        <rect :width="width" :height="height" fill="#ffffff" />

        <!-- Título -->
        <text
          x="50%"
          y="28"
          text-anchor="middle"
          font-size="16"
          fill="#111827"
          font-weight="700"
        >
          Histograma de frequência altimétrica
        </text>

        <!-- Eixo Y: Frequência altimétrica (%) -->
        <text
          x="18"
          y="50%"
          text-anchor="middle"
          font-size="10"
          font-weight="700"
          fill="#374151"
          :transform="`rotate(-90 18 ${height / 2})`"
        >
          Frequência altimétrica (%)
        </text>

        <!-- Eixo X: Intervalo de altitude (m) -->
        <text
          x="50%"
          :y="height - 10"
          text-anchor="middle"
          font-size="10"
          font-weight="700"
          fill="#374151"
        >
          Intervalo de altitude (m)
        </text>

        <!-- Grade e rótulos de eixo Y -->
        <g v-if="histogramTicks.length" stroke="#9ca3af" stroke-width="1">
          <line
            v-for="tick in histogramTicks"
            :key="`grid-${tick.value}`"
            :x1="histogramPaddingLeft"
            :x2="width - histogramPaddingRight"
            :y1="tick.y"
            :y2="tick.y"
            stroke-dasharray="2 4"
          />

          <text
            v-for="tick in histogramTicks"
            :key="`tick-${tick.value}`"
            :x="histogramPaddingLeft - 6"
            :y="tick.y + 3"
            text-anchor="end"
            font-size="10"
            fill="#111827"
          >
            {{ tick.value }}%
          </text>
        </g>

        <!-- Barras -->
        <g v-if="histogramBars.length" fill="#2563eb">
          <rect
            v-for="bar in histogramBars"
            :key="bar.index"
            :x="bar.x + (bar.barWidth < 4 ? 0 : (bar.barWidth * 0.15))"
            :y="bar.y"
            :width="bar.barWidth"
            :height="bar.barHeight"
            rx="2"
          />

          <!-- Rótulos de faixa no eixo X -->
          <text
            v-for="bar in histogramBars"
            :key="`label-${bar.index}`"
            :x="bar.x + bar.barWidth / 2"
            :y="height - 24"
            text-anchor="middle"
            font-size="12"
            fill="#000000"
          >
            {{ Math.floor(bar.from) }}–{{ Math.ceil(bar.to) }}
          </text>

          <!-- Percentual acima de cada barra -->
          <text
            v-for="bar in histogramBars"
            :key="`pct-${bar.index}`"
            :x="bar.x + bar.barWidth / 2"
            :y="bar.y - 4"
            text-anchor="middle"
            font-weight="500"
            font-size="10"
            fill="#111827"
          >
            {{ bar.percentage }}%
          </text>
        </g>
      </svg>
    </div>
  </section>
</template>

<style scoped>
.elevation-chart {
  max-width: 1200px;
  margin: 0 auto 2rem;
  padding: 0 1.5rem 2rem;
}

.elevation-chart__header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1rem;
}

.elevation-chart__header h2 {
  margin: 0;
  font-size: 1.4rem;
}

.elevation-chart__summary,
.elevation-chart__placeholder {
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.elevation-chart__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.elevation-chart__control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #e5e7eb;
}

.elevation-chart__export-button {
  margin-left: auto;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  border: 1px solid #4b5563;
  background: #020617;
  color: #e5e7eb;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}

.elevation-chart__export-button:hover {
  background: #0f172a;
  border-color: #9ca3af;
}

.elevation-chart__export-button-secondary {
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #111827;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}

.elevation-chart__export-button-secondary:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
}

.elevation-chart__canvas-wrapper {
  border-radius: 1rem;
  border: 1px solid #1f2937;
  background: radial-gradient(circle at top left, #1f2937, #020617);
  padding: 1rem;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.6);
}

.elevation-chart__canvas {
  display: block;
}

.elevation-chart__buckets {
  margin-top: 1.5rem;
}

.elevation-chart__buckets h3 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
}

.elevation-chart__buckets table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.elevation-chart__buckets th,
.elevation-chart__buckets td {
  padding: 0.4rem 0.5rem;
  text-align: left;
}

.elevation-chart__buckets thead {
  background-color: #020617;
}

.elevation-chart__buckets tbody tr:nth-child(odd) {
  background-color: #020617;
}

.elevation-chart__buckets tbody tr:nth-child(even) {
  background-color: #020817;
}

.elevation-chart__histogram {
  margin-top: 1.5rem;
  padding: 1rem;
  border-radius: 1rem;
  background: #ffffff;
  border: 1px solid #e5e7eb;
}

.elevation-chart__histogram-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.elevation-chart__histogram-header h3 {
  margin: 0;
  font-size: 1rem;
  color: #111827;
}

.elevation-chart__histogram-canvas {
  width: 100%;
  height: auto;
  display: block;
}
</style>
