import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCurriculum } from '../src/features/administration/validation.ts';
import { eligible, generatePlan, planWarnings, metrics, createScenario } from '../src/features/planner/services/planning.ts';
import type { Curriculum, StudentProfile } from '../src/types/academic.ts';
import { validStoredState } from '../src/services/storage.ts';
test('el estado persistido rechaza perfiles o semestres dañados',()=>{
  const plan=createScenario(curriculum,profile,generatePlan(curriculum,profile))
  const state={curriculums:[curriculum],curriculumId:curriculum.id,profile,plan,scenarios:[plan]}
  assert.equal(validStoredState(state),true)
  assert.equal(validStoredState({...state,profile:{...profile,availability:[null]}}),false)
  assert.equal(validStoredState({...state,profile:{...profile,statuses:{a:'inventado'}}}),false)
  assert.equal(validStoredState({...state,plan:{...plan,semesters:[{number:1,courseIds:['missing']}]}}),false)
  assert.equal(validStoredState({...state,scenarios:[null]}),false)
})
test('los IDs ajenos a la malla no acortan la generación',()=>{
  const p:StudentProfile={...profile,statuses:{extra:'passed'}}
  const plan=generatePlan(curriculum,p)
  assert.equal(plan.flatMap(s=>s.courseIds).length,curriculum.courses.length)
})
test('las restricciones de oferta también se revisan en planes editados',()=>{
  const warnings=planWarnings(curriculum,profile,[{number:1,courseIds:['a']}],{type:'unavailable',courseId:'a',semester:1})
  assert.match(warnings.join(' '),/oferta/)
})
const curriculum: Curriculum = { id: 'test', name: 'Test', institution: 'Demo', courses: [{ id: 'a', code: 'A', name: 'A', credits: 3, semester: 1, prerequisites: [] }, { id: 'b', code: 'B', name: 'B', credits: 4, semester: 2, prerequisites: ['a'] }, { id: 'c', code: 'C', name: 'C', credits: 3, semester: 1, prerequisites: [] }] };
const profile: StudentProfile = { name: 'Test', statuses: {}, maxCourses: 2, availability: [], interests: [] };
test('valida una malla correcta y rechaza estructuras incompletas', () => { assert.deepEqual(validateCurriculum(curriculum), []); for (const invalid of [null, [], {}, { ...curriculum, courses: [] }, { ...curriculum, courses: [null] }])
    assert.ok(validateCurriculum(invalid).length); });
test('detecta identificadores y códigos duplicados', () => { const c = structuredClone(curriculum); c.courses[1].id = 'a'; assert.match(validateCurriculum(c).join(' '), /duplicado/); c.courses[1].id = 'b'; c.courses[1].code = 'A'; assert.match(validateCurriculum(c).join(' '), /duplicado/); });
test('detecta referencias inexistentes y ciclos, incluso autoreferencias', () => { const c = structuredClone(curriculum); c.courses[0].prerequisites = ['missing']; assert.match(validateCurriculum(c).join(' '), /inexistente/); c.courses[0].prerequisites = ['b']; assert.match(validateCurriculum(c).join(' '), /ciclo/); c.courses[0].prerequisites = ['a']; assert.match(validateCurriculum(c).join(' '), /ciclo/); });
test('habilita materias solamente con sus prerrequisitos completos', () => { assert.equal(eligible(curriculum, 'b', new Set()), false); assert.equal(eligible(curriculum, 'b', new Set(['a'])), true); assert.equal(eligible(curriculum, 'missing', new Set()), false); });
test('genera planes deterministas sin habilitar materias del mismo semestre', () => { const plan = generatePlan(curriculum, profile); assert.deepEqual(plan, [{ number: 1, courseIds: ['a', 'c'] }, { number: 2, courseIds: ['b'] }]); assert.deepEqual(plan, generatePlan(curriculum, profile)); assert.deepEqual(planWarnings(curriculum, profile, plan), []); });
test('respeta carga y omite aprobadas, pero incluye reprobadas y en curso', () => { const p = { ...profile, maxCourses: 1, statuses: { a: 'passed', b: 'failed', c: 'active' } as StudentProfile['statuses'] }; const plan = generatePlan(curriculum, p); assert.equal(plan.flatMap(s => s.courseIds).includes('a'), false); assert.equal(plan.flatMap(s => s.courseIds).length, 2); assert.ok(plan.every(s => s.courseIds.length <= 1)); assert.deepEqual(planWarnings(curriculum, p, plan), []); });
test('una falta de oferta puede generar un semestre vacío antes de habilitar materias', () => { const c = { ...curriculum, courses: curriculum.courses.slice(0, 2) }; assert.deepEqual(generatePlan(c, profile, { courseId: 'a', semester: 1 }), [{ number: 1, courseIds: [] }, { number: 2, courseIds: ['a'] }, { number: 3, courseIds: ['b'] }]); });
test('advierte duplicados, exceso de carga y dependencias simultáneas', () => { const w = planWarnings(curriculum, { ...profile, maxCourses: 1 }, [{ number: 1, courseIds: ['a', 'b'] }, { number: 2, courseIds: ['a'] }]).join(' '); assert.match(w, /máximo/); assert.match(w, /prerrequisitos/); assert.match(w, /repetida/); });
test('rechaza carga cero y grafos imposibles', () => { assert.throws(() => generatePlan(curriculum, { ...profile, maxCourses: 0 })); const c = structuredClone(curriculum); c.courses[0].prerequisites = ['b']; assert.throws(() => generatePlan(c, profile)); });
test('recalcular no modifica perfil ni plan original y las métricas son reales', () => { const p = structuredClone(profile); const original = createScenario(curriculum, p, generatePlan(curriculum, p)); const saved = JSON.stringify(original); generatePlan(curriculum, { ...p, maxCourses: 1 }); assert.equal(JSON.stringify(original), saved); assert.deepEqual(p, profile); assert.deepEqual(metrics(curriculum, original), { semesters: 2, credits: 10, unlocked: 0, remaining: 0 }); });
