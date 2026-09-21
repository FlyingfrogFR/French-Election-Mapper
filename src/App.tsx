import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import About from './pages/About';
import CandidateDetail from './pages/CandidateDetail';
import Candidates from './pages/Candidates';
import Home from './pages/Home';
import Legal from './pages/Legal';
import Methodology from './pages/Methodology';
import NotFound from './pages/NotFound';
import Privacy from './pages/Privacy';
import Questionnaire from './pages/Questionnaire';
import Results from './pages/Results';
import Updates from './pages/Updates';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="questionnaire" element={<Questionnaire />} />
        <Route path="questionnaire/:topicId" element={<Questionnaire />} />
        <Route path="resultats" element={<Results />} />
        <Route path="candidats" element={<Candidates />} />
        <Route path="candidats/:candidateId" element={<CandidateDetail />} />
        <Route path="mises-a-jour" element={<Updates />} />
        <Route path="methodologie" element={<Methodology />} />
        <Route path="confidentialite" element={<Privacy />} />
        <Route path="mentions-legales" element={<Legal />} />
        <Route path="transparence" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
