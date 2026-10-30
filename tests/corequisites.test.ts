import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generatePlan, planWarnings } from '../src/features/planner/services/planning.ts'
import { validateCurriculum } from '../src/features/administration/validation.ts'
import { workloadLabel, totalWorkload } from '../src/services/workload.ts'
import type { Curriculum, StudentProfile } from '../src/types/academic.ts'

const curriculum:Curriculum={id:'hours',name:'Malla por horas',institution:'Demo',hoursBasis:'source',courses:[
  {id:'A',code:'A',name:'A',credits:null,hours:9,semester:1,prerequisites:[],corequisites:['B']},
  {id:'B',code:'B',name:'B',credits:null,hours:6,semester:1,prerequisites:[],corequisites:['A']},
  {id:'C',code:'C',name:'C',credits:null,hours:3,semester:null,semesterUnspecified:true,prerequisites:['A']},
]}
const profile:StudentProfile={name:'Test',statuses:{},maxCourses:2,availability:[],interests:[]}

test('acepta mallas por horas y conserva la unidad sin crear créditos',()=>{
  assert.deepEqual(validateCurriculum(curriculum),[])
  assert.equal(totalWorkload(curriculum),18)
  assert.equal(workloadLabel(curriculum),'horas declaradas')
  assert.ok(curriculum.courses.every(c=>c.credits===null))
  assert.ok(validateCurriculum({...curriculum,courses:[{...curriculum.courses[0],hours:null}]}).length)
  assert.ok(validateCurriculum({...curriculum,courses:[{...curriculum.courses[0],semester:null}]}).length)
})
test('planifica juntos los correquisitos mutuos y respeta los prerrequisitos anteriores',()=>{
  const plan=generatePlan(curriculum,profile)
  assert.deepEqual(plan,[{number:1,courseIds:['A','B']},{number:2,courseIds:['C']}])
  assert.deepEqual(planWarnings(curriculum,profile,plan),[])
})
test('rechaza carga insuficiente o falta de oferta de un correquisito',()=>{
  assert.throws(()=>generatePlan(curriculum,{...profile,maxCourses:1}),/correquisitos/)
  const plan=generatePlan(curriculum,profile,{courseId:'B',semester:1})
  assert.deepEqual(plan[0].courseIds,[])
  assert.deepEqual(plan[1].courseIds,['A','B'])
})
test('advierte al eliminar un correquisito y detecta referencias erróneas',()=>{
  assert.match(planWarnings(curriculum,profile,[{number:1,courseIds:['A']}]).join(' '),/correquisito B/)
  const c=structuredClone(curriculum);c.courses[0].corequisites=['missing']
  assert.match(validateCurriculum(c).join(' '),/Correquisito inexistente/)
  c.courses[0].corequisites=['A'];assert.match(validateCurriculum(c).join(' '),/propio correquisito/)
})
