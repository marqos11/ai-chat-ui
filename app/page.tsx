'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

interface Settings {
  baseUrl: string
  apiKey: string
  model: string
  systemPrompt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'chatui-settings'

const DEFAULT_SETTINGS: Settings = {
  baseUrl: '',
  apiKey: '',
  model: '',
  systemPrompt:
    'You are a helpful assistant with access to a web_search tool. Use it whenever you need current or factual information.',
}

const WEB_SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Search the web using DuckDuckGo. Use this for current events, recent news, facts, or anything you are unsure about.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' },
        max_results: {
          type: 'number',
          description: 'Max results to return (default 5)',
        },
      },
      required: ['query'],
    },
  },
}

// ─── Icons (inline SVG) ───────────────────────────────────────────────────────

const IconGear = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const IconTrash = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6" />
    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
)

const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const IconEyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

const IconRefresh = ({ spinning }: { spinning?: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={spinning ? 'animate-spin' : ''}
  >
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-.28-4.78" />
  </svg>
)

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [tempSettings, setTempSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [searchStatus, setSearchStatus] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const settingsRef = useRef(settings)

  useEffect(() => { settingsRef.current = settings }, [settings])

  // Load settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Settings
        setSettings(parsed)
        setTempSettings(parsed)
      }
    } catch {}
  }, [])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText, searchStatus])

  // Auto-resize textarea
  const resizeTextarea = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
  }, [])

  // ─── Settings ──────────────────────────────────────────────────────────────

  const openSettings = () => {
    setTempSettings(settings)
    setModels([])
    setShowApiKey(false)
    setSettingsOpen(true)
  }

  const saveSettings = () => {
    setSettings(tempSettings)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tempSettings))
    setSettingsOpen(false)
  }

  const fetchModels = async () => {
    if (!tempSettings.baseUrl || !tempSettings.apiKey) return
    setFetchingModels(true)
    setModels([])
    try {
      const res = await fetch(`${tempSettings.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${tempSettings.apiKey}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const list: string[] = (data.data ?? []).map((m: { id: string }) => m.id).sort()
      setModels(list)
      if (list.length > 0 && !list.includes(tempSettings.model)) {
        setTempSettings(s => ({ ...s, model: list[0] }))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      alert(`Failed to fetch models: ${msg}`)
    }
    setFetchingModels(false)
  }

  // ─── Chat Logic ────────────────────────────────────────────────────────────

  const executeSearch = async (query: string, maxResults = 5) => {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&max=${maxResults}`)
    if (!res.ok) return [{ error: 'Search request failed' }]
    return await res.json()
  }

  const callLLM = async (
    msgs: Message[],
    onToken: (partial: string) => void
  ): Promise<{ content: string | null; tool_calls: ToolCall[] | null }> => {
    const s = settingsRef.current
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: s.baseUrl,
        apiKey: s.apiKey,
        model: s.model,
        messages: msgs,
        tools: [WEB_SEARCH_TOOL],
        tool_choice: 'auto',
        stream: true,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`API ${res.status}: ${errText.slice(0, 300)}`)
    }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let content = ''
    const tcMap: Record<number, ToolCall> = {}

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (raw === '[DONE]') continue
        let chunk: { choices?: { delta?: { content?: string; tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] }; finish_reason?: string }[] }
        try { chunk = JSON.parse(raw) } catch { continue }
        const delta = chunk.choices?.[0]?.delta
        if (!delta) continue

        if (delta.content) {
          content += delta.content
          onToken(content)
        }
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0
            if (!tcMap[idx]) tcMap[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } }
            if (tc.id) tcMap[idx].id += tc.id
            if (tc.function?.name) tcMap[idx].function.name += tc.function.name
            if (tc.function?.arguments) tcMap[idx].function.arguments += tc.function.arguments
          }
        }
      }
    }

    const assembled = Object.values(tcMap)
    return {
      content: content || null,
      tool_calls: assembled.length ? assembled : null,
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading) return
    if (!settings.baseUrl || !settings.model) {
      setErrorMsg('Open settings and configure your Base URL and Model first.')
      return
    }

    setInput('')
    setErrorMsg(null)
    setIsLoading(true)
    if (inputRef.current) inputRef.current.style.height = 'auto'

    const userMsg: Message = { role: 'user', content: text }
    let currentMsgs: Message[] = [...messages, userMsg]
    setMessages(currentMsgs)

    try {
      while (true) {
        const llmMsgs: Message[] = [
          ...(settings.systemPrompt
            ? [{ role: 'system' as const, content: settings.systemPrompt }]
            : []),
          ...currentMsgs,
        ]

        const result = await callLLM(llmMsgs, partial => setStreamingText(partial))
        setStreamingText('')

        if (result.tool_calls?.length) {
          const assistantMsg: Message = {
            role: 'assistant',
            content: result.content,
            tool_calls: result.tool_calls,
          }
          currentMsgs = [...currentMsgs, assistantMsg]
          setMessages(currentMsgs)

          for (const tc of result.tool_calls) {
            let args: { query?: string; max_results?: number } = {}
            try { args = JSON.parse(tc.function.arguments || '{}') } catch {}
            setSearchStatus(`Searching: "${args.query ?? '...'}"`)

            const results = await executeSearch(args.query ?? '', args.max_results ?? 5)
            setSearchStatus(null)

            const toolMsg: Message = {
              role: 'tool',
              tool_call_id: tc.id,
              name: 'web_search',
              content: JSON.stringify(results),
            }
            currentMsgs = [...currentMsgs, toolMsg]
            setMessages(currentMsgs)
          }
          continue
        }

        const finalMsg: Message = { role: 'assistant', content: result.content ?? '' }
        currentMsgs = [...currentMsgs, finalMsg]
        setMessages(currentMsgs)
        break
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(msg)
    }

    setIsLoading(false)
    setStreamingText('')
    setSearchStatus(null)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const isConfigured = !!(settings.baseUrl && settings.model)

  return (
    <div className="flex flex-col h-dvh bg-gray-950">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base font-semibold text-gray-100">Chat</span>
          {settings.model && (
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full truncate max-w-[140px]">
              {settings.model}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="p-2 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
              title="Clear chat"
            >
              <IconTrash />
            </button>
          )}
          <button
            onClick={openSettings}
            className="p-2 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-800 transition-colors"
            title="Settings"
          >
            <IconGear />
          </button>
        </div>
      </header>

      {/* ── Messages ── */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && !streamingText && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="text-5xl select-none">💬</div>
            <p className="text-sm text-gray-600">
              {isConfigured ? 'Start a conversation' : 'Configure your API to get started'}
            </p>
            {!isConfigured && (
              <button onClick={openSettings} className="text-sm text-blue-400 hover:text-blue-300 underline">
                Open Settings
              </button>
            )}
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === 'tool' || msg.role === 'system') return null

          if (msg.role === 'user') {
            return (
              <div key={i} className="flex justify-end py-1">
                <div className="max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {msg.content}
                </div>
              </div>
            )
          }

          // assistant
          return (
            <div key={i} className="flex justify-start py-1">
              <div className="max-w-[88%] space-y-2">
                {msg.tool_calls?.map((tc, j) => {
                  let args: { query?: string } = {}
                  try { args = JSON.parse(tc.function.arguments || '{}') } catch {}
                  return (
                    <div key={j} className="flex items-center gap-1.5 text-xs text-amber-400/80 bg-amber-950/30 border border-amber-900/40 rounded-full px-3 py-1 w-fit">
                      <span>🔍</span>
                      <span className="truncate max-w-[220px]">Searched: &ldquo;{args.query}&rdquo;</span>
                    </div>
                  )
                })}
                {msg.content && (
                  <div className="bg-gray-800 text-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 text-sm">
                    <div className="prose prose-invert prose-sm max-w-none chat-prose">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Streaming bubble */}
        {streamingText && (
          <div className="flex justify-start py-1">
            <div className="max-w-[88%] bg-gray-800 text-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 text-sm">
              <div className="prose prose-invert prose-sm max-w-none chat-prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {/* Search status */}
        {searchStatus && (
          <div className="flex justify-start py-1">
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950/30 border border-amber-900/40 rounded-full px-3 py-1.5 animate-pulse">
              <span>🔍</span>
              <span>{searchStatus}</span>
            </div>
          </div>
        )}

        {/* Thinking dots */}
        {isLoading && !streamingText && !searchStatus && (
          <div className="flex justify-start py-1">
            <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3.5">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="flex justify-start py-1">
            <div className="max-w-[88%] text-xs text-red-400 bg-red-950/40 border border-red-900/40 rounded-xl px-4 py-2.5">
              {errorMsg}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* ── Input ── */}
      <div className="shrink-0 px-3 py-3 bg-gray-900 border-t border-gray-800">
        <div className="flex items-end gap-2 bg-gray-800 border border-gray-700 rounded-2xl px-4 py-2 focus-within:border-gray-600 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              resizeTextarea(e.target)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-600 resize-none outline-none py-1.5 leading-relaxed"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="shrink-0 mb-0.5 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-600 text-white rounded-xl transition-colors"
          >
            <IconSend />
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-700 mt-1.5">
          Enter to send &middot; Shift+Enter for new line
        </p>
      </div>

      {/* ── Settings Modal ── */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSettingsOpen(false)}
          />
          {/* Panel */}
          <div className="relative w-full sm:max-w-md bg-gray-900 rounded-t-2xl sm:rounded-2xl border border-gray-800 max-h-[92dvh] flex flex-col shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
              <h2 className="text-sm font-semibold text-gray-100">Settings</h2>
              <button
                onClick={() => setSettingsOpen(false)}
                className="p-1.5 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <IconX />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">

              {/* Base URL */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Base URL</label>
                <input
                  type="url"
                  value={tempSettings.baseUrl}
                  onChange={e => setTempSettings(s => ({ ...s, baseUrl: e.target.value.trim() }))}
                  placeholder="https://api.openai.com/v1"
                  className="w-full bg-gray-800 text-sm text-gray-100 placeholder-gray-600 border border-gray-700 rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">API Key</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={tempSettings.apiKey}
                    onChange={e => setTempSettings(s => ({ ...s, apiKey: e.target.value.trim() }))}
                    placeholder="sk-..."
                    className="w-full bg-gray-800 text-sm text-gray-100 placeholder-gray-600 border border-gray-700 rounded-xl px-3 py-2.5 pr-10 outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showApiKey ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </div>

              {/* Model */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Model</label>
                <div className="flex gap-2">
                  {models.length > 0 ? (
                    <select
                      value={tempSettings.model}
                      onChange={e => setTempSettings(s => ({ ...s, model: e.target.value }))}
                      className="flex-1 bg-gray-800 text-sm text-gray-100 border border-gray-700 rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 transition-colors"
                    >
                      {models.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={tempSettings.model}
                      onChange={e => setTempSettings(s => ({ ...s, model: e.target.value.trim() }))}
                      placeholder="gpt-4o-mini"
                      className="flex-1 bg-gray-800 text-sm text-gray-100 placeholder-gray-600 border border-gray-700 rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 transition-colors"
                    />
                  )}
                  <button
                    onClick={fetchModels}
                    disabled={fetchingModels || !tempSettings.baseUrl || !tempSettings.apiKey}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 border border-gray-700 rounded-xl text-xs font-medium transition-colors"
                    title="Fetch models from endpoint"
                  >
                    <IconRefresh spinning={fetchingModels} />
                    Fetch
                  </button>
                </div>
                {models.length > 0 && (
                  <p className="text-xs text-gray-600 mt-1.5">{models.length} models loaded</p>
                )}
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">System Prompt</label>
                <textarea
                  value={tempSettings.systemPrompt}
                  onChange={e => setTempSettings(s => ({ ...s, systemPrompt: e.target.value }))}
                  placeholder="You are a helpful assistant..."
                  rows={4}
                  className="w-full bg-gray-800 text-sm text-gray-100 placeholder-gray-600 border border-gray-700 rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 transition-colors resize-none leading-relaxed"
                />
              </div>

            </div>

            {/* Modal footer */}
            <div className="shrink-0 px-5 py-4 border-t border-gray-800">
              <button
                onClick={saveSettings}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
