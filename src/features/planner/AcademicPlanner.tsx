import { totalWorkload, workloadLabel } from '../../services/workload';
import { useState } from 'react';
import { useAcademic } from '../../app/providers/AcademicProvider';
import { Notice, PageTitle } from '../../components/ui/Shared';
import { createScenario, eligible, passedIds, planWarnings, courseBundle } from './services/planning';
import { academicService } from '../../services/academicService';
import type { AcademicScenario, PlannedSemester } from '../../types/academic';
export function PlanSummary({ plan }: {
    plan: AcademicScenario;
}) {
    const { curriculum } = useAcademic();
    return <div className="plan-semesters">{plan.semesters.map(s => <section className="panel" key={s.number}><h3>Semestre futuro {s.number}</h3><small>{s.courseIds.length} materias · {totalWorkload(curriculum,s.courseIds)} {workloadLabel(curriculum)}</small><ul>{s.courseIds.map(id => <li key={id}>{curriculum.courses.find(c => c.id === id)?.name || id}</li>)}</ul>{!s.courseIds.length && <p>Sin materias seleccionadas.</p>}</section>)}{!plan.semesters.length && <Notice>El plan todavía no tiene semestres.</Notice>}</div>;
}
export function PlanningConstraints() { return <Notice>Se validan prerrequisitos y carga académica. Horarios, cupos y períodos de oferta no han sido validados. Las materias en curso no se consideran aprobadas.</Notice>; }
export function AcademicPlanner() {
    const { state, setState, curriculum } = useAcademic();
    const [message, setMessage] = useState('');
    const [name, setName] = useState('Mi alternativa');
    const [busy, setBusy] = useState(false);
    const plan = state.plan;
    const warnings = planWarnings(curriculum, state.profile, plan.semesters, plan.event);
    function change(semesters: PlannedSemester[]) { setState(s => ({ ...s, plan: { ...s.plan, semesters, parameters: structuredClone(s.profile), createdAt: new Date().toISOString() } })); }
    async function generate() { setBusy(true); setMessage(''); try {
        await new Promise(r => setTimeout(r, 200));
        const restriction = plan.event?.type === 'unavailable' && plan.event.courseId && plan.event.semester ? {courseId:plan.event.courseId, semester:plan.event.semester} : undefined;
        const semesters = await academicService.generate({curriculum,profile:state.profile,unavailable:restriction});
        setState(s => ({ ...s, plan: {...createScenario(curriculum, s.profile, semesters),event:plan.event} }));
    }
    catch (e) {
        setMessage((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    function add(number: number, id: string) {
      if ((plan.semesters.find(s=>s.number===number)?.courseIds.length||0)>=state.profile.maxCourses || plan.semesters.some(s=>s.courseIds.includes(id)) || state.profile.statuses[id]==='passed') return;
      if(plan.event?.type==='unavailable' && plan.event.courseId===id && plan.event.semester===number){setMessage('Esta materia no se oferta en ese semestre según tu restricción simulada.');return;}
      const before = passedIds(state.profile); plan.semesters.filter(s => s.number < number).flatMap(s => s.courseIds).forEach(x => before.add(x)); if (!eligible(curriculum, id, before)) {
        setMessage('Primero completa los prerrequisitos en un semestre anterior.');
        return;
    } const bundle=courseBundle(curriculum,id,before).filter(x=>!plan.semesters.find(s=>s.number===number)?.courseIds.includes(x));
if(bundle.length+(plan.semesters.find(s=>s.number===number)?.courseIds.length||0)>state.profile.maxCourses){setMessage('La materia y sus correquisitos superan el limite de carga.');return;}
if(bundle.some(x=>!eligible(curriculum,x,before))){setMessage('Los correquisitos tambien necesitan prerrequisitos aprobados en un semestre anterior.');return;}
if(bundle.some(x=>plan.semesters.some(s=>s.number!==number&&s.courseIds.includes(x)))){setMessage('Un correquisito ya esta planificado en otro semestre; ajusta su ubicacion.');return;}
if(plan.event?.type==='unavailable'&&plan.event.semester===number&&bundle.includes(plan.event.courseId||'')){setMessage('Un correquisito no tiene oferta en este semestre.');return;}
change(plan.semesters.map(s => s.number === number ? { ...s, courseIds: [...s.courseIds, ...bundle] } : s)); setMessage(''); }
    function save() { if (!name.trim() || !plan.semesters.some(s => s.courseIds.length)) {
        setMessage('Introduce un nombre y agrega materias antes de guardar.');
        return;
    } if (warnings.length) {
        setMessage('Corrige las advertencias antes de guardar.');
        return;
    } const scenario = {...createScenario(curriculum, state.profile, structuredClone(plan.semesters), name.trim()),event:plan.event}; setState(s => ({ ...s, scenarios: [...s.scenarios, scenario] })); setMessage('Alternativa guardada. Puedes compararla en Escenarios.'); }
    const selected = new Set(plan.semesters.flatMap(s => s.courseIds));
    return <><PageTitle eyebrow="DISEÑA TU SIGUIENTE PASO" title="Planificador académico" description="Explora posibilidades. Construye una ruta a tu medida." action={<button className="primary" disabled={busy} onClick={generate}>{busy ? 'Generando…' : '✦ Generar propuesta'}</button>}/><PlanningConstraints /><div className="toolbar"><span>Máximo: <strong>{state.profile.maxCourses} materias / semestre</strong></span><button onClick={() => change([...plan.semesters, { number: (plan.semesters.at(-1)?.number || 0) + 1, courseIds: [] }])}>+ Añadir semestre</button></div>{message && <Notice>{message}</Notice>}{warnings.map(w => <p className="error" key={w}>{w}</p>)}<div className="plan-semesters">{plan.semesters.map(s => <section className="panel" key={s.number}><div className="section-heading"><h2>Semestre {s.number}</h2><span className="badge">{s.courseIds.length}/{state.profile.maxCourses}</span></div><small>{totalWorkload(curriculum,s.courseIds)} {workloadLabel(curriculum)}</small>{s.courseIds.map(id => <div className="planned-course" key={id}><span>{curriculum.courses.find(c => c.id === id)?.name || id}</span><button aria-label={`Quitar ${curriculum.courses.find(c => c.id === id)?.name}`} onClick={() => change(plan.semesters.map(t => t.number === s.number ? { ...t, courseIds: t.courseIds.filter(x => x !== id) } : t))}>✕</button></div>)}<label>Añadir materia<select value="" disabled={s.courseIds.length >= state.profile.maxCourses} onChange={e => add(s.number, e.target.value)}><option value="">Selecciona una materia</option>{curriculum.courses.filter(c => state.profile.statuses[c.id] !== 'passed' && !selected.has(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></section>)}</div>{!plan.semesters.length && <div className="empty"><h2>Tu próximo capítulo empieza aquí</h2><p>Genera una propuesta o añade tu primer semestre.</p></div>}<section className="panel"><h2>Conserva esta alternativa</h2><div className="toolbar"><label>Nombre del escenario<input value={name} onChange={e => setName(e.target.value)}/></label><button className="primary" onClick={save}>Guardar escenario</button></div></section></>;
}
