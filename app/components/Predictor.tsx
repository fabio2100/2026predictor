'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

type MatchStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'POSTPONED'
  | 'SUSPENDED'
  | 'CANCELLED'

type MatchWinner = 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null

type Prediction = 'HOME' | 'DRAW' | 'AWAY'

interface Team {
  id: number
  name: string
  shortName: string
  tla: string
  crest: string
}

interface Match {
  id: number
  utcDate: string
  status: MatchStatus
  stage: string
  group: string | null
  homeTeam: Team
  awayTeam: Team
  score: {
    winner: MatchWinner
    fullTime: { home: number | null; away: number | null }
    halfTime: { home: number | null; away: number | null }
    penalties: { home: number | null; away: number | null } | null
  }
}

const STORAGE_KEY = 'wc2026_predictions'
const REFRESH_INTERVAL = 60_000 // 60 seconds

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Programado',
  TIMED: 'Programado',
  IN_PLAY: 'En juego',
  PAUSED: 'Entretiempo',
  FINISHED: 'Finalizado',
  POSTPONED: 'Postergado',
  SUSPENDED: 'Suspendido',
  CANCELLED: 'Cancelado',
}

const STAGE_LABEL: Record<string, string> = {
  GROUP_STAGE: 'Fase de Grupos',
  LAST_32: 'Ronda de 32',
  LAST_16: 'Octavos de Final',
  QUARTER_FINALS: 'Cuartos de Final',
  SEMI_FINALS: 'Semifinales',
  THIRD_PLACE: 'Tercer Puesto',
  FINAL: 'Final',
}

const STAGE_ORDER = [
  'GROUP_STAGE',
  'LAST_32',
  'LAST_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'THIRD_PLACE',
  'FINAL',
]

// Rondas eliminatorias: no hay empate real; si hay penales cuenta como DRAW
const KNOCKOUT_STAGES = new Set([
  'LAST_32',
  'LAST_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'THIRD_PLACE',
  'FINAL',
])

function isKnockoutStage(stage: string): boolean {
  return KNOCKOUT_STAGES.has(stage)
}

function isEditable(status: MatchStatus): boolean {
  return status === 'SCHEDULED' || status === 'TIMED'
}

function wentToPenalties(match: Match): boolean {
  return (
    match.score.penalties !== null &&
    match.score.penalties !== undefined &&
    match.score.penalties.home !== null
  )
}

function getActualResult(match: Match): Prediction | null {
  if (match.status !== 'FINISHED') return null
  // En eliminatorias, si hubo penales → DRAW (aunque la API dé un ganador)
  if (isKnockoutStage(match.stage) && wentToPenalties(match)) return 'DRAW'
  if (match.score.winner === 'HOME_TEAM') return 'HOME'
  if (match.score.winner === 'AWAY_TEAM') return 'AWAY'
  if (match.score.winner === 'DRAW') return 'DRAW'
  return null
}

// ─── Match Card ────────────────────────────────────────────────────────────────

interface MatchCardProps {
  match: Match
  prediction: Prediction | undefined
  savedPrediction: Prediction | undefined
  onPredict: (matchId: number, prediction: Prediction) => void
  ref?: React.RefObject<HTMLDivElement | null>
  isFirstNonFinished?: boolean
}

