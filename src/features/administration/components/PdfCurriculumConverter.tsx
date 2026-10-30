import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Notice } from '../../../components/ui/Shared'
import type { Curriculum } from '../../../types/academic'
import { validateCurriculum } from '../validation'
import { convertCurriculumPdf, type PdfConversionResult } from '../services/pdfConverter'
import './pdf-converter.css'
import { PdfRelationReview } from './PdfRelationReview'

export function PdfCurriculumConverter({onPreview}:{onPreview:(curriculum:Curriculum)=>void}) {
  const [metadata,setMetadata]=useState({id:'',name:'',institution:''})
  const [file,setFile]=useState<File|null>(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [result,setResult]=useState<PdfConversionResult|null>(null)
  const [draft,setDraft]=useState('')
  const [reviewed,setReviewed]=useState(false)
  const [decisions,setDecisions]=useState<Record<number,string>>({})
  const controller=useRef<AbortController|null>(null)
  const originalPdf=useRef<HTMLIFrameElement|null>(null)
  useEffect(()=>()=>controller.current?.abort(),[])
  useEffect(()=>{
    if(!file||!result||!originalPdf.current)return
    const url=URL.createObjectURL(file)
    originalPdf.current.src=url
    return ()=>URL.revokeObjectURL(url)
  },[file,result])

  let parsed:unknown
  let problems:string[]=[]
  if(draft) {
    try { parsed=JSON.parse(draft); problems=validateCurriculum(parsed) }
    catch { problems=['El texto editado no es un JSON válido.'] }
  }
  const valid=!!draft&&problems.length===0
  const curriculum=parsed&&typeof parsed==='object'&&'courses' in parsed&&Array.isArray(parsed.courses)&&parsed.courses.every(c=>c&&typeof c.id==='string'&&typeof c.code==='string'&&typeof c.name==='string'&&Array.isArray(c.prerequisites)&&c.prerequisites.every((p:unknown)=>typeof p==='string')&&(c.corequisites===undefined||Array.isArray(c.corequisites)&&c.corequisites.every((p:unknown)=>typeof p==='string')))?parsed as Curriculum:null
  const pendingRelations=(result?.relations||[]).filter((r,i)=>{
    if(r.status!=='unresolved')return false
    const decision=decisions[i]
    if(decision==='__discard__')return false
    const target=curriculum?.courses.find(c=>c.id===r.target)
    return !decision || !(r.type==='corequisite'?target?.corequisites:target?.prerequisites)?.includes(decision)
  }).length
  function decideRelation(index:number,value:string) {
    if(!curriculum||!result?.relations)return
    const relation=result.relations[index]
    const field=relation.type==='corequisite'?'corequisites':'prerequisites'
    const previous=decisions[index]
    const original=(result.curriculum as Curriculum).courses.find(c=>c.id===relation.target)?.[field]||[]
    const shared=Object.entries(decisions).some(([i,source])=>Number(i)!==index&&source===previous&&result.relations?.[Number(i)]?.target===relation.target&&result.relations[Number(i)].type===relation.type)
    const updated={...curriculum,courses:curriculum.courses.map(c=>{
      if(c.id!==relation.target)return c
      const references=(c[field]||[]).filter(id=>id!==previous||shared||original.includes(id))
      if(value&&value!=='__discard__')references.push(value)
      return {...c,[field]:[...new Set(references)]}
    })}
    setDecisions(d=>({...d,[index]:value}));setDraft(JSON.stringify(updated,null,2));setReviewed(false)
  }
  const missingFields=[
    ['identificador de la malla',metadata.id],
    ['nombre de la carrera',metadata.name],
    ['institución',metadata.institution],
  ].filter(([,value])=>!value.trim()).map(([label])=>label)

  async function convert(e:FormEvent) {
    e.preventDefault()
    if(!file||busy) return
    if(missingFields.length){
      setError(`Completa los campos obligatorios: ${missingFields.join(', ')}.`)
      return
    }
    const request=new AbortController()
    controller.current=request
    const timeout=setTimeout(()=>request.abort(),240000)
    setBusy(true);setError('');setResult(null);setDraft('');setReviewed(false);setDecisions({})
    try {
      const converted=await convertCurriculumPdf(file,{id:metadata.id.trim(),name:metadata.name.trim(),institution:metadata.institution.trim()},request.signal)
      setResult(converted);setDraft(JSON.stringify(converted.curriculum,null,2))
    } catch(e) { setError((e as Error).message) }
    finally { clearTimeout(timeout);setBusy(false);controller.current=null }
  }

  function download() {
    if(!valid)return
    const url=URL.createObjectURL(new Blob([JSON.stringify(parsed,null,2)],{type:'application/json'}))
    const link=document.createElement('a');link.href=url;link.download=`${(parsed as Curriculum).id.replace(/[^a-zA-Z0-9_-]/g,'_')||'malla'}.json`;link.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  }

  return <section className="panel pdf-converter" aria-labelledby="pdf-converter-title">
    <h2 id="pdf-converter-title">Convertir malla PDF a JSON</h2>
    <p>Convierte tablas, PDFs escaneados o mallas con recuadros y flechas. Revisa el resultado antes de incorporarlo al planificador.</p>
    <details><summary>¿Qué formatos se pueden convertir?</summary><p>Las tablas necesitan encabezados de código, asignatura y créditos. Para diagramas se utiliza OCR local: se detectan recuadros, códigos, horas, etiquetas de semestre y conectores. Las relaciones ambiguas requieren revisión manual.</p><p>Las horas se conservan como aparecen en el documento y no se convierten a créditos. Los códigos técnicos de actividades sin código oficial se señalan para revisión. Se admiten hasta 5 páginas con OCR por archivo.</p></details>
    <form onSubmit={convert}>
      <fieldset disabled={busy}>
        <div className="pdf-metadata">
          <label>Identificador de la malla (obligatorio)<input required maxLength={200} placeholder="ingenieria-software-2026" value={metadata.id} onChange={e=>{setMetadata(m=>({...m,id:e.target.value}));setError('')}}/></label>
          <label>Nombre de la carrera (obligatorio)<input required maxLength={200} placeholder="Ingeniería de Software" value={metadata.name} onChange={e=>{setMetadata(m=>({...m,name:e.target.value}));setError('')}}/></label>
          <label>Institución (obligatorio)<input required maxLength={200} placeholder="Nombre de la universidad" value={metadata.institution} onChange={e=>{setMetadata(m=>({...m,institution:e.target.value}));setError('')}}/></label>
        </div>
        <label className="upload">Archivo PDF · hasta 10 MB y 50 páginas<input type="file" accept=".pdf,application/pdf" required onChange={e=>{setFile(e.target.files?.[0]||null);setResult(null);setDraft('');setReviewed(false);setError('')}}/></label>
        <p id="pdf-conversion-help" className="muted" aria-live="polite">{!file?'Selecciona un PDF para habilitar la conversión.':missingFields.length?`PDF seleccionado. Para convertir, completa arriba: ${missingFields.join(', ')}.`:'PDF y datos completos. Ya puedes iniciar la conversión.'}</p>
        <button type="submit" className="primary" disabled={!file} aria-describedby="pdf-conversion-help">Convertir PDF a JSON</button>
      </fieldset>
    </form>
    {busy&&<div className="toolbar" role="status"><span>Extrayendo texto, tablas o diagramas con OCR… Puede tardar varios minutos.</span><button onClick={()=>controller.current?.abort()}>Cancelar</button></div>}
    {error&&<p role="alert" className="error">{error}</p>}
    {!result&&!busy&&<p className="muted">La conversión no modifica la malla actual. Podrás revisar y corregir los datos antes de añadirlos.</p>}
    {result&&<div className="pdf-result">
      <h3>Resultado de la conversión · {result.pageCount} páginas</h3>
      <Notice><ul>{result.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul></Notice>
      {result.usedOcr&&<Notice>Se utilizó OCR local. Revisa especialmente códigos, nombres y conexiones. Las horas declaradas no equivalen a créditos.</Notice>}
      {result.usedOcr&&<details><summary>Consultar el PDF original mientras revisas</summary><iframe ref={originalPdf} title="Malla PDF original para revisar materias y flechas" className="pdf-source-preview"/></details>}
      {curriculum&&!!result.relations?.length&&<PdfRelationReview curriculum={curriculum} relations={result.relations} decisions={decisions} onDecision={decideRelation} onChange={updated=>{setDraft(JSON.stringify(updated,null,2));setReviewed(false)}}/>}
      {pendingRelations>0&&<p className="error" role="status">Hay {pendingRelations} flechas ambiguas pendientes de resolver o descartar antes de importar.</p>}
      <label>JSON editable<textarea className="json-editor" spellCheck={false} value={draft} onChange={e=>{setDraft(e.target.value);setReviewed(false)}}/></label>
      {problems.length>0&&<div className="error" role="alert"><strong>Corrige estos datos antes de continuar:</strong><ul>{problems.map((p,i)=><li key={i}>{p}</li>)}</ul></div>}
      {valid&&<p className="conversion-success" role="status">Estructura válida · {(parsed as Curriculum).courses.length} materias. Comprueba también que coincidan con el PDF original.</p>}
      <details><summary>Ver texto extraído del PDF</summary><pre>{result.textPreview||'No se obtuvo texto legible.'}</pre></details>
      {!!result.evidence?.length&&<details><summary>Ver evidencia del OCR por materia</summary><ul>{result.evidence.map((item,i)=><li key={i}><strong>{item.courseId}</strong> · Página {item.page} · Confianza OCR {Math.round(item.confidence*100)}%<p>{item.text}</p><small>{item.semesterLabel||'Sin etiqueta de semestre'} · {item.hoursText}</small></li>)}</ul></details>}
      <label className="check"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>Revisé las materias, la carga en créditos u horas, los semestres, los prerrequisitos y los correquisitos contra el PDF.</label>
      <div className="toolbar">
        <button disabled={!valid||!reviewed||pendingRelations>0} className="primary" onClick={()=>onPreview(parsed as Curriculum)}>Usar en vista previa</button>
        <button disabled={!valid||!!result.usedOcr&&(!reviewed||pendingRelations>0)} onClick={download}>Descargar JSON</button>
      </div>
    </div>}
  </section>
}
