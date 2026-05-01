import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.join(__dirname, '../../storage/memory-books');

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

const router = Router();
router.use(authenticate);

// GET /api/admin/events/:eventId/memory-book
router.get('/:eventId/memory-book', requirePermission('events.view'), async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const { rows: books } = await pool.query('SELECT * FROM memory_books WHERE event_id = $1', [eventId]);

    res.json({ data: books.length ? books[0] : null });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/events/:eventId/memory-book/generate
router.post('/:eventId/memory-book/generate', requirePermission('events.edit'), async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { includeGuestNames = true, includeVoice = true, includeText = true } = req.body;

    const { rows: events } = await pool.query(`
      SELECT e.*, c.name as client_name 
      FROM events e 
      JOIN clients c ON e.client_id = c.id 
      WHERE e.id = $1
    `, [eventId]);

    if (!events.length) {
      throw new AppError('Event not found', 404, 'NOT_FOUND');
    }
    const event = events[0];

    const { rows: submissions } = await pool.query(
      `SELECT s.*, g.name as guest_name, g.name_ar as guest_name_ar 
       FROM guest_submissions s 
       LEFT JOIN guests g ON s.guest_id = g.id 
       WHERE s.event_id = $1 AND s.status = $2`,
      [eventId, 'approved']
    );

    const textSubmissions = includeText ? submissions.filter(s => s.submission_type === 'text') : [];
    const voiceSubmissions = includeVoice ? submissions.filter(s => s.submission_type === 'voice') : [];

    const html = generateMemoryBookHTML(event, textSubmissions, voiceSubmissions, includeGuestNames);

    const filename = `memory-book-${eventId}.html`;
    const filePath = path.join(STORAGE_DIR, filename);
    fs.writeFileSync(filePath, html);

    const htmlUrl = `/storage/memory-books/${filename}`;
    const settings = JSON.stringify({ includeGuestNames, includeVoice, includeText });

    const { rows: existing } = await pool.query('SELECT id FROM memory_books WHERE event_id = $1', [eventId]);

    if (existing.length) {
      await pool.query(
        'UPDATE memory_books SET html_url = $1, settings = $2, generated_at = NOW(), updated_at = NOW() WHERE event_id = $3',
        [htmlUrl, settings, eventId]
      );
    } else {
      await pool.query(
        'INSERT INTO memory_books (id, event_id, html_url, settings, generated_at) VALUES ($1, $2, $3, $4, NOW())',
        [uuidv4(), eventId, htmlUrl, settings]
      );
    }

    const { rows: book } = await pool.query('SELECT * FROM memory_books WHERE event_id = $1', [eventId]);

    res.json({ data: book[0], message: 'Memory book generated successfully' });
  } catch (error) {
    next(error);
  }
});

function generateMemoryBookHTML(event, textSubmissions, voiceSubmissions, includeGuestNames) {
  const eventDate = new Date(event.start_datetime).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${event.name_ar || event.name} - Memory Book</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans Arabic', sans-serif; background: linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%); min-height: 100vh; padding: 2rem; }
    .container { max-width: 800px; margin: 0 auto; }
    .header { text-align: center; padding: 3rem 2rem; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); border-radius: 24px; color: white; margin-bottom: 2rem; }
    .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .header .date { font-size: 1.125rem; opacity: 0.9; }
    .section { background: white; border-radius: 16px; padding: 2rem; margin-bottom: 2rem; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
    .section h2 { font-size: 1.25rem; color: #7c3aed; margin-bottom: 1.5rem; padding-bottom: 0.75rem; border-bottom: 2px solid #f3f4f6; }
    .message { padding: 1.25rem; background: #faf5ff; border-radius: 12px; margin-bottom: 1rem; border-right: 4px solid #a855f7; }
    .message p { font-size: 1.125rem; line-height: 1.8; color: #374151; }
    .message .author { margin-top: 0.75rem; font-weight: 600; color: #7c3aed; }
    .audio-message { padding: 1rem; background: #f3f4f6; border-radius: 12px; margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem; }
    .audio-message audio { flex: 1; }
    .audio-message .author { font-weight: 600; color: #374151; }
    .footer { text-align: center; padding: 2rem; color: #9ca3af; font-size: 0.875rem; }
    .empty { text-align: center; color: #9ca3af; padding: 2rem; }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>💍 ${event.name_ar || event.name}</h1>
      <p class="date">${eventDate}</p>
    </header>
    ${textSubmissions.length > 0 ? `
    <section class="section">
      <h2>رسائل من الأحباب</h2>
      ${textSubmissions.map(s => `
        <div class="message">
          <p>${escapeHtml(s.content)}</p>
          ${includeGuestNames && (s.guest_name_ar || s.guest_name) ? `<p class="author">— ${s.guest_name_ar || s.guest_name}</p>` : ''}
        </div>
      `).join('')}
    </section>` : ''}
    ${voiceSubmissions.length > 0 ? `
    <section class="section">
      <h2>رسائل صوتية</h2>
      ${voiceSubmissions.map(s => `
        <div class="audio-message">
          <audio controls src="${s.file_url}"></audio>
          ${includeGuestNames && (s.guest_name_ar || s.guest_name) ? `<span class="author">${s.guest_name_ar || s.guest_name}</span>` : ''}
        </div>
      `).join('')}
    </section>` : ''}
    ${textSubmissions.length === 0 && voiceSubmissions.length === 0 ? `
    <section class="section"><p class="empty">لا توجد رسائل معتمدة بعد</p></section>` : ''}
    <footer class="footer"><p>تم إنشاء هذا الكتاب عبر منصة رواج</p></footer>
  </div>
</body>
</html>`;
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export default router;
