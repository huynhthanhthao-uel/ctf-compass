# User Guide

Complete guide for using CTF Autopilot Analyzer. This document covers the web interface, job creation, analysis workflow, and best practices.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Web Interface Overview](#web-interface-overview)
3. [Creating Analysis Jobs](#creating-analysis-jobs)
4. [Understanding Results](#understanding-results)
5. [Working with Writeups](#working-with-writeups)
6. [Best Practices](#best-practices)
7. [Keyboard Shortcuts](#keyboard-shortcuts)
8. [FAQ](#faq)

---

## Getting Started

### Accessing the Application

1. Open your browser and navigate to:
   - **Local**: `http://localhost:3000`
   - **Server**: `http://<your-server-ip>:3000`

2. Login with your admin credentials:
   - **Username**: `admin`
   - **Password**: (the password generated during installation, found in `CREDENTIALS.txt`)

### First-Time Setup

Before analyzing challenges, verify your setup:

1. **Check Configuration**: Go to **Configuration** page
2. **Verify API Key**: Ensure MegaLLM API key is configured
3. **Select Models**: Choose analysis and writeup generation models
4. **Test Connection**: Use the test button to verify API connectivity

---

## Web Interface Overview

### Navigation

| Section | Description |
|---------|-------------|
| **Dashboard** | Overview of all jobs, statistics, recent activity |
| **New Job** | Create a new analysis job |
| **Job Details** | View job results, artifacts, writeup |
| **Configuration** | System settings, API keys, model selection |

### Dashboard Elements

```
┌─────────────────────────────────────────────────────────────┐
│  CTF Autopilot                    [Config] [New Job] [User] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐   │
│  │ Total: 42 │ │Running: 2 │ │Done: 38   │ │Failed: 2  │   │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘   │
│                                                             │
│  Recent Jobs                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ▶ Web Challenge 1          │ completed │ 2 flags    │   │
│  │ ▶ Crypto - RSA Basic       │ running   │ analyzing  │   │
│  │ ▶ Forensics - Memory Dump  │ completed │ 1 flag     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Creating Analysis Jobs

### Step 1: Basic Information

1. Click **New Job** or the `+` button
2. Enter job details:

| Field | Description | Example |
|-------|-------------|---------|
| **Title** | Descriptive name for the challenge | "picoCTF 2024 - forensics_corruption" |
| **Description** | Challenge description, hints, context | Full challenge text from CTF |
| **Flag Format** | Regex pattern for flags | `picoCTF\{[^}]+\}` |
| **Category** | Challenge category | Forensics, Crypto, Web, etc. |

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

**Upload Limits:**
- Maximum file size: 200MB (configurable)
- Maximum total size: 500MB per job

### Step 3: Analysis Options

Configure analysis settings:

| Option | Description | Recommendation |
|--------|-------------|----------------|
| **Analysis Model** | AI model for analysis | `llama3.3-70b-instruct` (fast, free) |
| **Writeup Model** | AI model for writeup | `gpt-4o` (best quality) |
| **Deep Analysis** | Run extended analysis | Enable for complex challenges |
| **Extract Archives** | Auto-extract zip/tar | Usually enabled |

### Step 4: Submit & Monitor

1. Click **Start Analysis**
2. Job enters queue and starts processing
3. Monitor progress on Dashboard or Job Details page

**Job Status Flow:**
```
QUEUED → RUNNING → ANALYZING → EXTRACTING → GENERATING → COMPLETED
                                                    ↓
                                                 FAILED
```

---

## Understanding Results

### Job Details Page

After analysis completes, the Job Details page shows:

#### 1. Summary Tab

- **Status**: Current job status
- **Duration**: Time taken for analysis
- **Files Analyzed**: Number of files processed
- **Flags Found**: Candidate flags extracted

#### 2. Artifacts Tab

View all analysis outputs:

| Artifact Type | Description |
|---------------|-------------|
| **strings_output.txt** | Extracted printable strings |
| **file_info.txt** | File type identification |
| **exif_data.json** | Metadata from images |
| **binwalk_output.txt** | Embedded file signatures |
| **hex_dump.txt** | Hexadecimal representation |

#### 3. Evidence Tab

Extracted evidence with confidence scores:

```json
{
  "flags": [
    {
      "value": "picoCTF{corrupted_but_recovered_abc123}",
      "confidence": 0.95,
      "source": "strings analysis",
      "context": "Found in file header at offset 0x100"
    }
  ],
  "indicators": [
    {
      "type": "encoding",
      "value": "base64",
      "location": "file.txt:42"
    }
  ]
}
```

#### 4. Commands Tab

View executed analysis commands:

```
[✓] file challenge.bin          (0.2s)
[✓] strings -n 8 challenge.bin  (0.5s)
[✓] binwalk challenge.bin       (1.2s)
[✓] xxd challenge.bin | head    (0.1s)
```

#### 5. Writeup Tab

AI-generated writeup with:
- Challenge overview
- Analysis methodology
- Step-by-step solution
- Flag extraction
- Learning points

---

## Working with Writeups

### Writeup Structure

Generated writeups follow this format:

```markdown
# Challenge: [Title]

## Overview
Brief description of the challenge type and difficulty.

## Initial Analysis
What files were provided and initial observations.

## Solution Steps
1. First step...
2. Second step...
3. Flag extraction...

## Flag
`picoCTF{the_flag_here}`

## Tools Used
- strings
- binwalk
- exiftool

## Lessons Learned
Key takeaways from this challenge.
```

### Exporting Writeups

Export options:
- **Markdown**: Download as `.md` file
- **PDF**: Generate PDF document
- **HTML**: Formatted HTML page
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
   - Mention the CTF and category

2. **Use Accurate Flag Format**
   - Specify exact regex pattern
   - Example: `flag\{[a-zA-Z0-9_]+\}`

3. **Upload All Relevant Files**
   - Include all challenge files
   - Don't forget related files (configs, scripts)

4. **Choose Appropriate Models**
   - Complex challenges: Use larger models
   - Simple challenges: Fast models work fine

### Organizing Jobs

- Use descriptive titles: `[CTF Name] - [Category] - [Challenge Name]`
- Add tags for filtering
- Archive completed jobs regularly

### Security Reminders

- Never upload files you don't have permission to analyze
- Don't upload malware without proper precautions
- Results are stored locally - protect your server

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + N` | New Job |
| `Ctrl + /` | Search |
| `Ctrl + Enter` | Submit Form |
| `Esc` | Close Modal |
| `J` / `K` | Navigate Jobs |
| `Enter` | Open Selected Job |
| `?` | Show Shortcuts |

---

## FAQ

### Q: How long does analysis take?

**A:** Depends on file size and complexity:
- Small text files: 10-30 seconds
- Medium binaries: 1-3 minutes
- Large archives: 3-10 minutes
- Deep analysis: Add 50% more time

### Q: What if analysis fails?

**A:** Check these common causes:
1. Unsupported file type
2. File too large
3. Timeout (complex files)
4. API key issues

### Q: Can I analyze multiple files together?

**A:** Yes! Upload all related files to the same job. The analyzer will process them as a set and correlate findings.

### Q: How accurate is flag detection?

**A:** Detection accuracy depends on:
- Correct flag format regex
- Challenge complexity
- File obfuscation level

Confidence scores help identify likely flags.

### Q: Can I use this during a live CTF?

**A:** Yes, but remember:
- This is for analysis assistance
- Always verify flags manually
- Don't rely solely on automation
- Learn the techniques, not just the answers

### Q: How do I add custom analysis tools?

**A:** See the [Architecture Guide](ARCHITECTURE.md) for extending the sandbox with custom tools.

### Q: Are my files kept private?

**A:** Yes, all data stays local:
- Files stored on your server only
- No data sent to cloud (except MegaLLM API for writeups)
- You control data retention

---

## Getting Help

- **Documentation**: Check other docs in `/docs` folder
- **Debug Guide**: See [DEBUG.md](DEBUG.md) for troubleshooting
- **Logs**: Check application logs for errors
- **Issues**: Open a GitHub issue for bugs
