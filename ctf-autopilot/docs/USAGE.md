# User Guide

Complete guide for using CTF Compass. This document covers the web interface, Full Autopilot, job creation, and analysis workflow.

**GitHub:** [github.com/HaryLya/ctf-compass](https://github.com/HaryLya/ctf-compass)

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Web Interface Overview](#web-interface-overview)
3. [Dashboard Features](#dashboard-features)
4. [Full Autopilot Mode](#full-autopilot-mode)
5. [Creating Analysis Jobs](#creating-analysis-jobs)
6. [Managing Jobs](#managing-jobs)
7. [Understanding Results](#understanding-results)
8. [Operation Modes](#operation-modes)
9. [Configuration](#configuration)
10. [Best Practices](#best-practices)
11. [FAQ](#faq)

---

## Getting Started

### Accessing the Application

1. Open your browser and navigate to:
   - **Local**: `http://localhost:3000`
   - **Server**: `http://<your-server-ip>:3000`

2. Login with your admin credentials:
   - **Password**: `admin` (default)

### First-Time Setup

1. **Check Operation Mode**: 
   - Look at the status badge in the header
   - "Connected" = Full backend available
   - "Cloud Mode" = Using Lovable Cloud Edge Functions
   - "Demo Mode" = Using mock data

2. **Configure API Key** (Optional for Cloud Mode): 
   - Click the Settings icon (⚙️) in the navigation
   - Enter your MegaLLM API key in the "API Configuration" section
   - Click "Test Connection" to verify
   - Click "Save Changes"

3. **Start Analyzing**: Click "Solve Challenge" on any job!

---

## Web Interface Overview

### Navigation

CTF Compass uses a modern top navigation bar:

| Element | Location | Description |
|---------|----------|-------------|
| **Logo** | Top left | Click to go to Dashboard |
| **Dashboard** | Top nav | View all jobs and statistics |
| **New Analysis** | Top nav | Create a new analysis job |
| **Backend Status** | Top right | Shows operation mode |
| **Notifications** | Top right (🔔) | View alerts and updates |
| **Settings** | Top right (⚙️) | System configuration |
| **User Menu** | Top right | Profile, logout options |

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

### Step 2: File Upload

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

### Step 3: Submit & Analyze

1. Click **Create Job**
2. Job appears on Dashboard
3. Click on job to open detail page
4. Click **Solve Challenge** to start Full Autopilot

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

#### 1. Autopilot Tab
- **Solve Challenge** button for Full Autopilot
- **Found Flags** with copy functionality
- **Solve Script** with download option
- **Analysis Progress** visualization

#### 2. Commands Tab
- List of executed tools with output
- Exit codes and execution time
- Searchable command history

#### 3. Artifacts Tab
- `strings_output.txt`: Extracted strings
- `file_info.txt`: File type identification
- `checksec_output.txt`: Binary security features
- `solve_script.py`: Generated solve script

#### 4. Flags Tab
- Extracted flag candidates
- Confidence scores
- Source context for each candidate

#### 5. Writeup Tab
- AI-generated writeup with:
  - Challenge overview
  - Step-by-step solution
  - Flag extraction
  - Learning points

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

---

## Configuration

### API Key Setup

The API key can be configured in two ways:

**1. Via Web Interface (Recommended):**
- Go to Settings page (⚙️ icon)
- Enter your MegaLLM API key
- Click "Test Connection" then "Save Changes"
- Key is automatically synced to backend

**2. Via Environment File:**
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

### System Updates

Updates can be triggered from the Settings page:
1. Click "Check Updates" to check for new versions
2. If update is available, click "Update Now"
3. System will automatically backup, update, and restart

Manual update:
```bash
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh
```

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

1. **Use Cloud Mode for Quick Analysis**
   - Works without local backend
   - Fast AI responses
   - Great for initial exploration

2. **Use Connected Mode for Deep Analysis**
   - Real tool execution
   - Persistent results
   - Better for complex challenges

3. **Clean Up Old Jobs**
   - Delete completed jobs you no longer need
   - Free up disk space

---

## FAQ

### Q: How do I start analyzing a challenge?

**A:** 
1. Create a job with challenge files
2. Open the job detail page
3. Click "Solve Challenge" button
4. Wait for Full Autopilot to complete

### Q: What's the difference between Cloud Mode and Connected Mode?

**A:**
- **Connected Mode**: Full local backend with Docker sandbox, real tool execution
- **Cloud Mode**: Uses Lovable Cloud Edge Functions, simulated execution, AI analysis

### Q: Why am I seeing "Demo Mode"?

**A:** Neither backend nor cloud is available:
1. Check if backend containers are running: `docker compose ps`
2. Check internet connection for Cloud Mode
3. Click the badge to retry connection

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

- **Debug Guide**: [DEBUG.md](DEBUG.md)
- **Runbook**: [RUNBOOK.md](RUNBOOK.md)
- **Architecture**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **GitHub**: [github.com/HaryLya/ctf-compass](https://github.com/HaryLya/ctf-compass)
