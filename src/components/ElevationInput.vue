<script setup lang="ts">
import { ref } from 'vue'

type ProfilePoint = {
  distanceMeters: number
  latitudeMeters: number
  longitudeMeters: number
  elevationMeters: number
}

const model = ref<string>('')
const errors = ref<string[]>([])

const emit = defineEmits<{
  (e: 'update:elevations', values: ProfilePoint[]): void
}>()

function parseNumber(value: string): number {
  return Number(value.replace(',', '.'))
}

function parseElevations(raw: string): { values: ProfilePoint[]; errors: string[] } {
  const lines = raw.split(/\r?\n/)
  const values: ProfilePoint[] = []
  const parseErrors: string[] = []

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) {
      // Ignora linhas vazias caso ocorram
      return
    }

    // Separadores comuns: tab, espaços, ponto-e-vírgula.
    const parts = trimmed.split(/[\t;\s]+/).filter(Boolean)

    if (parts.length < 4) {
      parseErrors.push(
        `Linha ${index + 1}: esperado 4 colunas (posição, latitude, longitude, elevação).`,
      )
      return
    }

    const distanceMeters = parseNumber(parts[0] ?? '')
    const latitudeMeters = parseNumber(parts[1] ?? '')
    const longitudeMeters = parseNumber(parts[2] ?? '')
    const elevationMeters = parseNumber(parts[3] ?? '')

    if (
      Number.isFinite(distanceMeters) &&
      Number.isFinite(latitudeMeters) &&
      Number.isFinite(longitudeMeters) &&
      Number.isFinite(elevationMeters)
    ) {
      values.push({
        distanceMeters,
        latitudeMeters,
        longitudeMeters,
        elevationMeters,
      })
    } else {
      parseErrors.push(`Linha ${index + 1}: valor inválido "${line}"`)
    }
  })

  if (!values.length) {
    parseErrors.push('Nenhum ponto válido foi encontrado nas 4 colunas esperadas.')
  }

  return { values, errors: parseErrors }
}

function handleGenerate() {
  const { values, errors: parseErrors } = parseElevations(model.value)
  errors.value = parseErrors

  if (!parseErrors.length) {
    emit('update:elevations', values)
  }
}
</script>

