import Predictor from './components/Predictor'

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <header className="mb-8 text-center sm:text-left">
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
            ⚽ Mundial 2026
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
            Pronosticá los resultados y seguí tu puntaje
          </p>
        </header>
        <Predictor />
      </main>
    </div>
  )
}