function MatchCard({ match, prediction, savedPrediction, onPredict, ref, isFirstNonFinished }: MatchCardProps) {
  const editable = isEditable(match.status)
  const result = getActualResult(match)
  const knockout = isKnockoutStage(match.stage)
  const hadPenalties = wentToPenalties(match)

  const isCorrect =
    match.status === 'FINISHED' &&
    savedPrediction !== undefined &&
    result === savedPrediction

  const isWrong =
    match.status === 'FINISHED' &&
    savedPrediction !== undefined &&
    result !== savedPrediction

  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED'

  const date = new Date(match.utcDate)
  const dateStr = date.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const timeStr = date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const showScore =
    (match.status === 'FINISHED' || isLive) &&
    match.score.fullTime.home !== null

  const cardBorder = isCorrect
    ? 'border-emerald-300 dark:border-emerald-700'
    : isWrong
    ? 'border-red-300 dark:border-red-700'
    : 'border-zinc-200 dark:border-zinc-700'

  const cardBg = isCorrect
    ? 'bg-emerald-50 dark:bg-emerald-950/40'
    : isWrong
    ? 'bg-red-50 dark:bg-red-950/40'
    : 'bg-white dark:bg-zinc-900'

  return (
    <div ref={ref} className={`rounded-xl border ${cardBorder} ${cardBg} p-4 transition-colors ${isFirstNonFinished ? 'scroll-mt-64' : ''}`}>
      {/* Header row */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            match.status === 'FINISHED'
              ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
              : isLive
              ? 'bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300 animate-pulse'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
          }`}
        >
          {STATUS_LABEL[match.status] ?? match.status}
        </span>
        {match.group && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {match.group}
          </span>
        )}
        <span className="text-xs text-zinc-400 ml-auto">
          {dateStr} · {timeStr}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Teams + score */}
        <div className="flex-1 flex items-center gap-3">
          {/* Home */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            <span className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 text-right leading-tight">
              {match.homeTeam.shortName || match.homeTeam.name}
            </span>
            {match.homeTeam.crest && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={match.homeTeam.crest}
                alt={match.homeTeam.name}
                className="h-7 w-7 object-contain flex-shrink-0"
              />
            )}
          </div>

          {/* Score / VS */}
          <div className="text-center min-w-[56px] flex-shrink-0">
            {showScore ? (
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {match.score.fullTime.home}&nbsp;–&nbsp;{match.score.fullTime.away}
                </span>
                {hadPenalties && match.score.penalties && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                    pen.&nbsp;{match.score.penalties.home}–{match.score.penalties.away}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-zinc-400 font-medium">vs</span>
            )}
          </div>

          {/* Away */}
          <div className="flex items-center gap-2 flex-1">
            {match.awayTeam.crest && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={match.awayTeam.crest}
                alt={match.awayTeam.name}
                className="h-7 w-7 object-contain flex-shrink-0"
              />
            )}
            <span className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 leading-tight">
              {match.awayTeam.shortName || match.awayTeam.name}
            </span>
          </div>
        </div>

        {/* Prediction buttons */}
        <div className="flex gap-2 sm:flex-col sm:gap-1.5 sm:min-w-[108px]">
          {knockout && editable && (
            <p className="text-[10px] text-zinc-400 text-center sm:text-left">
              Eliminatoria · &quot;Penales&quot; = empate al 90&prime;
            </p>
          )}
          {(['HOME', 'DRAW', 'AWAY'] as Prediction[]).map((opt) => {
            const label =
              opt === 'HOME'
                ? 'Local'
                : opt === 'AWAY'
                ? 'Visitante'
                : knockout
                ? 'Penales'
                : 'Empate'
            const isSelected = prediction === opt

            let btnClass =
              'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 text-center flex-1 sm:flex-none '

            if (!editable) {
              btnClass += 'cursor-not-allowed '
              if (isSelected && result === opt) {
                btnClass += 'bg-emerald-500 border-emerald-500 text-white '
              } else if (isSelected && result !== opt) {
                btnClass += 'bg-red-400 border-red-400 text-white '
              } else if (result === opt && match.status === 'FINISHED') {
                btnClass +=
                  'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900/40 dark:border-emerald-600 dark:text-emerald-300 opacity-70 '
              } else {
                btnClass +=
                  'bg-transparent border-zinc-200 dark:border-zinc-700 text-zinc-400 opacity-50 '
              }
            } else {
              if (isSelected) {
                btnClass +=
                  'bg-zinc-900 border-zinc-900 text-white dark:bg-white dark:border-white dark:text-zinc-900 '
              } else {
                btnClass +=
                  'bg-transparent border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 '
              }
            }

            return (
              <label key={opt} className={btnClass}>
                <input
                  type="radio"
                  name={`match-${match.id}`}
                  value={opt}
                  checked={isSelected}
                  disabled={!editable}
                  onChange={() => onPredict(match.id, opt)}
                  className="sr-only"
                />
                {label}
              </label>
            )
          })}
        </div>
      </div>

      {/* Result feedback */}
      {isCorrect && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-2 text-center">
          ✓ +1 punto
        </p>
      )}
      {isWrong && (
        <p className="text-xs text-red-500 font-semibold mt-2 text-center">
          ✗ Sin puntos
        </p>
      )}
    </div>
  )
}

// ─── Main Predictor Component ──────────────────────────────────────────────────

export default function Predictor() {
  const [matches, setMatches] = useState<Match[]>([])
  const [predictions, setPredictions] = useState<Record<number, Prediction>>({})
  const [savedPredictions, setSavedPredictions] = useState<Record<number, Prediction>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch('/api/matches')
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setMatches(data.matches ?? [])
        setLastUpdated(new Date())
        setError(null)
      }
    } catch {
      setError('No se pudo cargar la lista de partidos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Load saved predictions from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Record<number, Prediction>
        setPredictions(parsed)
        setSavedPredictions(parsed)
      }
    } catch {
      // Ignore parse errors
    }

    fetchMatches()
  }, [fetchMatches])

  // Auto-refresh while there are live matches
  useEffect(() => {
    const hasLive = matches.some(
      (m) => m.status === 'IN_PLAY' || m.status === 'PAUSED'
    )
    if (!hasLive) return

    const interval = setInterval(fetchMatches, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [matches, fetchMatches])

  const handlePrediction = (matchId: number, prediction: Prediction) => {
    setPredictions((prev) => {
      const updated = { ...prev, [matchId]: prediction }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      setSavedPredictions(updated)
      return updated
    })
  }

  // ── Ref for first non-finished match ────────────────────────────────────────
  const firstNonFinishedRef = useRef<HTMLDivElement>(null)

  // Scroll to first non-finished match when matches load
  useEffect(() => {
    if (firstNonFinishedRef.current && !loading) {
      setTimeout(() => {
        firstNonFinishedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [loading])

  // ── Points calculation ──────────────────────────────────────────────────────
  const finishedMatches = matches.filter((m) => m.status === 'FINISHED')
  const predictedFinished = finishedMatches.filter(
    (m) => savedPredictions[m.id] !== undefined
  )
  const points = predictedFinished.reduce((acc, match) => {
    const result = getActualResult(match)
    return result && result === savedPredictions[match.id] ? acc + 1 : acc
  }, 0)

  const totalPredictions = Object.keys(predictions).length

  // ── Group matches by stage ──────────────────────────────────────────────────
  const groupedByStage = matches.reduce<Record<string, Match[]>>((acc, match) => {
    const key = match.stage
    if (!acc[key]) acc[key] = []
    acc[key].push(match)
    return acc
  }, {})

  const firstNonFinishedMatchId = matches.find((m) => m.status !== 'FINISHED')?.id
  // ── Score board background color ───────────────────────────────────────────
  const misses = predictedFinished.length - points
  let scoreBoardBg = 'from-emerald-500 to-teal-700'
  if (predictedFinished.length > 0) {
    if (points === misses) {
      scoreBoardBg = 'from-amber-400 to-amber-600'
    } else if (misses > points) {
      scoreBoardBg = 'from-rose-500 to-red-700'
    }
  }


  // ── Main render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="h-10 w-10 rounded-full border-4 border-zinc-300 border-t-zinc-700 animate-spin" />
        <p className="text-zinc-500 text-sm">Cargando partidos del Mundial 2026…</p>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    const isKeyError = error.toLowerCase().includes('api key') || error.toLowerCase().includes('clave')
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-6 text-center">
        <p className="font-semibold text-red-800 dark:text-red-300 mb-2">
          No se pudieron cargar los partidos
        </p>
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>
        {isKeyError && (
          <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
            <p>
              1. Registrate gratis en{' '}
              <a
                href="https://www.football-data.org/client/register"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 underline"
              >
                football-data.org
              </a>
            </p>
            <p>
              2. Copiá tu clave en <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">.env.local</code>
            </p>
            <p>
              3. Reiniciá el servidor con{' '}
              <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">npm run dev</code>
            </p>
          </div>
        )}
        <button
          onClick={fetchMatches}
          className="mt-4 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    )
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (matches.length === 0) {
    return (
      <p className="text-center text-zinc-500 py-16">
        No se encontraron partidos para el Mundial 2026.
      </p>
    )
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Score board */}
      <div className={`sticky top-2 z-50 mb-6 rounded-2xl bg-gradient-to-br ${scoreBoardBg} p-6 text-white text-center shadow-lg`}>
        <p className="text-xs font-semibold uppercase tracking-widest opacity-75 mb-1">
          Tu puntaje
        </p>
        <p className="text-6xl font-black tabular-nums leading-none">
          {predictedFinished.length > 0 ? `${points} - ${predictedFinished.length - points}` : '0 - 0'}
        </p>
        <p className="text-2xl opacity-80 mt-2">
          {predictedFinished.length > 0
            ? `${((points / predictedFinished.length)).toFixed(3)}`
            : 'Los partidos finalizados mostrarán tus puntos aquí'}
        </p>
        <div className="mt-4">
          <div className="bg-white/20 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-white h-full transition-all duration-300"
              style={{ width: `${(finishedMatches.length / 104) * 100}%` }}
            />
          </div>
          <p className="text-sm font-semibold mt-2 opacity-90">
            {finishedMatches.length}/104 partidos finalizados ({((finishedMatches.length / 104) * 100).toFixed(1)}%)
          </p>
        </div>
      </div>

      {/* Actions bar */}
      <div className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        {totalPredictions > 0 ? (
          <span>
            {totalPredictions} pronóstico{totalPredictions !== 1 ? 's' : ''} registrado{totalPredictions !== 1 ? 's' : ''}
          </span>
        ) : (
          <span>Seleccioná tus pronósticos</span>
        )}
        {lastUpdated && (
          <span className="ml-2 text-zinc-400 dark:text-zinc-600 text-xs">
            · Actualizado{' '}
            {lastUpdated.toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>

      {/* Matches */}
      <div className="space-y-10">
        {STAGE_ORDER.filter((stage) => groupedByStage[stage]?.length).map(
          (stage) => (
            <section key={stage}>
              <h2 className="text-base font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-700">
                {STAGE_LABEL[stage] ?? stage}
              </h2>
              <div className="space-y-3">
                {groupedByStage[stage].map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    prediction={predictions[match.id]}
                    savedPrediction={savedPredictions[match.id]}
                    onPredict={handlePrediction}
                    ref={match.id === firstNonFinishedMatchId ? firstNonFinishedRef : undefined}
                    isFirstNonFinished={match.id === firstNonFinishedMatchId}
                  />
                ))}
              </div>
            </section>
          )
        )}

        {/* Unknown stages */}
        {Object.keys(groupedByStage)
          .filter((s) => !STAGE_ORDER.includes(s))
          .map((stage) => (
            <section key={stage}>
              <h2 className="text-base font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-700">
                {STAGE_LABEL[stage] ?? stage}
              </h2>
              <div className="space-y-3">
                {groupedByStage[stage].map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    prediction={predictions[match.id]}
                    savedPrediction={savedPredictions[match.id]}
                    onPredict={handlePrediction}
                    ref={match.id === firstNonFinishedMatchId ? firstNonFinishedRef : undefined}
                    isFirstNonFinished={match.id === firstNonFinishedMatchId}
                  />
                ))}
              </div>
            </section>
          ))}
      </div>
    </div>
  )
}
