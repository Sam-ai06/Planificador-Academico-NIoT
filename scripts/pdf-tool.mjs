import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// El entorno virtual pertenece al proyecto; no depende de la activación del shell.
const venv=resolve(process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python')
const executable=process.env.PDF_PYTHON || (existsSync(venv)?venv:'python')
const args=process.argv[2]==='test'
  ? ['-m','unittest','discover','-s','tools/pdf_converter/tests','-v']
  : ['-m','tools.pdf_converter','--serve',...process.argv.slice(3)]
const child=spawn(executable,args,{stdio:'inherit',windowsHide:true})
child.on('error',()=>{
  console.error('No se pudo iniciar Python. Crea .venv e instala tools/pdf_converter/requirements.txt. También puedes configurar PDF_PYTHON con la ruta de tu intérprete.')
  process.exitCode=1
})
child.on('exit',(code,signal)=>{process.exitCode=code??(signal?1:0)})
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{child.kill(signal)})
