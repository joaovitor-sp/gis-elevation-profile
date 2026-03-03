<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  elevations: number[]
}>()

// Configuração de visualização
const height = 380
const padding = 40
const width = 960

const smoothEnabled = ref<boolean>(false)
const smoothWindow = ref<number>(5)

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
        sum += props.elevations[j]
        count += 1
      }
    }

    result.push(sum / (count || 1))
  }

  return result
})

const svgRef = ref<SVGSVGElement | null>(null)

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
</style>
