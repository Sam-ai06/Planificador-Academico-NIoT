import type { Course, Curriculum } from '../types/academic'
export function workloadUnit(curriculum:Curriculum):'credits'|'hours'|'courses' {
  if(curriculum.courses.every(c=>c.credits!==null))return 'credits'
  if(curriculum.courses.every(c=>typeof c.hours==='number'))return 'hours'
  return 'courses'
}
export function workloadLabel(curriculum:Curriculum) {
  return {credits:'créditos',hours:'horas declaradas',courses:'materias'}[workloadUnit(curriculum)]
}
export function workloadValue(curriculum:Curriculum,course:Course) {
  const unit=workloadUnit(curriculum)
  return unit==='credits'?(course.credits??0):unit==='hours'?(course.hours??0):1
}
export function courseWorkload(course:Course) {
  return course.credits!==null?`${course.credits} créditos`:typeof course.hours==='number'?`${course.hours} h declaradas`:'Carga sin especificar'
}
export function totalWorkload(curriculum:Curriculum,ids?:string[]) {
  const selected=ids?new Set(ids):null
  return curriculum.courses.filter(c=>!selected||selected.has(c.id)).reduce((n,c)=>n+workloadValue(curriculum,c),0)
}
