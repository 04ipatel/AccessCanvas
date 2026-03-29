import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
export function openCache(dbPath) {
    const resolvedPath = dbPath ?? join(homedir(), '.accesscanvas', 'cache.db');
    if (resolvedPath !== ':memory:') {
        mkdirSync(dirname(resolvedPath), { recursive: true });
    }
    const db = new Database(resolvedPath);
    db.exec(`
    CREATE TABLE IF NOT EXISTS module_structure (
      course_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cached_pages (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS downloaded_files (
      file_id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      local_path TEXT NOT NULL,
      display_name TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );
  `);
    return {
        getModuleStructure(courseId) {
            const row = db
                .prepare('SELECT data FROM module_structure WHERE course_id = ?')
                .get(courseId);
            return row ? JSON.parse(row.data) : null;
        },
        setModuleStructure(courseId, data) {
            db.prepare('INSERT OR REPLACE INTO module_structure (course_id, data, fetched_at) VALUES (?, ?, ?)').run(courseId, JSON.stringify(data), new Date().toISOString());
        },
        getPage(itemId) {
            const row = db
                .prepare('SELECT * FROM cached_pages WHERE id = ?')
                .get(itemId);
            if (!row)
                return null;
            return {
                id: row.id,
                courseId: row.course_id,
                title: row.title,
                content: row.content,
                fetchedAt: row.fetched_at,
            };
        },
        setPage(itemId, courseId, title, content) {
            db.prepare('INSERT OR REPLACE INTO cached_pages (id, course_id, title, content, fetched_at) VALUES (?, ?, ?, ?, ?)').run(itemId, courseId, title, content, new Date().toISOString());
        },
        recordDownloadedFile(fileId, courseId, localPath, displayName) {
            db.prepare('INSERT OR REPLACE INTO downloaded_files (file_id, course_id, local_path, display_name, fetched_at) VALUES (?, ?, ?, ?, ?)').run(fileId, courseId, localPath, displayName, new Date().toISOString());
        },
        getDownloadedFile(fileId) {
            const row = db
                .prepare('SELECT * FROM downloaded_files WHERE file_id = ?')
                .get(fileId);
            if (!row)
                return null;
            return {
                fileId: row.file_id,
                courseId: row.course_id,
                localPath: row.local_path,
                displayName: row.display_name,
                fetchedAt: row.fetched_at,
            };
        },
    };
}