<template>
  <section class="elevation-input">
    <header class="elevation-input__header">
      <h1>Perfil de Elevação</h1>
      <p>
        Visualize o perfil altimétrico de uma linha a partir de dados de distância, 
        coordenadas UTM e elevação.
      </p>
    </header>

    <div class="elevation-input__body">
      <!-- Caixa de instruções destacada -->
      <div class="elevation-input__info-box">
        <h3 class="elevation-input__info-box-title">📍 Formato esperado:</h3>
        <div class="elevation-input__format-columns">
          <div class="elevation-input__column-info">
            <span class="elevation-input__column-number">1</span>
            <div>
              <strong>Distância (m)</strong>
              <p>Distância acumulada em metros (ex: 0.0, 2.8, 39.7)</p>
            </div>
          </div>
          <div class="elevation-input__column-info">
            <span class="elevation-input__column-number">2</span>
            <div>
              <strong>Latitude UTM (m)</strong>
              <p>Coordenada Y em metros no sistema UTM (ex: 9357547.32)</p>
            </div>
          </div>
          <div class="elevation-input__column-info">
            <span class="elevation-input__column-number">3</span>
            <div>
              <strong>Longitude UTM (m)</strong>
              <p>Coordenada X em metros no sistema UTM (ex: 375231.76)</p>
            </div>
          </div>
          <div class="elevation-input__column-info">
            <span class="elevation-input__column-number">4</span>
            <div>
              <strong>Elevação (m)</strong>
              <p>Altitude em metros (ex: 201.48)</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Aviso sobre formato incorreto -->
      <div class="elevation-input__warning-box">
        <strong>⚠️ ATENÇÃO:</strong> Se seus dados estão em <strong>graus (coordenadas geográficas)</strong>, 
        você precisa convertê-los para <strong>UTM em metros</strong> primeiro usando o QGIS ou outro software de GIS. 
        Os valores UTM são geralmente números grandes (ex: 375231.76) e NÃO pequenos decimais (ex: -45.123).
      </div>

      <label class="elevation-input__label" for="elevation-textarea">
        Cole aqui (Tab, espaço ou ponto-e-vírgula como separador):
      </label>
      <textarea
        id="elevation-textarea"
        v-model="model"
        class="elevation-input__textarea"
        rows="12"
        placeholder="Distância(m)    Lat_UTM(m)      Long_UTM(m)     Elevação(m)&#10;0.0             9357547.3236    375231.7634     201.476&#10;2.8243          9357548.9313    375234.0856     201.476&#10;39.7112         9357569.9875    375264.3721     200.712"
      />

      <button type="button" class="elevation-input__button" @click="handleGenerate">
        Gerar gráfico de elevação
      </button>

      <ul class="elevation-input__hints">
        <li><strong>Como fazer:</strong> Abra seu arquivo de pontos no QGIS ou Excel</li>
        <li>Certifique-se de que as coordenadas estão em <strong>UTM (metros)</strong>, não em graus</li>
        <li>Selecione as 4 colunas na ordem correta (Distância, Lat, Long, Elevação)</li>
        <li>Copie (Ctrl+C) e cole (Ctrl+V) diretamente na área de texto acima</li>
        <li>Clique em "Gerar gráfico de elevação"</li>
      </ul>

      <ul v-if="errors.length" class="elevation-input__errors">
        <li v-for="(error, index) in errors" :key="index">
          {{ error }}
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.elevation-input {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.elevation-input__header h1 {
  margin: 0 0 0.5rem;
  font-size: 1.8rem;
}

.elevation-input__header p {
  margin: 0;
  color: #94a3b8;
  font-size: 0.95rem;
}

.elevation-input__body {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

/* Caixa de informações destacada */
.elevation-input__info-box {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 2px solid #3b82f6;
  border-radius: 0.75rem;
  padding: 1.25rem;
}

.elevation-input__info-box-title {
  margin: 0 0 1rem;
  font-size: 1rem;
  color: #38bdf8;
  font-weight: 700;
}

.elevation-input__format-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.elevation-input__column-info {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.elevation-input__column-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: #3b82f6;
  color: white;
  border-radius: 50%;
  font-weight: 700;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.elevation-input__column-info strong {
  display: block;
  color: #e2e8f0;
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.elevation-input__column-info p {
  margin: 0;
  color: #cbd5e1;
  font-size: 0.8rem;
  line-height: 1.4;
}

/* Caixa de aviso */
.elevation-input__warning-box {
  background: linear-gradient(135deg, #7c2d12 0%, #5a1f0a 100%);
  border: 2px solid #fbbf24;
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
  color: #fed7aa;
  font-size: 0.9rem;
  line-height: 1.5;
}

.elevation-input__warning-box strong {
  color: #fcd34d;
}

/* Label e textarea */
.elevation-input__label {
  font-weight: 600;
  color: #e2e8f0;
  font-size: 0.95rem;
}

.elevation-input__textarea {
  width: 100%;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', 'Courier New', monospace;
  font-size: 0.85rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #334155;
  background-color: #0f172a;
  color: #e5e7eb;
  resize: vertical;
  line-height: 1.6;
}

.elevation-input__textarea:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
  border-color: #3b82f6;
}

.elevation-input__button {
  align-self: flex-start;
  padding: 0.6rem 1.4rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(90deg, #2563eb, #22c55e);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.4);
  transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;
}

.elevation-input__button:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.6);
  filter: brightness(1.05);
}

.elevation-input__button:active {
  transform: translateY(0);
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.5);
}

/* Lista de dicas */
.elevation-input__hints {
  margin: 0;
  padding-left: 1.5rem;
  color: #94a3b8;
  font-size: 0.85rem;
  line-height: 1.8;
  background: rgba(30, 41, 59, 0.5);
  border-left: 3px solid #22c55e;
  padding: 0.75rem 0.75rem 0.75rem 1.25rem;
  border-radius: 0.25rem;
  list-style: disc;
}

.elevation-input__hints li {
  margin-bottom: 0.4rem;
}

.elevation-input__hints strong {
  color: #e2e8f0;
}

/* Erros */
.elevation-input__errors {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
  color: #fca5a5;
  font-size: 0.9rem;
  background: rgba(127, 29, 29, 0.3);
  border-left: 3px solid #ef4444;
  padding: 0.75rem 0.75rem 0.75rem 1.25rem;
  border-radius: 0.25rem;
  list-style: disc;
}

.elevation-input__errors li {
  margin-bottom: 0.3rem;
}

@media (max-width: 640px) {
  .elevation-input__format-columns {
    grid-template-columns: 1fr;
  }

  .elevation-input {
    padding: 1.5rem 1rem;
  }
}
</style>
