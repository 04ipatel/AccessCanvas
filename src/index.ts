import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { loadConfig } from './lib/config.js';
import { CanvasClient } from './lib/canvasClient.js';

import { listCourses } from './tools/listCourses.js';
import { getAssignments } from './tools/getAssignments.js';
import { getGrades } from './tools/getGrades.js';
import { getAssignmentGrades } from './tools/getAssignmentGrades.js';
import { getAnnouncements } from './tools/getAnnouncements.js';
import { getModules } from './tools/getModules.js';
import { getModuleItem } from './tools/getModuleItem.js';
import { listFiles } from './tools/listFiles.js';
import { downloadFile } from './tools/downloadFile.js';

function withMeta(data: unknown) {
  return { data, _fetchedAt: new Date().toISOString() };
}

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(withMeta(data), null, 2) }] };
}

const config = loadConfig();
const client = new CanvasClient(config);

const server = new McpServer({ name: 'accesscanvas', version: '0.1.0' });

server.tool(
  'list_courses',
  'List active enrolled courses (id, name, code, term).',
  {},
  async () => ok(await listCourses(client))
);

server.tool(
  'get_assignments',
  'List all assignments for a course with full detail: due date, points, parsed description, embedded files, and external links. Filter by date yourself — this returns the full set.',
  { courseId: z.string().describe('Canvas course ID') },
  async ({ courseId }) => ok(await getAssignments(client, courseId, config.timezone))
);

server.tool(
  'get_grades',
  'Get current course-level grades. Omit courseId for all courses.',
  { courseId: z.string().optional().describe('Canvas course ID; omit for all courses') },
  async ({ courseId }) => ok(await getGrades(client, courseId))
);

server.tool(
  'get_assignment_grades',
  'Get per-assignment scores for a course: score, points possible, grade, and missing/late flags.',
  { courseId: z.string().describe('Canvas course ID') },
  async ({ courseId }) => ok(await getAssignmentGrades(client, courseId, config.timezone))
);

server.tool(
  'get_announcements',
  'Get recent announcements for a course.',
  {
    courseId: z.string().describe('Canvas course ID'),
    limit: z.number().optional().describe('Max announcements to return (default 5)'),
  },
  async ({ courseId, limit }) => ok(await getAnnouncements(client, courseId, limit))
);

server.tool(
  'get_modules',
  'Get the full module structure for a course: modules and their items (pages, files, assignments, links).',
  { courseId: z.string().describe('Canvas course ID') },
  async ({ courseId }) => ok(await getModules(client, courseId))
);

server.tool(
  'get_module_item',
  'Get the content of one module item (page or file): plain text plus any embedded files. Get item IDs from get_modules.',
  {
    courseId: z.string().describe('Canvas course ID'),
    moduleItemId: z.string().describe('Module item ID from get_modules'),
  },
  async ({ courseId, moduleItemId }) => ok(await getModuleItem(client, courseId, moduleItemId))
);

server.tool(
  'list_files',
  'List files Canvas exposes for a course. Returns an empty list if the professor disabled file export.',
  { courseId: z.string().describe('Canvas course ID') },
  async ({ courseId }) => ok(await listFiles(client, courseId))
);

server.tool(
  'download_file',
  'Download one Canvas file to local disk. `dest` (optional): a directory — absolute, or relative to the configured downloadDir. Filename comes from Canvas. Returns the written path. Get fileId from get_assignments, get_module_item, or list_files.',
  {
    courseId: z.string().describe('Canvas course ID'),
    fileId: z.string().describe('Canvas file ID'),
    dest: z.string().optional().describe('Target directory (absolute, or relative to downloadDir). Omit for flat downloadDir.'),
  },
  async ({ courseId, fileId, dest }) => ok(await downloadFile(client, { courseId, fileId, dest }, config.downloadDir))
);

const transport = new StdioServerTransport();
await server.connect(transport);
