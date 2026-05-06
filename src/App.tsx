import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar, Footer } from './components/Navigation';
import { FloatingChat } from './components/FloatingChat';
import Home from './pages/Home';
import Admin from './pages/Admin';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export default function App() {
  const CONTACTS = {
    wa: "082211243753",
    telegram: "@Fisen55",
    email: "mayfisenchristmaabuat@gmail.com"
  };

  return (
    <Router>
      <div className="min-h-screen flex flex-col font-sans">
        <Navbar />
        
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home contacts={CONTACTS} />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>

        <Footer />
        <FloatingChat whatsapp={CONTACTS.wa} telegram={CONTACTS.telegram} />
      </div>
    </Router>
  );
}
