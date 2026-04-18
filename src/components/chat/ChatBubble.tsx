import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Bot, User, Sparkles } from 'lucide-react'
import { findAnswer, SUGGESTIONS, type FAQItem } from './faqData'

interface Message {
  id:   string
  role: 'user' | 'bot'
  text: string
}

const FALLBACK = `죄송해요, 해당 질문에 대한 답변을 찾지 못했어요. 😅

아래 질문들을 참고해보시거나, [이용매뉴얼] 메뉴에서 자세한 설명을 확인해주세요.`

function BotMessage({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="shrink-0 w-7 h-7 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center mt-0.5">
        <Bot size={13} className="text-primary-400" />
      </div>
      <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-dark-hover border border-dark-border text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
        {text}
      </div>
    </div>
  )
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 justify-end">
      <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-primary-500/20 border border-primary-500/30 text-xs text-primary-200 leading-relaxed">
        {text}
      </div>
      <div className="shrink-0 w-7 h-7 rounded-full bg-dark-hover border border-dark-border flex items-center justify-center mt-0.5">
        <User size={13} className="text-slate-400" />
      </div>
    </div>
  )
}

export function ChatBubble() {
  const [open,     setOpen]     = useState(false)
  const [input,    setInput]    = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      id:   'welcome',
      role: 'bot',
      text: '안녕하세요! 딸기셀 도우미입니다. 🍓\n\n궁금한 점을 물어보세요.\n/ 또는 ? 로 시작해도 됩니다.',
    },
  ])
  const [typing, setTyping] = useState(false)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const addMessage = (role: Message['role'], text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), role, text }])
  }

  const handleSend = async (text?: string) => {
    const q = (text ?? input).trim()
    if (!q) return
    setInput('')
    addMessage('user', q)
    setTyping(true)

    await new Promise(r => setTimeout(r, 400))

    const item: FAQItem | null = findAnswer(q)
    if (item) {
      addMessage('bot', item.answer)
    } else {
      addMessage('bot', FALLBACK)
    }
    setTyping(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <>
      {/* ── 말풍선 버튼 ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-6 right-6 z-50 shadow-xl flex items-center justify-center gap-2 transition-all duration-300
          ${open
            ? 'w-10 h-10 rounded-full bg-dark-card border border-dark-border text-slate-400 hover:text-slate-200 scale-95'
            : 'px-4 h-11 rounded-full bg-primary-500 hover:bg-primary-600 text-white hover:scale-105 shadow-primary-500/30'
          }`}
      >
        {open
          ? <X size={18} />
          : <><MessageCircle size={17} /><span className="text-xs font-semibold whitespace-nowrap">사용법 질문!</span></>
        }
      </button>

      {/* ── 대화창 ── */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 flex flex-col rounded-2xl border border-dark-border bg-dark-bg shadow-2xl shadow-black/40 overflow-hidden animate-fade-in"
          style={{ maxHeight: 480 }}>

          {/* 헤더 */}
          <div className="flex items-center gap-2.5 px-4 py-3 bg-dark-card border-b border-dark-border shrink-0">
            <div className="w-8 h-8 rounded-full bg-primary-500/15 border border-primary-500/30 flex items-center justify-center">
              <Sparkles size={14} className="text-primary-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">딸기셀 도우미</p>
              <p className="text-[10px] text-slate-500">자주 묻는 질문 자동 답변</p>
            </div>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
            {messages.map(m =>
              m.role === 'bot'
                ? <BotMessage key={m.id} text={m.text} />
                : <UserMessage key={m.id} text={m.text} />
            )}

            {typing && (
              <div className="flex items-start gap-2.5">
                <div className="shrink-0 w-7 h-7 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center">
                  <Bot size={13} className="text-primary-400" />
                </div>
                <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-dark-hover border border-dark-border">
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 추천 질문 */}
          {messages.length <= 1 && (
            <div className="px-3 pb-2 shrink-0">
              <p className="text-[10px] text-slate-600 mb-1.5 px-0.5">자주 묻는 질문</p>
              <div className="flex flex-col gap-1">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => handleSend(s)}
                    className="text-left text-[11px] px-3 py-1.5 rounded-xl bg-dark-hover border border-dark-border text-slate-400 hover:text-primary-400 hover:border-primary-500/30 transition-all truncate">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 입력창 */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-t border-dark-border bg-dark-card shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="/ 또는 ? 로 질문하세요..."
              className="flex-1 px-3 py-2 rounded-xl text-xs bg-dark-hover border border-dark-border text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary-500/50 transition-all"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || typing}
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
