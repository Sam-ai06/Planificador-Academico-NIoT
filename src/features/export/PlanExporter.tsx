import { useState } from 'react'
import { planWarnings, metrics } from '../planner/services/planning'
import { useAcademic } from '../../app/providers/AcademicProvider'
import { Modal, Notice, PageTitle } from '../../components/ui/Shared'
import { PlanSummary, PlanningConstraints } from '../planner/AcademicPlanner'
import { workloadLabel } from '../../services/workload'

export function PlanExporter() {
  const {state,curriculum}=useAcademic()
  const [share,setShare]=useState(false)
  const plan=state.plan
  const warnings=planWarnings(curriculum,state.profile,plan.semesters,plan.event)
  const summary=metrics(curriculum,plan)

  function download() {
    const blob=new Blob([JSON.stringify({version:1,curriculum,plan},null,2)],{type:'application/json'})
    const url=URL.createObjectURL(blob)
    const link=document.createElement('a')
    link.href=url
    link.download=`plan-${curriculum.id}.json`
    link.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  }

  return <>
    <PageTitle eyebrow="LLEVA TU PLAN CONTIGO" title="Resumen y exportación" description="Un panorama completo de tus próximos pasos."/>
    <section className="panel">
      <h2>{plan.name}</h2>
      <p>{curriculum.name} · {curriculum.institution}</p>
      <p>Generado: {new Date(plan.createdAt).toLocaleString('es-EC',{timeZone:'America/Guayaquil'})} (Ecuador)</p>
      <p>Parámetros: máximo {plan.parameters.maxCourses} materias; intereses: {plan.parameters.interests.join(', ')||'sin preferencia'}; {plan.parameters.availability.length} bloques de disponibilidad.</p>
      <details><summary>Ver parámetros completos</summary><pre>{JSON.stringify(plan.parameters,null,2)}</pre></details>
      <div className="toolbar no-print">
        <button className="primary" onClick={download}>↓ Descargar JSON</button>
        <button onClick={()=>window.print()}>Imprimir / guardar PDF</button>
        <button onClick={()=>setShare(true)}>Compartir con tutor</button>
      </div>
    </section>
    <PlanningConstraints/>
    {warnings.map(w=><p role="alert" className="error" key={w}>{w}</p>)}
    <section className="panel">
      <h2>Totales del plan</h2>
      <p>{summary.credits} {workloadLabel(curriculum)} · {summary.semesters} semestres planificados · {summary.remaining} materias sin planificar.</p>
      {plan.event&&<p>Evento simulado: {({failed:'materia reprobada',load:'cambio de carga',availability:'cambio de disponibilidad',interests:'cambio de intereses',unavailable:'falta de oferta'})[plan.event.type]}{plan.event.type==='unavailable'?` · ${plan.event.courseId} no ofertada en el semestre futuro ${plan.event.semester}`:''}.</p>}
    </section>
    <PlanSummary plan={plan}/>
    {share&&<Modal title="Compartir con tu tutor" onClose={()=>setShare(false)}>
      <Notice>El servicio para compartir aún no está disponible. No se ha enviado tu plan a nadie.</Notice>
      <p>Puedes descargar el JSON o guardar una copia en PDF y enviarla por el medio que prefieras.</p>
      <button onClick={download}>Descargar copia del plan</button>
    </Modal>}
  </>
}
