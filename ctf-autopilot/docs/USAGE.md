# User Guide

Complete guide for using CTF Compass. This document covers the web interface, job creation, analysis workflow, and best practices.

**GitHub:** [github.com/huynhtrungcipp/ctf-compass](https://github.com/huynhtrungcipp/ctf-compass)

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Web Interface Overview](#web-interface-overview)
3. [Configuration](#configuration)
4. [Creating Analysis Jobs](#creating-analysis-jobs)
5. [Understanding Results](#understanding-results)
6. [Working with Writeups](#working-with-writeups)
7. [Best Practices](#best-practices)
8. [FAQ](#faq)

---

## Getting Started

### Accessing the Application

1. Open your browser and navigate to:
   - **Local**: `http://localhost:3000`
   - **Server**: `http://<your-server-ip>:3000`

2. Login with your admin credentials:
   - **Username**: `admin`
   - **Password**: (from `CREDENTIALS.txt` or your configured password)

### First-Time Setup

1. **Configure API Key**: 
   - Click the Settings icon (⚙️) in the navigation
   - Enter your MegaLLM API key in the "API Configuration" section
   - Click "Test Connection" to verify
   - Click "Save Changes"

2. **Select AI Models** (Optional):
   - Choose models for analysis, writeup generation, and flag extraction
   - Free/cheap models are marked with green checkmarks

3. **Verify System Status**:
   - Check that current version is displayed
   - "Check Updates" button should work

---

## Web Interface Overview

### Navigation

CTF Compass uses a modern top navigation bar:

| Element | Location | Description |
|---------|----------|-------------|
| **Logo** | Top left | Click to go to Dashboard |
| **Dashboard** | Top nav | View all jobs and statistics |
| **New Analysis** | Top nav | Create a new analysis job |
| **Settings** | Top right (⚙️) | System configuration |
| **User Menu** | Top right | Profile, logout options |

### Dashboard Elements

- **Statistics Cards**: Total jobs, running, completed, failed
- **Recent Jobs**: List of recent analysis jobs with status
- **Quick Actions**: Create new job, view details

---

## Configuration

### API Key Setup

The API key can be configured in two ways:

**1. Via Web Interface (Recommended):**
- Go to Settings page
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

### Model Selection

Choose different AI models for each task:

| Task | Description | Recommended Model |
|------|-------------|-------------------|
| **Analysis** | Analyzing challenge files | llama3.3-70b-instruct |
| **Writeup** | Generating writeups | llama3.3-70b-instruct |
| **Extraction** | Flag extraction | openai-gpt-oss-20b |

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

## Creating Analysis Jobs

### Step 1: Basic Information

1. Click **New Analysis** in the navigation
2. Enter job details:

| Field | Description | Example |
|-------|-------------|---------|
| **Title** | Descriptive name | "picoCTF 2024 - forensics_corruption" |
| **Description** | Challenge description, hints | Full challenge text from CTF |
| **Flag Format** | Regex pattern for flags | `picoCTF\{[^}]+\}` |

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

### Step 3: Submit & Monitor

1. Click **Start Analysis**
2. Job enters queue and starts processing
3. Monitor progress on Dashboard or Job Detail page

**Job Status Flow:**
```
QUEUED → RUNNING → ANALYZING → EXTRACTING → GENERATING → COMPLETED
```

---

## Understanding Results

### Job Details Page

After analysis completes:

#### 1. Summary Tab
- Status, duration, files analyzed, flags found

#### 2. Commands Tab
- List of executed tools with output
- Exit codes and execution time

#### 3. Artifacts Tab
- `strings_output.txt`: Extracted strings
- `file_info.txt`: File type identification
- `exif_data.json`: Image metadata
- `binwalk_output.txt`: Embedded signatures

#### 4. Flags Tab
- Extracted flag candidates with confidence scores
- Source context for each candidate

#### 5. Writeup Tab
- AI-generated writeup with:
  - Challenge overview
  - Step-by-step solution
  - Flag extraction
  - Learning points

---

## Working with Writeups

### Export Options

- **Markdown**: Download as `.md` file
- **PDF**: Generate PDF document
- **Copy**: Copy to clipboard

### Editing Writeups

1. Click **Edit** on the Writeup tab
2. Modify content using Markdown editor
3. Click **Save** to update

---

## Best Practices

### For Better Results

1. **Provide Full Context**
   - Include complete challenge description
   - Add any hints provided

2. **Use Accurate Flag Format**
   - Specify exact regex pattern
   - Example: `flag\{[a-zA-Z0-9_]+\}`

3. **Upload All Relevant Files**
   - Include all challenge files
   - Don't forget related configs

4. **Choose Appropriate Models**
   - Complex challenges: Use larger models
   - Simple challenges: Fast models work fine

---

## FAQ

### Q: How long does analysis take?

**A:** Depends on file size and complexity:
- Small text files: 10-30 seconds
- Medium binaries: 1-3 minutes
- Large archives: 3-10 minutes

### Q: What if analysis fails?

**A:** Check:
1. File type is supported
2. File size within limits
3. API key is configured correctly
4. Check job error message for details

### Q: Can I use this during a live CTF?

**A:** Yes, but:
- This is for analysis assistance
- Always verify flags manually
- Learn the techniques

### Q: Are my files kept private?

**A:** Yes, all data stays local:
- Files stored on your server only
- No data sent to cloud (except MegaLLM API for AI features)
- You control data retention

### Q: How do I update the system?

**A:** Two options:
1. Via Settings page → "Update Now" button
2. Via command: `sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh`

---

## Getting Help

- **Debug Guide**: [DEBUG.md](DEBUG.md)
- **Runbook**: [RUNBOOK.md](RUNBOOK.md)
- **GitHub**: [github.com/huynhtrungcipp/ctf-compass](https://github.com/huynhtrungcipp/ctf-compass)
