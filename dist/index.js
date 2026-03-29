import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadConfig } from './lib/config.js';
import { CanvasClient } from './lib/canvasClient.js';
import { openCache } from './lib/cache.js';
import { getCourses } from './tools/getCourses.js';
import { getUpcomingAssignments } from './tools/getUpcomingAssignments.js';
import { getGrades } from './tools/getGrades.js';
import { getAnnouncements } from './tools/getAnnouncements.js';
import { getAssignmentDetails } from './tools/getAssignmentDetails.js';
import { getCourseModules } from './tools/getCourseModules.js';
import { getModuleItem } from './tools/getModuleItem.js';
import { downloadFiles } from './tools/downloadFiles.js';
const config = loadConfig();
const client = new CanvasClient(config);
const cache = openCache();
const server = new McpServer({
    name: 'accesscanvas',
    version: '1.0.0',
});
server.tool('get_courses', 'List all active enrolled courses at Babson', {}, async () => {
    const courses = await getCourses(client);
    return { content: [{ type: 'text', text: JSON.stringify(courses, null, 2) }] };
});
server.tool('get_upcoming_assignments', 'List upcoming assignments due within N days. If courseId is omitted, returns assignments across all courses.', {
    courseId: z.string().optional().describe('Canvas course ID. Omit to get all courses.'),
    daysAhead: z.number().optional().describe('Number of days to look ahead. Default: 14.'),
}, async ({ courseId, daysAhead }) => {
    const allCourses = courseId ? undefined : await getCourses(client);
    const assignments = await getUpcomingAssignments(client, { courseId, daysAhead }, allCourses);
    return { content: [{ type: 'text', text: JSON.stringify(assignments, null, 2) }] };
});
server.tool('get_grades', 'Get current grades for all courses or a specific course.', {
    courseId: z.string().optional().describe('Canvas course ID. Omit to get grades for all courses.'),
}, async ({ courseId }) => {
    const grades = await getGrades(client, courseId);
    return { content: [{ type: 'text', text: JSON.stringify(grades, null, 2) }] };
});
server.tool('get_announcements', 'Get recent announcements for a course.', {
    courseId: z.string().describe('Canvas course ID'),
    limit: z.number().optional().describe('Number of announcements to return. Default: 5.'),
}, async ({ courseId, limit }) => {
    const announcements = await getAnnouncements(client, courseId, limit);
    return { content: [{ type: 'text', text: JSON.stringify(announcements, null, 2) }] };
});
server.tool('get_assignment_details', 'Get full details for a specific assignment, including any downloadable files embedded in the description.', {
    courseId: z.string().describe('Canvas course ID'),
    assignmentId: z.string().describe('Canvas assignment ID'),
}, async ({ courseId, assignmentId }) => {
    const details = await getAssignmentDetails(client, courseId, assignmentId);
    return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
});
server.tool('get_course_modules', 'Get the full module structure for a course. Cached after first fetch. Use forceRefresh to re-sync.', {
    courseId: z.string().describe('Canvas course ID'),
    forceRefresh: z.boolean().optional().describe('Re-fetch from Canvas even if cached. Default: false.'),
}, async ({ courseId, forceRefresh }) => {
    const modules = await getCourseModules(client, cache, courseId, forceRefresh);
    return { content: [{ type: 'text', text: JSON.stringify(modules, null, 2) }] };
});
server.tool('get_module_item', 'Get the content of a specific module item (a page or file). Returns plain text body and any embedded files. Call get_course_modules first to discover item IDs.', {
    courseId: z.string().describe('Canvas course ID'),
    moduleItemId: z.string().describe('Module item ID from get_course_modules'),
    forceRefresh: z.boolean().optional().describe('Re-fetch even if cached. Default: false.'),
}, async ({ courseId, moduleItemId, forceRefresh }) => {
    const content = await getModuleItem(client, cache, courseId, moduleItemId, forceRefresh);
    return { content: [{ type: 'text', text: JSON.stringify(content, null, 2) }] };
});
server.tool('download_files', 'Download Canvas files to ~/Canvas/{CourseName}/{Context}/. Get fileIds from get_assignment_details or get_module_item.', {
    files: z.array(z.object({
        fileId: z.string().describe('Canvas file ID'),
        courseId: z.string().describe('Canvas course ID'),
        courseName: z.string().describe('Human-readable course name for folder organization'),
        context: z.string().describe('Folder context, e.g. "Assignment2" or "Syllabus"'),
    })).describe('Files to download'),
}, async ({ files }) => {
    const results = await downloadFiles(client, cache, files);
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
});
const transport = new StdioServerTransport();
await server.connect(transport);
