import type { Curriculum } from '../../../types/academic'
import type { PdfRelation } from '../services/pdfConverter'

export function PdfRelationReview({curriculum,relations,decisions,onDecision,onChange}:{
  curriculum:Curriculum;relations:PdfRelation[];decisions:Record<number,string>;
  onDecision:(index:number,value:string)=>void;onChange:(curriculum:Curriculum)=>void
}) {
  function updateCourse(id:string,field:'prerequisites'|'corequisites',value:string) {
    const ids=value.split(/[,;]+/).map(v=>v.trim()).filter(Boolean)
    onChange({...curriculum,courses:curriculum.courses.map(c=>c.id===id?{...c,[field]:[...new Set(ids)]}:c)})
  }
  return <div>
    <h3>Revisión de flechas y correquisitos</h3>
    <p>Las líneas continuas se interpretan como prerrequisitos y las discontinuas como correquisitos. Comprueba la simbología de tu PDF. Resuelve o descarta cada flecha ambigua antes de importar.</p>
    {relations.map((r,index)=>r.status==='unresolved'?<div className="relation-review" key={index}>
      <label>{r.type==='corequisite'?'Correquisito':'Prerrequisito'} de {r.target}
        <select value={decisions[index]||''} onChange={e=>onDecision(index,e.target.value)}>
          <option value="">Pendiente: selecciona el origen</option>
          <option value="__discard__">Descartar: no representa una relación</option>
          {curriculum.courses.filter(c=>c.id!==r.target).map(c=><option key={c.id} value={c.id}>{r.candidates.includes(c.id)?'Posible: ':''}{c.code} · {c.name}</option>)}
        </select>
      </label><small>{r.evidence}</small>
    </div>:null)}
    <details>
      <summary>Editar todas las relaciones de las materias</summary>
      <p>Introduce códigos separados por comas. Aquí puedes corregir la clasificación de una flecha o añadir relaciones que el detector no encontró.</p>
      <div className="table-wrap"><table><thead><tr><th>Materia</th><th>Prerrequisitos</th><th>Correquisitos</th></tr></thead><tbody>{curriculum.courses.map(c=><tr key={c.id}>
        <th>{c.code}<small className="block">{c.name}</small></th>
        <td><input aria-label={`Prerrequisitos de ${c.code}`} defaultValue={c.prerequisites.join(', ')} key={`${c.id}-pre-${c.prerequisites.join(',')}`} onBlur={e=>updateCourse(c.id,'prerequisites',e.target.value)}/></td>
        <td><input aria-label={`Correquisitos de ${c.code}`} defaultValue={(c.corequisites||[]).join(', ')} key={`${c.id}-co-${c.corequisites?.join(',')}`} onBlur={e=>updateCourse(c.id,'corequisites',e.target.value)}/></td>
      </tr>)}</tbody></table></div>
    </details>
  </div>
}
