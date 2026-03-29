# AccessCanvas

MCP server that connects Claude to Babson College's Canvas LMS.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create config file**
   ```bash
   mkdir -p ~/.accesscanvas
   cat > ~/.accesscanvas/config.json << 'EOF'
   {
     "token": "YOUR_CANVAS_API_TOKEN",
     "baseUrl": "https://babson.instructure.com"
   }
   EOF
   ```
   Get your token: Canvas → Account → Settings → New Access Token

3. **Build**
   ```bash
   npm run build
   ```

4. **Connect to Claude Desktop**

   Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "accesscanvas": {
         "command": "node",
         "args": ["/Users/ishanpatel/Projects/AccessCanvas/dist/index.js"]
       }
     }
   }
   ```
   Restart Claude Desktop.

## Tools

| Tool | Description |
|------|-------------|
| `get_courses` | List enrolled courses |
| `get_upcoming_assignments` | Assignments due soon |
| `get_grades` | Current grades |
| `get_announcements` | Recent announcements |
| `get_assignment_details` | Assignment details + files |
| `get_course_modules` | Course module structure |
| `get_module_item` | Page or file content |
| `download_files` | Download files to ~/Canvas/ |

## File Storage

Downloaded files land at `~/Canvas/{CourseName}/{Context}/`.
Cache stored at `~/.accesscanvas/cache.db`.
