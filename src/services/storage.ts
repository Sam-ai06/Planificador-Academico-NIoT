import type { AcademicState, AcademicScenario, StudentProfile } from '../types/academic'
import { validateCurriculum } from '../features/administration/validation.ts'
function validProfile(p: StudentProfile): boolean {
  return !!p && typeof p.name === 'string' && Number.isInteger(p.maxCourses) && p.maxCourses > 0 && !!p.statuses && typeof p.statuses === 'object' && !Array.isArray(p.statuses) && Object.values(p.statuses).every(s=>['pending','passed','failed','active'].includes(s)) && Array.isArray(p.interests) && p.interests.every(x=>typeof x==='string') && Array.isArray(p.availability) && p.availability.every(t=>t && typeof t.day==='string' && typeof t.start==='string' && typeof t.end==='string')
}
function validPlan(p: AcademicScenario, state: AcademicState): boolean {
  const curriculum=state.curriculums.find(c=>c.id===p?.curriculumId)
  return !!curriculum && !!p && typeof p.id==='string' && typeof p.name==='string' && typeof p.createdAt==='string' && Number.isFinite(Date.parse(p.createdAt)) && validProfile(p.parameters) && Array.isArray(p.semesters) && new Set(p.semesters.map(s=>s?.number)).size===p.semesters.length && p.semesters.every(s=>s && Number.isInteger(s.number) && s.number>0 && Array.isArray(s.courseIds) && s.courseIds.every(id=>curriculum.courses.some(c=>c.id===id)))
}
export function validStoredState(value: unknown): value is AcademicState {
  if (!value || typeof value!=='object') return false
  const state=value as AcademicState
  return Array.isArray(state.curriculums) && state.curriculums.length>0 && state.curriculums.every(c=>!validateCurriculum(c).length) && new Set(state.curriculums.map(c=>c.id)).size===state.curriculums.length && state.curriculums.some(c=>c.id===state.curriculumId) && validProfile(state.profile) && validPlan(state.plan,state) && state.plan.curriculumId===state.curriculumId && Array.isArray(state.scenarios) && state.scenarios.every(s=>validPlan(s,state))
}
