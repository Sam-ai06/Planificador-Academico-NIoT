import { test } from 'node:test'
import assert from 'node:assert/strict'
import { convertCurriculumPdf } from '../src/features/administration/services/pdfConverter.ts'
import { validateCurriculum } from '../src/features/administration/validation.ts'

const metadata={id:'test',name:'Ingeniería',institution:'Universidad'}
const file=new File(['%PDF-1.4\nexample'],'malla.pdf',{type:'application/pdf'})
const curriculum={...metadata,courses:[{id:'A1',code:'A1',name:'Materia',credits:4,semester:1,prerequisites:[]}]}
const result={curriculum,warnings:['Revisa el resultado.'],pageCount:1,textPreview:'A1 Materia 4 1'}

test('el cliente envía el PDF como binario y recibe el esquema importable',async()=>{
  const original=globalThis.fetch
  try {
    globalThis.fetch=async(input,init)=>{
      const url=new URL(String(input),'http://localhost')
      assert.equal(url.pathname,'/api/curriculums/convert-pdf')
      assert.equal(url.searchParams.get('name'),metadata.name)
      assert.equal(init?.method,'POST')
      assert.equal((init?.headers as Record<string,string>)['Content-Type'],'application/pdf')
      assert.equal(init?.body,file)
      return Response.json(result)
    }
    const converted=await convertCurriculumPdf(file,metadata)
    assert.deepEqual(converted,result)
    assert.deepEqual(validateCurriculum(converted.curriculum),[])
  } finally {globalThis.fetch=original}
})

test('se muestran errores legibles cuando falta Python o el PDF no se reconoce',async()=>{
  const original=globalThis.fetch
  try {
    globalThis.fetch=async()=>Response.json({error:'PDF escaneado: se requiere OCR.'},{status:422})
    await assert.rejects(()=>convertCurriculumPdf(file,metadata),/OCR/)
    globalThis.fetch=async()=>new Response('',{status:502})
    await assert.rejects(()=>convertCurriculumPdf(file,metadata),/servicio Python/)
    globalThis.fetch=async()=>{throw new Error('Network error')}
    await assert.rejects(()=>convertCurriculumPdf(file,metadata),/8001/)
    const request=new AbortController();request.abort()
    await assert.rejects(()=>convertCurriculumPdf(file,metadata,request.signal),/canceló/)
  } finally {globalThis.fetch=original}
})

test('rechaza archivos vacíos, extensiones inválidas y respuestas mal formadas',async()=>{
  const original=globalThis.fetch
  try {
    globalThis.fetch=async()=>Response.json({curriculum:{}})
    await assert.rejects(()=>convertCurriculumPdf(new File([],'empty.pdf'),metadata),/10 MB/)
    await assert.rejects(()=>convertCurriculumPdf(new File(['test'],'test.txt'),metadata),/\.pdf/)
    await assert.rejects(()=>convertCurriculumPdf(file,metadata),/inesperada/)
  } finally {globalThis.fetch=original}
})
