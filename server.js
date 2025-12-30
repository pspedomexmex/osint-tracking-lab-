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

// 🆕 FUNCIÓN GEOLOCALIZACIÓN por IP (GRATIS)
async function getGeoFromIP(ip) {
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,lat,lon,isp`);
    const data = await res.json();
    if (data.status === 'success') {
      return {
        ciudad: `${data.city || 'Desconocida'}, ${data.regionName || ''}`,
        pais: data.country || 'Desconocido',
        lat: data.lat,
        lon: data.lon,
        isp: data.isp || 'Desconocido'
      };
    }
  } catch(e) {
    console.log('Error geolocalización:', e.message);
  }
  return { ciudad: 'No disponible', pais: '', lat: null, lon: null, isp: '' };
}

// Ruta para crear nuevo enlace corto
app.post('/api/nuevo', (req, res) => {
  const { destino } = req.body;
  
  if (!destino || !destino.startsWith('http')) {
    return res.status(400).json({ error: 'URL destino inválida' });
  }
  
  const links = loadLinks();
  const id = nanoid(6);
  
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

// Ruta para redirigir (¡GEOLOCALIZACIÓN REAL!)
app.get('/l/:id', async (req, res) => {
  const { id } = req.params;
  const links = loadLinks();
  const link = links.find(l => l.id === id);
  
  if (!link) {
    return res.status(404).send('Enlace no encontrado');
  }
  
  // 🆕 IP REAL MEJORADA
  const ipReal = (req.ip || req.connection.remoteAddress || req.socket.remoteAddress || '127.0.0.1').replace('::1', '127.0.0.1');
  
  // 🆕 GEOLOCALIZACIÓN AUTOMÁTICA
  const geo = await getGeoFromIP(ipReal);
  
  const clic = {
    ip: ipReal,
    userAgent: req.headers['user-agent'] || 'desconocido',
    fecha: new Date().toISOString(),
    referrer: req.headers.referer || null,
    // 🆕 GEOLOCALIZACIÓN REAL
    ciudad: geo.ciudad,
    pais: geo.pais,
    lat: geo.lat,
    lon: geo.lon,
    isp: geo.isp
  };
  
  link.clicks.push(clic);
  saveLinks(links);
  
  res.redirect(302, link.destino);
});

// Panel de admin (con geolocalización)
app.get('/api/links', (req, res) => {
  res.json(loadLinks());
});

// 🆕 Ruta para GPS directo del navegador
app.post('/api/gps', express.json(), async (req, res) => {
  const { lat, lon, accuracy } = req.body;
  res.json({ ok: true });
  console.log(`🗺️ GPS directo: ${lat},${lon} (precisión: ${accuracy}m)`);
});

// Borrar enlace
app.delete('/api/links/:id', (req, res) => {
  const { id } = req.params;
  let links = loadLinks();
  const indice = links.findIndex(l => l.id === id);
  
  if (indice === -1) {
    return res.status(404).json({ error: 'Enlace no encontrado' });
  }
  
  links.splice(indice, 1);
  saveLinks(links);
  
  res.json({ ok: true, mensaje: `Enlace ${id} eliminado` });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor OSINT con GEOLOCALIZACIÓN en puerto ${PORT}`);
});
