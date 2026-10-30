import { useState, type ChangeEvent } from 'react'
import { useAcademic, switchCurriculum } from '../../app/providers/AcademicProvider'
import { PageTitle, Notice } from '../../components/ui/Shared'
import { validateCurriculum } from './validation'
import { PdfCurriculumConverter } from './components/PdfCurriculumConverter'
import type { Curriculum } from '../../types/academic'
import { courseWorkload, totalWorkload, workloadLabel } from '../../services/workload'

export function CurriculumManager() {
  const {state,setState}=useAcademic()
  const [preview,setPreview]=useState<Curriculum|null>(null)
  const [errors,setErrors]=useState<string[]>([])
  const [loading,setLoading]=useState(false)

  async function importFile(e:ChangeEvent<HTMLInputElement>) {
    const input=e.currentTarget
    const file=input.files?.[0]
    setPreview(null);setErrors([])
    if(!file)return
    if(file.size>2_000_000){setErrors(['El archivo JSON no puede superar 2 MB.']);input.value='';return}
    setLoading(true)
    try {
      const json:unknown=JSON.parse(await file.text())
      const problems=validateCurriculum(json)
      setErrors(problems)
      if(!problems.length)setPreview(json as Curriculum)
    } catch { setErrors(['No se pudo leer un JSON válido.']) }
    finally {setLoading(false);input.value=''}
  }

  return <>
    <PageTitle eyebrow="UNA PLATAFORMA, MUCHOS CAMINOS" title="Gestión de mallas" description="Importa un JSON o convierte el PDF de tu institución en una malla académica."/>
    <Notice>Al cambiar de malla se reinician el perfil, el plan y los escenarios de trabajo. Exporta los planes que quieras conservar antes de continuar.</Notice>
    <PdfCurriculumConverter onPreview={curriculum=>{setPreview(curriculum);setErrors([])}}/>
    <div className="two-columns">
      <section className="panel">
        <h2>Mallas disponibles</h2>
        <label>Malla actual<select value={state.curriculumId} onChange={e=>{
          const curriculum=state.curriculums.find(c=>c.id===e.target.value)!
          setState(s=>switchCurriculum(s,curriculum))
        }}>{state.curriculums.map(c=><option key={c.id} value={c.id}>{c.name} · {c.institution}</option>)}</select></label>
        <h3>Importar JSON</h3>
        <label className="upload">Selecciona un archivo de hasta 2 MB<input type="file" disabled={loading} accept=".json,application/json" onChange={importFile}/></label>
        {loading&&<p role="status">Validando archivo…</p>}
        {errors.length>0&&<div role="alert" className="error"><h3>No se pudo importar</h3><ul>{errors.map((error,i)=><li key={i}>{error}</li>)}</ul></div>}
        <details><summary>Formato JSON esperado</summary><pre>{JSON.stringify({id:'mi-carrera',name:'Nombre de la carrera',institution:'Mi universidad',courses:[{id:'a',code:'MAT101',name:'Matemática',credits:4,semester:1,prerequisites:[]}]},null,2)}</pre></details>
      </section>
      <section className="panel" aria-live="polite">
        <h2>Vista previa</h2>
        {preview?<>
          <h3>{preview.name}</h3>
          <p>{preview.institution} · {preview.courses.length} materias · {totalWorkload(preview)} {workloadLabel(preview)}</p>
          <ul>{preview.courses.map(c=><li key={c.id}>{c.code} · {c.name} · {c.semester===null?'Sin semestre sugerido':`Semestre ${c.semester}`} · {courseWorkload(c)}</li>)}</ul>
          {state.curriculums.some(c=>c.id===preview.id)
            ?<Notice>Ya existe una malla con ese ID. Usa un identificador distinto para importar otra versión.</Notice>
            :<button className="primary" onClick={()=>{
              const problems=validateCurriculum(preview)
              if(problems.length){setErrors(problems);return}
              setState(s=>({...s,curriculums:[...s.curriculums,preview]}));setPreview(null)
            }}>Añadir malla validada</button>}
        </>:<div className="empty"><p>La vista previa aparecerá al validar un JSON o revisar una conversión de PDF.</p></div>}
      </section>
    </div>
  </>
}
