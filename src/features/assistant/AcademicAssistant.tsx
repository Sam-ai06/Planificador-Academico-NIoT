import { useState, type FormEvent } from 'react'
import { useAcademic } from '../../app/providers/AcademicProvider'
import { PageTitle, Notice } from '../../components/ui/Shared'
import { academicService, isDemo } from '../../services/academicService'

export function AcademicAssistant() {
  const { state, curriculum } = useAcademic()
  const [messages, setMessages] = useState<{role:string;text:string}[]>([])
  const [input, setInput] = useState('')
  const [context, setContext] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return
    const question = input
    setMessages(m => [...m, {role:'Tú', text:question}])
    setLoading(true)
    setError('')
    try {
      const text = await academicService.explain(question, context ? {curriculum, profile:state.profile, plan:state.plan} : undefined)
      setMessages(m => [...m, {role:isDemo ? 'Asistente · demostración' : 'Asistente académico', text}])
      setInput('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return <>
    <PageTitle eyebrow="COMPRENDE TUS DECISIONES" title="Asistente académico" description="Una explicación clara para cada paso de tu camino."/>
    <Notice>{isDemo ? 'Modo demostración · Respuestas simuladas. La conexión con Gemma se realizará desde el backend.' : 'Servicio académico conectado al backend.'}</Notice>
    <section className="panel chat">
      <div className="chat-messages" aria-live="polite" aria-busy={loading}>
        {!messages.length && <div className="empty">
          <span className="assistant-symbol">✦</span>
          <h2>Hablemos de tu futuro</h2>
          <p>Pregunta por tus materias, tus intereses o los motivos de una recomendación.</p>
          {['¿Por qué me recomiendas estas materias?', '¿Qué pasa si repruebo Bases de datos?', '¿Cómo orientar mi carrera hacia ciencia de datos?'].map(q => <button key={q} onClick={() => setInput(q)}>{q}</button>)}
        </div>}
        {messages.map((m,i) => <article className={`message ${m.role==='Tú'?'user':''}`} key={i}>
          <strong>{m.role}</strong><p>{m.text}</p>
        </article>)}
        {loading && <p role="status">Preparando explicación…</p>}
        {error && <p role="alert" className="error">{error} Puedes enviar tu pregunta de nuevo.</p>}
      </div>
      <form onSubmit={send}>
        <label className="check"><input type="checkbox" checked={context} disabled={loading} onChange={e=>setContext(e.target.checked)}/>Incluir contexto de mi perfil y plan</label>
        <label>Tu pregunta<textarea value={input} disabled={loading} maxLength={2000} onChange={e=>setInput(e.target.value)} placeholder="¿Qué materias debería priorizar?" required/></label>
        <button className="primary" disabled={loading||!input.trim()}>Enviar pregunta ↗</button>
      </form>
    </section>
  </>
}
