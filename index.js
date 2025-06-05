const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const mysql = require('mysql2/promise');

const PORT = 3000;

const dbConfig = {
  host: '127.0.0.1',
  user: 'root',
  password: '1234',
  database: 'todolist',
  port: 3306
};

async function testConnection() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Успешное подключение к MySQL');
    await connection.end();
  } catch (error) {
    console.error('❌ Ошибка подключения к MySQL:', error.message);
    process.exit(1);
  }
}

async function retrieveListItems() {
  const connection = await mysql.createConnection(dbConfig);
  const [rows] = await connection.execute('SELECT id, text FROM items ORDER BY id');
  await connection.end();
  return rows;
}

async function addItem(text) {
  const connection = await mysql.createConnection(dbConfig);
  const [result] = await connection.execute(
    'INSERT INTO items (text) VALUES (?)',
    [text]
  );
  await connection.end();
  return result.insertId;
}

async function deleteItem(id) {
  const connection = await mysql.createConnection(dbConfig);
  await connection.execute('DELETE FROM items WHERE id = ?', [id]);
  await connection.end();
}

async function updateItem(id, text) {
  const connection = await mysql.createConnection(dbConfig);
  await connection.execute(
    'UPDATE items SET text = ? WHERE id = ?',
    [text, id]
  );
  await connection.end();
}

async function handleRequest(req, res) {
  // Добавляем CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.url === '/' && req.method === 'GET') {
    try {
      const html = await fs.readFile(path.join(__dirname, 'index.html'), 'utf8');
      const items = await retrieveListItems();
      
      const rows = items.map(item => `
        <tr data-id="${item.id}">
          <td>${item.id}</td>
          <td>${item.text}</td>
          <td>
            <button class="edit-btn" data-id="${item.id}">Edit</button>
            <button class="delete-btn" data-id="${item.id}">×</button>
          </td>
        </tr>
      `).join('');

      const processedHtml = html.replace('{{rows}}', rows);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(processedHtml);
    } catch (err) {
      console.error('Ошибка:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Ошибка загрузки страницы');
    }
  } 
  else if (req.url === '/api/items' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const { text } = JSON.parse(body);
        const id = await addItem(text);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id, text }));
      } catch (error) {
        console.error(error);
        res.writeHead(500);
        res.end('Error adding item');
      }
    });
  }
  else if (req.url.startsWith('/api/items/') && req.method === 'DELETE') {
    const id = req.url.split('/')[3];
    try {
      await deleteItem(id);
      res.writeHead(204);
      res.end();
    } catch (error) {
      console.error(error);
      res.writeHead(500);
      res.end('Error deleting item');
    }
  }
  else if (req.url.startsWith('/api/items/') && req.method === 'PUT') {
    const id = req.url.split('/')[3];
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const { text } = JSON.parse(body);
        await updateItem(id, text);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id, text }));
      } catch (error) {
        console.error(error);
        res.writeHead(500);
        res.end('Error updating item');
      }
    });
  }
  else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

async function startServer() {
  await testConnection();
  const server = http.createServer(handleRequest);
  server.listen(PORT, () => console.log(`Сервер запущен на http://localhost:${PORT}`));
}

startServer();
