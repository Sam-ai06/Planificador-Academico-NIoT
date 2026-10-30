import { useState } from 'react'
import { useAcademic } from '../../app/providers/AcademicProvider'
import { Modal, PageTitle } from '../../components/ui/Shared'
import { statusLabels } from '../../types/constants'
import { eligible, passedIds } from '../planner/services/planning'
import { courseWorkload, totalWorkload, workloadLabel } from '../../services/workload'
import type { Course } from '../../types/academic'

export function CurriculumProgress() {
  const {curriculum,state}=useAcademic()
  const total=totalWorkload(curriculum)
  const passed=totalWorkload(curriculum,curriculum.courses.filter(c=>state.profile.statuses[c.id]==='passed').map(c=>c.id))
  return <div className="progress-block">
    <div className="section-heading"><strong>Tu avance académico</strong><strong>{total?Math.round(passed/total*100):0}%</strong></div>
    <progress value={passed} max={total||1}/><small>{passed} de {total} {workloadLabel(curriculum)} aprobados</small>
  </div>
}

export function CourseCard({course,onSelect}:{course:Course;onSelect:()=>void}) {
  const {state,curriculum}=useAcademic()
  const status=state.profile.statuses[course.id]||'pending'
  return <button className={`course-card ${status}`} onClick={onSelect}>
    <span className="section-heading"><small>{course.sourceCodeMissing?'Sin código oficial':course.code}</small><small>{courseWorkload(course)}</small></span>
    <strong>{course.name}</strong><span className={`badge ${status}`}>{statusLabels[status]}</span>
    {status==='pending'&&!eligible(curriculum,course.id,passedIds(state.profile))&&<small>Prerrequisitos pendientes</small>}
    {!!course.corequisites?.length&&<small>Requiere cursar correquisitos</small>}
  </button>
}

export function PrerequisiteGraph({course,onSelect}:{course:Course;onSelect:(c:Course)=>void}) {
  const {curriculum}=useAcademic()
  const groups:[string,Course[]][]=[
    ['Prerrequisitos',curriculum.courses.filter(c=>course.prerequisites.includes(c.id))],
    ['Correquisitos',curriculum.courses.filter(c=>course.corequisites?.includes(c.id))],
    ['Desbloquea',curriculum.courses.filter(c=>c.prerequisites.includes(course.id))],
  ]
  return <div className="relations">{groups.map(([label,items])=><div key={label}><h3>{label}</h3>{items.length?items.map(c=><button key={c.id} onClick={()=>onSelect(c)}>{c.code} → {c.name}</button>):<p>Ninguna materia</p>}</div>)}</div>
}

export function CurriculumViewer() {
  const {curriculum}=useAcademic()
  const [selected,setSelected]=useState<Course|null>(null)
  const semesters=[...new Set(curriculum.courses.map(c=>c.semester))].sort((a,b)=>(a??Number.MAX_SAFE_INTEGER)-(b??Number.MAX_SAFE_INTEGER))
  return <>
    <PageTitle eyebrow="EXPLORA TU CAMINO" title="Malla académica" description="Cada materia es un paso hacia tu próximo objetivo."/>
    <CurriculumProgress/>
    {curriculum.hoursBasis==='source'&&<p>Las horas se muestran como aparecen en la fuente; no equivalen a créditos ni a horas semestrales calculadas.</p>}
    <div className="legend">{Object.entries(statusLabels).map(([key,label])=><span className={`badge ${key}`} key={key}>{label}</span>)}</div>
    <div className="semester-grid">{semesters.map(s=><section key={s??'unspecified'} className="semester-column"><h3>{s===null?'Sin semestre sugerido':`Semestre ${s}`}</h3>{curriculum.courses.filter(c=>c.semester===s).map(c=><CourseCard key={c.id} course={c} onSelect={()=>setSelected(c)}/>)}</section>)}</div>
    {selected&&<Modal title={selected.name} onClose={()=>setSelected(null)}>
      <p>{selected.sourceCodeMissing?'Identificador técnico: ':''}{selected.code} · {courseWorkload(selected)} · {selected.semester===null?'Sin semestre sugerido':`Semestre sugerido ${selected.semester}`}</p>
      {selected.hoursBreakdown&&<p>Docencia: {selected.hoursBreakdown.teaching} · Prácticas: {selected.hoursBreakdown.practice} · Trabajo autónomo: {selected.hoursBreakdown.autonomous} horas declaradas.</p>}
      <PrerequisiteGraph course={selected} onSelect={setSelected}/>
    </Modal>}
  </>
}
