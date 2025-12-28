# User Guide

Complete guide for using CTF Compass v2.0.0. This document covers the web interface, Full Autopilot, job creation, and analysis workflow.

**GitHub:** [github.com/huynhthanhthao-uel/ctf-compass](https://github.com/huynhthanhthao-uel/ctf-compass)

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Setup Wizard](#setup-wizard)
3. [CORS Tester](#cors-tester)
4. [Web Interface Overview](#web-interface-overview)
5. [Dashboard Features](#dashboard-features)
6. [Full Autopilot Mode](#full-autopilot-mode)
7. [Creating Analysis Jobs](#creating-analysis-jobs)
8. [Managing Jobs](#managing-jobs)
9. [Understanding Results](#understanding-results)
10. [Operation Modes](#operation-modes)
11. [Configuration](#configuration)
12. [Best Practices](#best-practices)
13. [FAQ](#faq)

---

## Getting Started

### Accessing the Application

1. Open your browser and navigate to:
   - **Local**: `http://localhost:3000`
   - **Server**: `http://<your-server-ip>:3000`

2. **No Login Required**: CTF Compass v2.0.0 removes authentication for simpler single-user deployments

### First-Time Setup

1. **Setup Wizard**: The app opens to the Setup page (`/`) where you can:
   - Configure Backend URL (for Docker deployments)
   - Test connection and CORS headers
   - Verify everything works before proceeding

2. **Check Operation Mode**: 
   - Look at the status badge in the header
   - "Connected" = Full backend available
   - "Cloud Mode" = Using Lovable Cloud Edge Functions  
   - "Demo Mode" = Using mock data

3. **Start Analyzing**: Navigate to Dashboard and click "Solve Challenge" on any job!

---

## Setup Wizard

The Setup Wizard (`/` or `/setup`) is the first page you see. It helps configure the Docker backend connection.

### Features

| Feature | Description |
|---------|-------------|
| **Backend URL Input** | Enter your Docker backend URL (e.g., `http://192.168.1.100:8000`) |
| **Test Connection** | Verify API connectivity and CORS headers |
| **Status Indicator** | Shows connection state (idle, testing, connected, error) |
| **CORS Headers Display** | Shows received CORS headers for debugging |

### How to Use

1. **Enter Backend URL**: 
   - For local Docker: `http://localhost:8000`
   - For remote server: `http://<server-ip>:8000`

2. **Click "Test Connection"**: 
   - Sends OPTIONS preflight request
   - Checks CORS headers
   - Verifies API health endpoint

3. **Review Results**:
   - ✅ Green "Connected" badge = Ready to use
   - ❌ Red "Error" badge = Check URL or CORS config

4. **Continue to Dashboard**: Click the button to proceed

### Troubleshooting Setup

| Issue | Cause | Solution |
|-------|-------|----------|
| "Connection error" | Backend not running | Start Docker containers |
| "CORS blocked" | Missing CORS headers | Check `CORS_ORIGINS` in `.env` |
| "Network error" | Firewall blocking | Open port 8000 |

---

## CORS Tester

The built-in CORS Tester (`/cors-tester`) helps diagnose cross-origin issues.

### Features

- **Preflight Test**: Sends OPTIONS request to check CORS policy
- **GET Request Test**: Tests actual API calls
- **POST Request Test**: Tests data submission
- **Health Check**: Verifies API status
- **Headers Display**: Shows all response headers
- **Response Body**: Shows API response content

### How to Use

1. Navigate to `/cors-tester` or click "CORS Tester" in Settings
2. Enter your backend URL
3. Click test buttons to run different request types
4. Review headers and response body

### Expected CORS Headers

For proper operation, your backend should return:

```
Access-Control-Allow-Origin: * (or your frontend origin)
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 600
```

---

## Web Interface Overview

### Navigation

CTF Compass uses a modern top navigation bar:

| Element | Location | Description |
|---------|----------|-------------|
| **Logo** | Top left | Click to go to Setup/Dashboard |
| **Dashboard** | Top nav | View all jobs and statistics |
| **New Analysis** | Top nav | Create a new analysis job |
| **Backend Status** | Top right | Shows operation mode |
| **Notifications** | Top right (🔔) | View alerts and updates |
| **Settings** | Top right (⚙️) | System configuration |

### Status Indicators

| Badge | Meaning |
|-------|---------|
| `Demo Mode` (amber) | No backend/cloud, using mock data |
| `Cloud Mode` (cyan) | Using Lovable Cloud Edge Functions |
| `Connected` (blue) | Local backend API available |
| `Live` (green + pulse) | WebSocket connected, real-time updates |

---

## Dashboard Features

### Statistics Cards

The dashboard shows real-time job statistics:

| Card | Description |
|------|-------------|
| **Total Jobs** | All jobs in the system |
| **Queued** | Jobs waiting to run |
| **Running** | Currently executing jobs |
| **Completed** | Successfully finished jobs |
| **Failed** | Jobs that encountered errors |

### Job List

- **Grid View**: Card-based layout (default)
- **List View**: Compact table format
- **Search**: Filter jobs by title or description
- **Refresh**: Manually reload job list

### Job Cards

Each job card shows:
- **Category Badge**: Crypto, Pwn, Web, Rev, Forensics, Misc
- **Title**: Job name (click to view details)
- **Description**: Brief summary
- **Status Badge**: Queued, Running, Completed, Failed
- **Progress Bar**: For running jobs
- **Timestamp**: Time since creation
- **Actions Menu** (⋮): View, Run, Stop, Delete

---

## Full Autopilot Mode

### Overview

Full Autopilot is the primary way to analyze CTF challenges. It automates the entire analysis process with one click.

### How to Use

1. **Navigate to a Job**: Click on any job card to open Job Detail page
2. **Click "Solve Challenge"**: The big button in the Autopilot tab
3. **Watch the Progress**: See real-time updates through 4 phases
4. **Get Results**: Flags, solve scripts, and analysis

### The 4 Phases

#### Phase 1: Initial Analysis (0-25%)
- Lists all challenge files
- Identifies file types
- Extracts readable strings
- Detects challenge category

#### Phase 2: Deep Scan (25-50%)
- Runs category-specific tools
- Analyzes file structure
- Looks for patterns and clues
- Builds context for AI

#### Phase 3: AI Reasoning (50-75%)
- Sends context to AI
- Analyzes challenge mechanics
- Generates solve strategy
- Creates solve script

#### Phase 4: Flag Extraction (75-100%)
- Executes solve script
- Parses output for flags
- Validates flag format
- Reports results

### What You'll See

- **Progress Bar**: Animated progress through phases
- **Phase Indicator**: Current phase with description
- **Detected Category**: Auto-detected challenge type
- **Current Strategy**: What the AI is doing
- **Found Flags**: Extracted flag candidates
- **Solve Script**: Generated Python script

### After Completion

- Job status updates to "Completed"
- Flags displayed with copy button
- Solve script available for download
- Full analysis history preserved

---

## Creating Analysis Jobs

### Step 1: Basic Information

1. Click **New Analysis** in the navigation
2. Enter job details:

| Field | Description | Example |
|-------|-------------|---------|
| **Title** | Descriptive name | "picoCTF 2024 - forensics_corruption" |
| **Description** | Challenge description, hints | Full challenge text from CTF |
| **Category** | Challenge type | Crypto, Pwn, Web, Rev, Forensics, Misc |
| **Flag Format** | Regex pattern for flags | `picoCTF\{[^}]+\}` |
| **Challenge URL** | (Optional) Link to challenge | `https://play.picoctf.org/...` |

### Step 2: Remote Connection (Netcat)

For PWN or remote challenges that require `nc`:

1. Toggle **"Remote Connection (nc)"** switch to ON
2. Enter connection details:

| Field | Description | Example |
|-------|-------------|---------|
| **Host** | Server hostname or IP | `pwn.example.com` |
| **Port** | Service port | `9999` |

The form will show the resulting command: `nc pwn.example.com 9999`

**Auto-detection**: If your description contains `nc host port`, the form will automatically enable netcat and fill in the host/port fields.

### Step 3: File Upload

Upload challenge files by:
- **Drag & Drop**: Drag files onto the upload zone
- **Click to Browse**: Click and select files
- **Multiple Files**: Upload multiple files at once

**Supported File Types:**
- Archives: `.zip`, `.tar`, `.gz`, `.7z`
- Documents: `.txt`, `.pdf`, `.md`
- Images: `.png`, `.jpg`, `.gif`, `.bmp`
- Binary: `.elf`, `.exe`, `.dll`, `.so`, `.bin`
- Network: `.pcap`, `.pcapng`
- Code: `.py`, `.c`, `.cpp`, `.java`, `.js`

### Step 4: Submit & Analyze

1. Click **Create Job**
2. Job appears on Dashboard
3. Click on job to open detail page
4. Click **Solve Challenge** to start Full Autopilot
5. For netcat challenges, use the **Netcat** tab for interactive connections

---

## Managing Jobs

### Starting Analysis

- Click **Solve Challenge** button on Job Detail page
- Or click **Run** button on job card
- Or select "Run Analysis" from actions menu (⋮)

### Stopping Jobs

To cancel a running analysis:
1. Click **Stop** button on the job card
2. Or select "Stop Analysis" from actions menu
3. Job status changes to "Failed" with "Cancelled by user" message

### Deleting Jobs

To remove a job:
1. Click the actions menu (⋮) on the job card
2. Select "Delete Job"
3. Confirm deletion in the dialog
4. Job and all associated data are removed

---

## Understanding Results

### Job Details Page

After analysis completes, you'll see several tabs:

#### 1. AI Analysis Tab
- **Solve Challenge** button for Full Autopilot
- **Found Flags** with copy functionality
- **Solve Script** with download option
- **Analysis Progress** visualization

#### 2. History Tab
- Previous analysis runs
- Apply successful strategies to new jobs

#### 3. Terminal Tab
- Interactive sandbox terminal
- Execute CTF tools manually
- Command autocomplete

#### 4. Commands Tab
- List of executed tools with output
- Exit codes and execution time
- Searchable command history

#### 5. Artifacts Tab
- `strings_output.txt`: Extracted strings
- `file_info.txt`: File type identification
- `checksec_output.txt`: Binary security features
- `solve_script.py`: Generated solve script

#### 6. Flags Tab
- Extracted flag candidates
- Confidence scores
- Source context for each candidate

#### 7. Writeup Tab
- AI-generated writeup with:
  - Challenge overview
  - Step-by-step solution
  - Flag extraction
  - Learning points

#### 8. Netcat Tab (for remote challenges)
- **Connect**: Enter host:port and connect
- **Interactive Terminal**: Send/receive messages
- **AI Solve Script**: Generate pwntools script from interactions
- **Copy Script**: Export to clipboard or file

---

## Operation Modes

### Connected Mode

**When**: Local backend is running and accessible

**Features**:
- ✅ Full database persistence
- ✅ Real Docker sandbox execution
- ✅ Celery background workers
- ✅ WebSocket real-time updates
- ✅ File upload and storage
- ✅ Complete job history

**Setup**: Configure Backend URL in Setup Wizard

### Cloud Mode

**When**: Local backend unavailable, Lovable Cloud accessible

**Features**:
- ✅ AI-powered analysis via Edge Functions
- ✅ Simulated terminal execution
- ✅ Full Autopilot functionality
- ✅ Category detection
- ⚠️ Session-only storage (no persistence)
- ⚠️ Mock job data

**Indicators**:
- Cyan "Cloud Mode" badge in header
- "Using Cloud AI" message in Autopilot

### Demo Mode

**When**: No backend and no cloud available

**Features**:
- ✅ Full UI navigation
- ✅ Mock job data
- ✅ Simulated progress
- ⚠️ No real analysis
- ⚠️ No AI features

**Escape Demo Mode**: 
1. Go to Setup Wizard (`/`)
2. Configure Backend URL
3. Test connection
4. Or ensure Cloud is accessible

---

## Configuration

### Backend URL Setup (v2.0.0)

The Backend URL can be configured in:

**1. Setup Wizard (Recommended):**
- Navigate to `/` or `/setup`
- Enter your Docker backend URL
- Test connection to verify CORS
- URL is saved to localStorage

**2. Settings Page:**
- Click Settings icon (⚙️)
- Enter Backend URL in configuration section
- Save changes

### API Key Setup

For AI analysis, configure the MegaLLM API key:

**Via Settings Page:**
- Go to Settings (⚙️ icon)
- Enter your MegaLLM API key
- Click "Test Connection" then "Save Changes"

**Via Environment File:**
```bash
sudo nano /opt/ctf-compass/.env
# Add: MEGALLM_API_KEY=your-key-here

# Restart services
cd /opt/ctf-compass
docker compose -f ctf-autopilot/infra/docker-compose.yml restart
```

> **Note**: Cloud Mode uses Lovable AI and doesn't require an API key!

### Model Selection

Choose different AI models for each task:

| Task | Description | Recommended Model |
|------|-------------|-------------------|
| **Analysis** | Analyzing challenge files | gemini-2.5-flash |
| **Writeup** | Generating writeups | gemini-2.5-pro |
| **Extraction** | Flag extraction | gemini-2.5-flash |

### CORS Configuration

For Docker deployments, ensure CORS is configured:

```bash
# In /opt/ctf-compass/.env
CORS_ORIGINS=http://192.168.1.100:3000,http://localhost:3000
```

Use the CORS Tester (`/cors-tester`) to verify configuration.

---

## Best Practices

### For Better Results

1. **Provide Full Context**
   - Include complete challenge description
   - Add any hints provided
   - Mention the CTF name and category

2. **Use Accurate Flag Format**
   - Specify exact regex pattern
   - Example: `flag\{[a-zA-Z0-9_]+\}`
   - Include CTF-specific prefix

3. **Upload All Relevant Files**
   - Include all challenge files
   - Don't forget related configs
   - Upload source code if available

4. **Let Full Autopilot Run**
   - Don't interrupt the process
   - Wait for all 4 phases
   - Check generated solve script

### Performance Tips

1. **Use Setup Wizard First**
   - Always test connection before use
   - Verify CORS headers are correct
   - Troubleshoot with CORS Tester

2. **Use Connected Mode for Deep Analysis**
   - Real tool execution
   - Persistent results
   - Better for complex challenges

3. **Use Cloud Mode for Quick Analysis**
   - Works without local backend
   - Fast AI responses
   - Great for initial exploration

4. **Clean Up Old Jobs**
   - Delete completed jobs you no longer need
   - Free up disk space

---

## FAQ

### Q: How do I start analyzing a challenge?

**A:** 
1. Configure backend in Setup Wizard (if using Docker)
2. Create a job with challenge files
3. Open the job detail page
4. Click "Solve Challenge" button
5. Wait for Full Autopilot to complete

### Q: Why is there no login page?

**A:** CTF Compass v2.0.0 removes authentication for simpler single-user deployments. The app is designed for personal CTF practice and doesn't require user management.

### Q: How do I configure the Docker backend?

**A:**
1. Go to Setup Wizard (`/`)
2. Enter your backend URL (e.g., `http://192.168.1.100:8000`)
3. Click "Test Connection"
4. If successful, click "Continue to Dashboard"

### Q: What's the difference between Cloud Mode and Connected Mode?

**A:**
- **Connected Mode**: Full local backend with Docker sandbox, real tool execution
- **Cloud Mode**: Uses Lovable Cloud Edge Functions, simulated execution, AI analysis

### Q: Why am I seeing "Demo Mode"?

**A:** Neither backend nor cloud is available:
1. Check if backend containers are running: `docker compose ps`
2. Configure Backend URL in Setup Wizard
3. Use CORS Tester to diagnose issues
4. Check internet connection for Cloud Mode

### Q: How do I fix CORS errors?

**A:**
1. Go to CORS Tester (`/cors-tester`)
2. Test your backend URL
3. Check if `Access-Control-Allow-Origin` header is present
4. Update `CORS_ORIGINS` in your `.env` file
5. Restart Docker containers

### Q: Can I use this during a live CTF?

**A:** Yes, but:
- This is for analysis assistance
- Always verify flags manually
- Learn the techniques
- Cloud Mode is fast for quick analysis

### Q: Are my files kept private?

**A:** Yes, all data stays local (Connected Mode) or in your Lovable project (Cloud Mode):
- Connected: Files stored on your server only
- Cloud: Processed via Edge Functions, not stored
- No data sent to third parties

### Q: How do I get the solve script?

**A:**
1. Run Full Autopilot on a job
2. Wait for Phase 3 (AI Reasoning)
3. Script appears in the "Solve Script" section
4. Click "Download" to save it

### Q: What categories are supported?

**A:**
- **Crypto**: RSA, AES, XOR, hashing
- **Pwn**: Buffer overflow, ROP, format string
- **Web**: SQLi, XSS, SSRF, file upload
- **Rev**: Crackme, keygen, obfuscation
- **Forensics**: Memory, disk, network, stego
- **Misc**: Encoding, OSINT, misc

### Q: How accurate is the AI analysis?

**A:** The AI provides:
- Good initial direction
- Category-specific strategies
- Working solve scripts for common patterns
- May need manual adjustments for complex challenges

---

## Getting Help

- **Setup Issues**: Use CORS Tester (`/cors-tester`) to diagnose
- **Debugging Guide**: [DEBUG.md](./DEBUG.md)
- **Runbook**: [RUNBOOK.md](./RUNBOOK.md)
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **GitHub Issues**: [github.com/huynhthanhthao-uel/ctf-compass/issues](https://github.com/huynhthanhthao-uel/ctf-compass/issues)
