import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import '@fontsource-variable/plus-jakarta-sans'
import './estilos.css'
import Clases from './pantallas/Clases.jsx'
import Detalle from './pantallas/Detalle.jsx'
import MiReserva from './pantallas/MiReserva.jsx'
import Panel from './pantallas/Panel.jsx'

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/clases" element={<Clases />} />
        <Route path="/clases/:id" element={<Detalle />} />
        <Route path="/reserva" element={<MiReserva />} />
        <Route path="/panel" element={<Panel />} />
        <Route path="*" element={<Navigate to="/clases" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
