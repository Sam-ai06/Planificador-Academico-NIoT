import type { AcademicScenario, Curriculum, StudentProfile } from '../../../types/academic';
import { eligible, passedIds } from '../../planner/services/planning';
export interface AssistantContext {
    curriculum: Curriculum;
    profile: StudentProfile;
    plan: AcademicScenario;
}
export interface AssistantService {
    reply(question: string, context?: AssistantContext): Promise<string>;
}
export const mockAssistant: AssistantService = {
    async reply(question, context) {
        await new Promise(r => setTimeout(r, 450));
        if (!question.trim())
            throw new Error('Escribe una pregunta.');
        if (!context)
            return 'Demostración: activa el contexto para recibir una explicación basada en tu malla y tu plan. No se ha consultado Gemma.';
        const { curriculum: c, profile: p, plan } = context;
        const available = c.courses.filter(x => p.statuses[x.id] !== 'passed' && eligible(c, x.id, passedIds(p)));
        const q = question.toLocaleLowerCase();
        const mentioned = c.courses.find(x => q.includes(x.name.toLocaleLowerCase()));
        if (q.includes('reprueb'))
            return `Demostración: ${mentioned ? mentioned.name : 'Una materia reprobada'} debe volver a planificarse antes de las materias que la requieren. Usa Replanificación para calcular el impacto exacto sin alterar tu plan actual. Las materias del mismo semestre no se habilitan entre sí.`;
        if (q.includes('datos') || q.includes('interés'))
            return `Demostración: puedes orientar el plan desde tus intereses en el perfil. Materias relacionadas en esta malla: ${c.courses.filter(x => x.area === 'Ciencia de datos').map(x => x.name).join(', ') || 'no hay materias clasificadas en esa área'}. Siempre debes completar sus prerrequisitos.`;
        return `Demostración: tu límite es de ${p.maxCourses} materias por semestre y tu plan contiene ${plan.semesters.length} semestres. Actualmente puedes priorizar: ${available.map(x => x.name).join(', ') || 'no hay materias habilitadas pendientes'}. El generador ordena por intereses, semestre sugerido y código, y valida prerrequisitos. No se han validado horarios, cupos ni oferta. Esta explicación es simulada; no se ha consultado Gemma.`;
    }
};
