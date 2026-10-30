import { useState } from 'react';
import { useAcademic } from '../../app/providers/AcademicProvider';
import { Notice, PageTitle } from '../../components/ui/Shared';
import { createScenario, metrics } from '../planner/services/planning';
import { academicService } from '../../services/academicService';
import { PlanSummary } from '../planner/AcademicPlanner';
import { interests } from '../../types/constants';
import type { AcademicEvent, AcademicScenario, StudentProfile } from '../../types/academic';
export function ReplanningPanel() {
    const { state, setState, curriculum } = useAcademic();
    const [type, setType] = useState<AcademicEvent['type']>('failed');
    const [courseId, setCourseId] = useState(curriculum.courses[0].id);
    const [max, setMax] = useState(state.profile.maxCourses);
    const [semester, setSemester] = useState(1);
    const [area, setArea] = useState(interests[0]);
    const [day, setDay] = useState('Lunes');
    const [start, setStart] = useState('08:00');
    const [end, setEnd] = useState('12:00');
    const [preview, setPreview] = useState<{
        plan: AcademicScenario;
        profile: StudentProfile;
        original: AcademicScenario;
        originalProfile: StudentProfile;
    } | null>(null);
    const [message, setMessage] = useState('');
    const [busy,setBusy] = useState(false);
    async function simulate() { setBusy(true);setPreview(null);try {
        const p = structuredClone(state.profile);
        if (type === 'failed')
            p.statuses[courseId] = 'failed';
        if (type === 'load')
            p.maxCourses = max;
        if (type === 'interests')
            p.interests = [area];
        if (type === 'availability') {
            if (end <= start)
                throw new Error('La hora final debe ser posterior a la inicial.');
            p.availability = [{ day, start, end }];
        }
        ;
        const semesters = await academicService.generate({curriculum,profile:p,unavailable:type === 'unavailable' ? { courseId, semester } : undefined});
        const event:AcademicEvent={type,courseId,semester,maxCourses:p.maxCourses,availability:p.availability,interests:p.interests};
        setPreview({ profile: p, plan: {...createScenario(curriculum, p, semesters, 'Plan recalculado'),event}, original: structuredClone(state.plan),originalProfile:structuredClone(state.profile) });
        setMessage('');
    }
    catch (e) {
        setMessage((e as Error).message);
    } finally {setBusy(false)} }
    return <><PageTitle eyebrow="LOS PLANES TAMBIÉN EVOLUCIONAN" title="Replanificación" description="Simula un cambio y conoce su impacto antes de decidir."/><section className="panel"><label>¿Qué cambió?<select value={type} onChange={e => { setType(e.target.value as AcademicEvent['type']); setPreview(null); }}>{[['failed', 'Reprobé una materia'], ['load', 'Reducir carga académica'], ['availability', 'Cambiar disponibilidad'], ['interests', 'Cambiar intereses profesionales'], ['unavailable', 'Materia no ofertada en un período']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>{['failed', 'unavailable'].includes(type) && <label>Materia<select value={courseId} onChange={e => { setCourseId(e.target.value); setPreview(null); }}>{curriculum.courses.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>}{type === 'load' && <label>Nuevo máximo<input type="number" min="1" max={state.profile.maxCourses} value={max} onChange={e => { setMax(Math.max(1, Math.min(state.profile.maxCourses, Number(e.target.value)))); setPreview(null); }}/></label>}{type === 'unavailable' && <label>Semestre futuro sin oferta<input type="number" min="1" max="30" value={semester} onChange={e => { setSemester(Math.max(1, Math.min(30, Number(e.target.value)))); setPreview(null); }}/></label>}{type === 'interests' && <label>Interés principal<select value={area} onChange={e => { setArea(e.target.value); setPreview(null); }}>{interests.map(a => <option key={a}>{a}</option>)}</select></label>}{type === 'availability' && <div className="toolbar"><label>Día<select value={day} onChange={e => { setDay(e.target.value); setPreview(null); }}>{['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => <option key={d}>{d}</option>)}</select></label><label>Desde<input type="time" value={start} onChange={e => { setStart(e.target.value); setPreview(null); }}/></label><label>Hasta<input type="time" value={end} onChange={e => { setEnd(e.target.value); setPreview(null); }}/></label></div>}<button className="primary" disabled={busy} onClick={simulate}>{busy ? "Calculando..." : "Calcular vista previa"}</button></section>{message && <Notice>{message}</Notice>}<Notice>La simulación no modifica tu plan. La disponibilidad se registra, pero no puede validarse sin horarios de materias. Una falta de oferta es una restricción introducida por ti.</Notice>{preview && <><div className="two-columns"><div><h2>Plan anterior</h2><PlanSummary plan={preview.original}/></div><div><h2>Nueva propuesta</h2><PlanSummary plan={preview.plan}/></div></div><section className="panel"><h2>Impacto estimado</h2><p>{metrics(curriculum, preview.original).remaining === 0 ? `${preview.plan.semesters.length - preview.original.semesters.length} semestres de diferencia respecto al plan anterior.` : 'El plan anterior está incompleto; no se puede comparar la fecha de graduación.'} La propuesta requiere {preview.plan.semesters.length} semestres, sin validar calendario ni oferta real.</p><h3>Materias que cambian</h3>{curriculum.courses.map(c => { const before = preview.original.semesters.find(s => s.courseIds.includes(c.id))?.number; const after = preview.plan.semesters.find(s => s.courseIds.includes(c.id))?.number; return before !== after ? <p className="changed" key={c.id}>{c.name}: {before ? `semestre ${before}` : 'sin planificar'} → {after ? `semestre ${after}` : 'fuera del plan'}</p> : null; })}<div className="toolbar"><button className="primary" onClick={() => { if (JSON.stringify(state.plan) !== JSON.stringify(preview.original) || JSON.stringify(state.profile) !== JSON.stringify(preview.originalProfile)) {
        setMessage('El plan cambió. Calcula otra vista previa antes de confirmar.');
        return;
    } setState(s => ({ ...s, plan: preview.plan, profile: preview.profile })); setPreview(null); setMessage('Cambios confirmados. El plan principal se actualizó.'); }}>Confirmar cambios</button><button onClick={() => setPreview(null)}>Descartar propuesta</button></div></section></>}</>;
}
