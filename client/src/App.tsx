
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import OSShell from './os/OSShell';
import Register from './pages/Register';
import ClickSpark from './components/ClickSpark';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/*"
          element={
            <AuthProvider>
              <ThemeProvider>
                <ClickSpark sparkColor="rgba(167, 139, 250, 0.5)" sparkSize={10} sparkCount={12}>
                    <OSShell />
                </ClickSpark>
              </ThemeProvider>
            </AuthProvider>
          }
        />
        <Route path="/register" element={<Register />} />
      </Routes>
    </BrowserRouter>
  );
}
