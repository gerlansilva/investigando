import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/paleta.css'; // a paleta vale sobre os estilos de cada objeto
import './app/professor.css'; // modo professor e registro
import './app/exportar.css'; // impressão: só a mesa
import './app/acessibilidade.css'; // por último: os ajustes de acessibilidade têm a última palavra

createRoot(document.getElementById('raiz')!).render(<App />);
