import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

test('las nueve vistas se renderizan con el estado compartido inicial', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { AcademicProvider } = await server.ssrLoadModule('/src/app/providers/AcademicProvider.tsx')
    for (const [file, component, title] of [
      ['dashboard/Dashboard', 'Dashboard', 'Hola'],
      ['curriculum/CurriculumViewer', 'CurriculumViewer', 'Malla académica'],
      ['student/StudentProfile', 'StudentProfile', 'Perfil estudiantil'],
      ['planner/AcademicPlanner', 'AcademicPlanner', 'Planificador académico'],
      ['scenarios/ScenarioComparison', 'ScenarioComparison', 'Comparar escenarios'],
      ['replanning/ReplanningPanel', 'ReplanningPanel', 'Replanificación'],
      ['assistant/AcademicAssistant', 'AcademicAssistant', 'Asistente académico'],
      ['export/PlanExporter', 'PlanExporter', 'Resumen y exportación'],
      ['administration/CurriculumManager', 'CurriculumManager', 'Gestión de mallas'],
    ]) {
      const module = await server.ssrLoadModule(`/src/features/${file}.tsx`)
      const html = renderToString(React.createElement(MemoryRouter, null, React.createElement(AcademicProvider, null, React.createElement(module[component]))))
      assert.ok(html.includes(title), `La vista ${component} debe mostrar su título`)
      assert.ok(!html.includes('undefined'), `La vista ${component} no debe mostrar datos indefinidos`)
    }
  } finally {
    await server.close()
  }
})
