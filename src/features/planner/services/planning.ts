import type { AcademicScenario, Curriculum, StudentProfile, PlannedSemester, AcademicEvent } from '../../../types/academic';
import { totalWorkload } from '../../../services/workload.ts';
export const passedIds = (p: StudentProfile) => new Set(Object.keys(p.statuses).filter(id => p.statuses[id] === 'passed'));
export function eligible(c: Curriculum, id: string, completed: Set<string>) { return c.courses.find(x => x.id === id)?.prerequisites.every(p => completed.has(p)) ?? false; }
export function courseBundle(c:Curriculum,id:string,completed:Set<string>):string[] {
    const bundle=new Set<string>();
    function visit(current:string){
        if(completed.has(current)||bundle.has(current))return;
        const course=c.courses.find(x=>x.id===current);
        if(!course)throw new Error(`Materia inexistente: ${current}.`);
        bundle.add(current);
        for(const co of course.corequisites||[]) visit(co);
    }
    visit(id);return [...bundle];
}
export function planWarnings(c: Curriculum, p: StudentProfile, semesters: PlannedSemester[], event?: AcademicEvent): string[] {
    const done = passedIds(p), seen = new Set<string>(), warnings: string[] = [];
    for (const s of [...semesters].sort((a, b) => a.number - b.number)) {
        if (s.courseIds.length > p.maxCourses)
            warnings.push(`Semestre ${s.number}: supera el máximo de materias.`);
        for (const id of s.courseIds) {
            const course=c.courses.find(x=>x.id===id);
            for(const co of course?.corequisites||[]) if(!done.has(co)&&!s.courseIds.includes(co)) warnings.push(`Semestre ${s.number}: falta el correquisito ${co} de ${course?.name}.`);
            if (event?.type === 'unavailable' && event.courseId === id && event.semester === s.number)
                warnings.push(`Semestre ${s.number}: materia sin oferta según la restricción simulada (${id}).`);
            if (!eligible(c, id, done))
                warnings.push(`Semestre ${s.number}: prerrequisitos pendientes para ${c.courses.find(x => x.id === id)?.name || id}.`);
            if (seen.has(id) || done.has(id))
                warnings.push(`Materia repetida o aprobada: ${id}.`);
            seen.add(id);
        }
        s.courseIds.forEach(id => done.add(id));
    }
    return warnings;
}
export function generatePlan(c: Curriculum, p: StudentProfile, unavailable?: {
    courseId: string;
    semester: number;
}): PlannedSemester[] {
    const done = passedIds(p), result: PlannedSemester[] = [];
    if (!Number.isInteger(p.maxCourses) || p.maxCourses < 1)
        throw new Error('El máximo de materias debe ser positivo.');
    for (let number = 1; c.courses.some(course => !done.has(course.id)) && number <= c.courses.length + (unavailable?.semester || 0) + 1; number++) {
        const candidates = c.courses.filter(x => !done.has(x.id) && eligible(c, x.id, done)).sort((a, b) => Number(p.interests.includes(b.area || '')) - Number(p.interests.includes(a.area || '')) || (a.semester??Number.MAX_SAFE_INTEGER) - (b.semester??Number.MAX_SAFE_INTEGER) || a.code.localeCompare(b.code));
        const courseIds:string[]=[];
        for(const course of candidates){
            if(courseIds.includes(course.id))continue;
            const bundle=courseBundle(c,course.id,done).filter(id=>!courseIds.includes(id));
            if(courseIds.length+bundle.length>p.maxCourses || bundle.some(id=>!eligible(c,id,done) || (unavailable?.courseId===id && unavailable.semester===number)))continue;
            courseIds.push(...bundle);
        }
        if (!courseIds.length && !(unavailable && number <= unavailable.semester))
            throw new Error('No es posible completar el plan: revisa los prerrequisitos, los correquisitos y el máximo de materias.');
        result.push({ number, courseIds });
        courseIds.forEach(id => done.add(id));
    }
    return result;
}
export function createScenario(c: Curriculum, p: StudentProfile, semesters: PlannedSemester[], name = 'Mi plan'): AcademicScenario {
    return { id: crypto.randomUUID(), name, semesters, parameters: structuredClone(p), createdAt: new Date().toISOString(), curriculumId: c.id };
}
export function metrics(c: Curriculum, s: AcademicScenario) {
    const done = passedIds(s.parameters);
    s.semesters.flatMap(x => x.courseIds).forEach(id => done.add(id));
    return { semesters: s.semesters.length, credits: totalWorkload(c,s.semesters.flatMap(t=>t.courseIds)), unlocked: c.courses.filter(x => !done.has(x.id) && eligible(c, x.id, done)).length, remaining: c.courses.filter(x => !done.has(x.id)).length };
}
