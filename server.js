import express from 'express';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(process.cwd(), 'links.json');

app.use(express.json());
app.use(express.static('public'));

// Función para cargar links
function loadLinks() {
  if (!fs.existsSync(DATA_PATH)) return [];
  try {
    const contenido = fs.readFileSync(DATA_PATH, 'utf-8');
    return JSON.parse(contenido);
  } catch {
    return [];
  }
}

// Función para guardar links
function saveLinks(links) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(links, null, 2));
}

// Ruta para crear nuevo enlace corto
app.post('/api/nuevo', (req, res) => {
  const { destino } = req.body;
  
  if (!destino || !destino.startsWith('http')) {
    return res.status(400).json({ error: 'URL destino inválida' });
  }
  
  const links = loadLinks();
  const id = nanoid(6); // ID corto de 6 caracteres
  
  const nuevoLink = {
    id,
    destino,
    clicks: [],
    creado: new Date().toISOString()
  };
  
  links.push(nuevoLink);
  saveLinks(links);
  
  res.json({
    corto: `${req.protocol}://${req.get('host')}/l/${id}`,
    id,
    destino
  });
});

// Ruta para redirigir (¡aquí se hace el tracking!)
app.get('/l/:id', (req, res) => {
  const { id } = req.params;
  const links = loadLinks();
  const link = links.find(l => l.id === id);
  
  if (!link) {
    return res.status(404).send('Enlace no encontrado');
  }
  
  // Registrar el clic
  const clic = {
    ip: (req.ip || req.connection.remoteAddress || req.socket.remoteAddress || '127.0.0.1').replace('::1', '127.0.0.1'),
    userAgent: req.headers['user-agent'] || 'desconocido',
    fecha: new Date().toISOString(),
    referrer: req.headers.referer || null
  };
  
  link.clicks.push(clic);
  saveLinks(links);
  
  // Redirigir al destino real
  res.redirect(302, link.destino);
});

// Panel de admin (para ver estadísticas)
app.get('/api/links', (req, res) => {
  res.json(loadLinks());
});

// 🆕 NUEVA RUTA: BORRAR enlace específico
app.delete('/api/links/:id', (req, res) => {
  const { id } = req.params;
  let links = loadLinks();
  const indice = links.findIndex(l => l.id === id);
  
  if (indice === -1) {
    return res.status(404).json({ error: 'Enlace no encontrado' });
  }
  
  links.splice(indice, 1);  // Eliminar del array
  saveLinks(links);
  
  res.json({ ok: true, mensaje: `Enlace ${id} eliminado` });
});

app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});
