import { useState, useCallback, useEffect } from 'react';

export interface ChallengeTemplate {
  id: string;
  name: string;
  category: string;
  titlePattern: string;
  description: string;
  flagFormat: string;
  isBuiltIn: boolean;
  createdAt: string;
}

const STORAGE_KEY = 'ctf-challenge-templates';

// Built-in templates for common challenge types
const BUILT_IN_TEMPLATES: ChallengeTemplate[] = [
  {
    id: 'crypto-rsa',
    name: 'RSA Challenge',
    category: 'crypto',
    titlePattern: 'RSA - ',
    description: 'An RSA cryptography challenge. Analyze the given public key parameters (n, e) and ciphertext (c) to recover the plaintext flag.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'crypto-aes',
    name: 'AES Challenge',
    category: 'crypto',
    titlePattern: 'AES - ',
    description: 'An AES encryption challenge. Find the weakness in the implementation to decrypt the ciphertext.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'crypto-xor',
    name: 'XOR Challenge',
    category: 'crypto',
    titlePattern: 'XOR - ',
    description: 'A simple XOR cipher challenge. Break the XOR encryption to find the hidden flag.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'pwn-bof',
    name: 'Buffer Overflow',
    category: 'pwn',
    titlePattern: 'BOF - ',
    description: 'A buffer overflow exploitation challenge. Overflow the buffer to control program execution and get the flag.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'pwn-rop',
    name: 'ROP Chain',
    category: 'pwn',
    titlePattern: 'ROP - ',
    description: 'A Return-Oriented Programming challenge. Build a ROP chain to bypass protections and spawn a shell.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'pwn-format',
    name: 'Format String',
    category: 'pwn',
    titlePattern: 'FSB - ',
    description: 'A format string vulnerability challenge. Exploit printf to leak memory or overwrite GOT entries.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'rev-crackme',
    name: 'Crackme',
    category: 'rev',
    titlePattern: 'Crackme - ',
    description: 'A reverse engineering challenge. Analyze the binary to find the correct input or recover the hidden flag.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'rev-android',
    name: 'Android RE',
    category: 'rev',
    titlePattern: 'Android - ',
    description: 'An Android application reverse engineering challenge. Decompile the APK and find the hidden flag.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'forensics-stego',
    name: 'Steganography',
    category: 'forensics',
    titlePattern: 'Stego - ',
    description: 'A steganography challenge. Hidden data is embedded within the image/audio file. Extract the hidden flag.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'forensics-pcap',
    name: 'PCAP Analysis',
    category: 'forensics',
    titlePattern: 'PCAP - ',
    description: 'A network forensics challenge. Analyze the packet capture to find credentials, hidden data, or the flag.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'forensics-memory',
    name: 'Memory Dump',
    category: 'forensics',
    titlePattern: 'Memory - ',
    description: 'A memory forensics challenge. Analyze the memory dump to find artifacts, credentials, or the flag.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'forensics-metadata',
    name: 'Metadata Analysis',
    category: 'forensics',
    titlePattern: 'Metadata - ',
    description: 'A metadata forensics challenge. Examine file metadata, EXIF data, or hidden comments to find the flag.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'web-sqli',
    name: 'SQL Injection',
    category: 'web',
    titlePattern: 'SQLi - ',
    description: 'A SQL injection challenge. Exploit the vulnerable input to extract data from the database.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'web-xss',
    name: 'XSS Attack',
    category: 'web',
    titlePattern: 'XSS - ',
    description: 'A Cross-Site Scripting challenge. Inject malicious scripts to steal cookies or execute actions.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'web-ssti',
    name: 'SSTI',
    category: 'web',
    titlePattern: 'SSTI - ',
    description: 'A Server-Side Template Injection challenge. Exploit the template engine to achieve code execution.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'misc-pyjail',
    name: 'Python Jail',
    category: 'misc',
    titlePattern: 'PyJail - ',
    description: 'A Python sandbox escape challenge. Bypass restrictions to execute arbitrary code and get the flag.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'misc-osint',
    name: 'OSINT',
    category: 'misc',
    titlePattern: 'OSINT - ',
    description: 'An Open Source Intelligence challenge. Use public information to find the hidden flag.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    isBuiltIn: true,
    createdAt: new Date().toISOString()
  }
];

export function useChallengeTemplates() {
  const [customTemplates, setCustomTemplates] = useState<ChallengeTemplate[]>([]);

  // Load custom templates from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setCustomTemplates(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load templates:', e);
    }
  }, []);

  // Save custom templates to localStorage
  const saveTemplates = useCallback((templates: ChallengeTemplate[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
      setCustomTemplates(templates);
    } catch (e) {
      console.error('Failed to save templates:', e);
    }
  }, []);

  // Get all templates (built-in + custom)
  const allTemplates = [...BUILT_IN_TEMPLATES, ...customTemplates];

  // Get templates by category
  const getTemplatesByCategory = useCallback((category: string) => {
    return allTemplates.filter(t => t.category === category);
  }, [allTemplates]);

  // Add a new custom template
  const addTemplate = useCallback((template: Omit<ChallengeTemplate, 'id' | 'isBuiltIn' | 'createdAt'>) => {
    const newTemplate: ChallengeTemplate = {
      ...template,
      id: `custom-${Date.now()}`,
      isBuiltIn: false,
      createdAt: new Date().toISOString()
    };
    saveTemplates([...customTemplates, newTemplate]);
    return newTemplate;
  }, [customTemplates, saveTemplates]);

  // Delete a custom template
  const deleteTemplate = useCallback((id: string) => {
    const template = customTemplates.find(t => t.id === id);
    if (template && !template.isBuiltIn) {
      saveTemplates(customTemplates.filter(t => t.id !== id));
      return true;
    }
    return false;
  }, [customTemplates, saveTemplates]);

  // Update a custom template
  const updateTemplate = useCallback((id: string, updates: Partial<ChallengeTemplate>) => {
    const template = customTemplates.find(t => t.id === id);
    if (template && !template.isBuiltIn) {
      const updated = customTemplates.map(t => 
        t.id === id ? { ...t, ...updates } : t
      );
      saveTemplates(updated);
      return true;
    }
    return false;
  }, [customTemplates, saveTemplates]);

  // Save current form as template
  const saveAsTemplate = useCallback((
    name: string,
    data: { category: string; titlePattern: string; description: string; flagFormat: string }
  ) => {
    return addTemplate({
      name,
      ...data
    });
  }, [addTemplate]);

  return {
    templates: allTemplates,
    customTemplates,
    builtInTemplates: BUILT_IN_TEMPLATES,
    getTemplatesByCategory,
    addTemplate,
    deleteTemplate,
    updateTemplate,
    saveAsTemplate
  };
}
