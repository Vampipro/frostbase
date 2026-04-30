'use client'

import { useEffect, useState, Component, ReactNode } from 'react'

// Class component error boundary to get componentStack
class ErrorCatcher extends Component<
  { children: ReactNode; onError: (info: { message: string; stack: string; componentStack: string }) => void },
  {}
> {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError({
      message: error.message || String(error),
      stack: error.stack || '',
      componentStack: errorInfo.componentStack || '',
    })
  }

  render() {
    return this.props.children
  }
}

export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [details, setDetails] = useState({ message: '', stack: '', componentStack: '' })

  useEffect(() => {
    setDetails({
      message: error.message || String(error),
      stack: error.stack || '',
      componentStack: '',
    })
    console.error('Panel error:', error)
  }, [error])

  return (
    <ErrorCatcher
      onError={(info) => {
        console.error('Panel component error:', info)
        setDetails(info)
      }}
    >
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] p-4">
        <div className="glass rounded-2xl p-6 border border-red-500/20 max-w-2xl w-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center text-xl">
              ⚠️
            </div>
            <div>
              <h2 className="font-mono font-bold text-red-400">Ошибка загрузки панели</h2>
              <p className="text-xs font-mono text-red-600/60">Panel runtime error</p>
            </div>
          </div>

          <div className="bg-black/40 rounded-xl p-4 mb-4 border border-red-500/10 overflow-auto max-h-60">
            <p className="text-xs font-mono text-red-300 break-all whitespace-pre-wrap">{details.message}</p>
            {details.componentStack && (
              <pre className="text-[10px] font-mono text-red-400/70 mt-2 whitespace-pre-wrap">{details.componentStack}</pre>
            )}
            {details.stack && (
              <pre className="text-[10px] font-mono text-red-400/50 mt-2 whitespace-pre-wrap">{details.stack}</pre>
            )}
          </div>

          {error.digest && (
            <p className="text-xs font-mono text-green-700 mb-4">Digest: {error.digest}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex-1 py-2.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 font-mono text-sm border border-green-500/20 transition-colors"
            >
              Попробовать снова
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="flex-1 py-2.5 rounded-lg bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 font-mono text-sm border border-gray-500/20 transition-colors"
            >
              На главную
            </button>
          </div>
        </div>
      </div>
    </ErrorCatcher>
  )
}
