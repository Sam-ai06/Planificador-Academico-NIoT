import type { Curriculum } from '../../types/academic';
export function validateCurriculum(value: unknown): string[] {
    if (!value || typeof value !== 'object')
        return ['La malla debe ser un objeto JSON.'];
    const c = value as Curriculum;
    const errors: string[] = [];
    if (![c.id, c.name, c.institution].every(v => typeof v === 'string' && v.trim()))
        errors.push('id, name e institution deben ser textos no vacíos.');
    if (!Array.isArray(c.courses) || !c.courses.length)
        return [...errors, 'courses debe ser una lista no vacía.'];
    const ids = new Set<string>(), codes = new Set<string>();
    for (const course of c.courses) {
        if (!course || typeof course !== 'object') {
            errors.push('Materia inválida.');
            continue;
        }
        const validLoad = course.credits === null ? Number.isFinite(course.hours) && course.hours! > 0 : Number.isFinite(course.credits) && course.credits > 0;
        const validSemester = course.semester === null ? course.semesterUnspecified === true : Number.isInteger(course.semester) && course.semester > 0;
        const breakdown=course.hoursBreakdown;
        if(breakdown!==undefined && (!breakdown || typeof breakdown!=='object' || Array.isArray(breakdown) || !Object.values(breakdown).every(v=>typeof v==='number' && Number.isFinite(v) && v>=0) || !['teaching','practice','autonomous'].every(k=>k in breakdown))) errors.push(`Desglose de horas inválido: ${course.code}.`);
        if (![course.id, course.code, course.name].every(v => typeof v === 'string' && v.trim()) || !validLoad || !validSemester || !Array.isArray(course.prerequisites) || !course.prerequisites.every(p => typeof p === 'string') || (course.corequisites !== undefined && (!Array.isArray(course.corequisites) || !course.corequisites.every(p=>typeof p==='string'))) || (course.hours!==undefined && (!Number.isFinite(course.hours)||course.hours<=0)) || (course.area !== undefined && typeof course.area !== 'string'))
            errors.push(`Estructura inválida: ${course.code || 'materia'}.`);
        if (ids.has(course.id) || codes.has(course.code))
            errors.push(`Identificador o código duplicado: ${course.code}.`);
        ids.add(course.id);
        codes.add(course.code);
    }
    if (errors.length)
        return errors;
    for (const course of c.courses)
        for (const p of course.prerequisites)
            if (!ids.has(p))
                errors.push(`Prerrequisito inexistente ${p} en ${course.code}.`);
    for (const course of c.courses) for(const p of course.corequisites||[]) {
        if(!ids.has(p)) errors.push(`Correquisito inexistente ${p} en ${course.code}.`);
        if(p===course.id) errors.push(`Una materia no puede ser su propio correquisito: ${p}.`);
    }
    const visited = new Set<string>(), visiting = new Set<string>();
    function visit(id: string): boolean {
        if (visiting.has(id))
            return true;
        if (visited.has(id))
            return false;
        visiting.add(id);
        for (const p of c.courses.find(x => x.id === id)?.prerequisites || [])
            if (visit(p))
                return true;
        visiting.delete(id);
        visited.add(id);
        return false;
    }
    if (c.courses.some(x => visit(x.id)))
        errors.push('Se detectó un ciclo de prerrequisitos.');
    return errors;
}
