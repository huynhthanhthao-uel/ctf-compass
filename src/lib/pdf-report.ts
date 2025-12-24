import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { JobDetail, Command, Artifact, FlagCandidate } from './types';

// Extend jsPDF with autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

interface ReportData {
  job: JobDetail;
  foundFlags: string[];
}

export function generatePDFReport({ job, foundFlags }: ReportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Colors
  const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
  const successColor: [number, number, number] = [34, 197, 94]; // Green
  const textColor: [number, number, number] = [30, 30, 30];
  const mutedColor: [number, number, number] = [100, 100, 100];

  // Helper functions
  const addTitle = (text: string, size = 20) => {
    doc.setFontSize(size);
    doc.setTextColor(...primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.text(text, 14, yPos);
    yPos += size * 0.5;
  };

  const addSubtitle = (text: string) => {
    doc.setFontSize(14);
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.text(text, 14, yPos);
    yPos += 8;
  };

  const addText = (text: string, indent = 14) => {
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, pageWidth - 28);
    doc.text(lines, indent, yPos);
    yPos += lines.length * 5 + 3;
  };

  const addMutedText = (text: string) => {
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    doc.setFont('helvetica', 'normal');
    doc.text(text, 14, yPos);
    yPos += 5;
  };

  const checkPageBreak = (needed = 30) => {
    if (yPos > doc.internal.pageSize.getHeight() - needed) {
      doc.addPage();
      yPos = 20;
    }
  };

  const addSeparator = () => {
    doc.setDrawColor(200, 200, 200);
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 8;
  };

  // ============ Header ============
  addTitle('CTF Analysis Report', 24);
  yPos += 5;

  // Job info box
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, yPos, pageWidth - 28, 35, 3, 3, 'F');
  
  yPos += 8;
  doc.setFontSize(14);
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.text(job.title, 20, yPos);
  
  yPos += 6;
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.setFont('helvetica', 'normal');
  doc.text(`ID: ${job.id}`, 20, yPos);
  
  yPos += 5;
  doc.text(`Created: ${new Date(job.createdAt).toLocaleString()}`, 20, yPos);
  
  yPos += 5;
  doc.text(`Status: ${job.status.toUpperCase()}`, 20, yPos);
  
  yPos += 5;
  doc.text(`Flag Format: ${job.flagFormat}`, 20, yPos);
  
  yPos += 15;

  // ============ Description ============
  if (job.description) {
    addSubtitle('Challenge Description');
    addText(job.description);
    yPos += 5;
  }

  // ============ Flags Found ============
  const allFlags = [...foundFlags, ...job.flagCandidates.map(c => c.value)];
  const uniqueFlags = [...new Set(allFlags)];

  if (uniqueFlags.length > 0) {
    checkPageBreak(40);
    addSubtitle('🚩 Flags Found');
    
    doc.setFillColor(...successColor);
    doc.roundedRect(14, yPos, pageWidth - 28, uniqueFlags.length * 10 + 10, 3, 3, 'F');
    
    yPos += 8;
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.setFont('courier', 'bold');
    
    uniqueFlags.forEach((flag, i) => {
      doc.text(flag, 20, yPos);
      yPos += 10;
    });
    
    yPos += 5;
  }

  // ============ Summary Statistics ============
  checkPageBreak(50);
  addSeparator();
  addSubtitle('Summary Statistics');
  
  const statsData = [
    ['Total Commands', job.commands.length.toString()],
    ['Total Artifacts', job.artifacts.length.toString()],
    ['Flags Found', uniqueFlags.length.toString()],
    ['Status', job.status.toUpperCase()],
  ];

  doc.autoTable({
    startY: yPos,
    head: [['Metric', 'Value']],
    body: statsData,
    theme: 'striped',
    headStyles: { fillColor: primaryColor },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 10 },
  });
  
  yPos = doc.lastAutoTable.finalY + 10;

  // ============ Commands Executed ============
  if (job.commands.length > 0) {
    checkPageBreak(50);
    addSeparator();
    addSubtitle('Commands Executed');
    
    const commandData = job.commands.map((cmd, i) => [
      (i + 1).toString(),
      cmd.tool,
      cmd.args.join(' ').substring(0, 40) + (cmd.args.join(' ').length > 40 ? '...' : ''),
      cmd.exitCode === 0 ? '✓' : '✗',
      `${cmd.duration}ms`,
    ]);

    doc.autoTable({
      startY: yPos,
      head: [['#', 'Tool', 'Arguments', 'Status', 'Duration']],
      body: commandData,
      theme: 'striped',
      headStyles: { fillColor: primaryColor },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 25 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 25 },
      },
    });
    
    yPos = doc.lastAutoTable.finalY + 10;
  }

  // ============ Artifacts ============
  if (job.artifacts.length > 0) {
    checkPageBreak(50);
    addSeparator();
    addSubtitle('Artifacts');
    
    const artifactData = job.artifacts.map((artifact, i) => [
      (i + 1).toString(),
      artifact.name,
      artifact.type,
      formatFileSize(artifact.size),
    ]);

    doc.autoTable({
      startY: yPos,
      head: [['#', 'Name', 'Type', 'Size']],
      body: artifactData,
      theme: 'striped',
      headStyles: { fillColor: primaryColor },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9 },
    });
    
    yPos = doc.lastAutoTable.finalY + 10;
  }

  // ============ Flag Candidates ============
  if (job.flagCandidates.length > 0) {
    checkPageBreak(50);
    addSeparator();
    addSubtitle('Flag Candidates');
    
    const candidateData = job.flagCandidates.map((c, i) => [
      (i + 1).toString(),
      c.value,
      `${Math.round(c.confidence * 100)}%`,
      c.source,
    ]);

    doc.autoTable({
      startY: yPos,
      head: [['#', 'Value', 'Confidence', 'Source']],
      body: candidateData,
      theme: 'striped',
      headStyles: { fillColor: primaryColor },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9 },
    });
    
    yPos = doc.lastAutoTable.finalY + 10;
  }

  // ============ Writeup ============
  if (job.writeup) {
    checkPageBreak(50);
    addSeparator();
    addSubtitle('Writeup');
    
    const writeupLines = job.writeup.split('\n');
    writeupLines.forEach(line => {
      checkPageBreak(10);
      if (line.startsWith('#')) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textColor);
        doc.text(line.replace(/^#+\s*/, ''), 14, yPos);
        yPos += 7;
      } else if (line.trim()) {
        addText(line);
      } else {
        yPos += 3;
      }
    });
  }

  // ============ Footer ============
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...mutedColor);
    doc.text(
      `Generated by CTF Autopilot | Page ${i} of ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Save
  doc.save(`ctf-report-${job.id}-${new Date().toISOString().split('T')[0]}.pdf`);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
