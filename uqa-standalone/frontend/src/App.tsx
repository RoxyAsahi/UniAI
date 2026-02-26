import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import UqaLanding from './pages/UqaLanding'
import UqaQuestionnaire from './pages/UqaQuestionnaire'
import UqaResult from './pages/UqaResult'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/uqa" replace />} />
        <Route path="/uqa" element={<UqaLanding />} />
        <Route path="/uqa/questionnaire" element={<UqaQuestionnaire />} />
        <Route path="/uqa/result/:id" element={<UqaResult />} />
      </Routes>
    </BrowserRouter>
  )
}
