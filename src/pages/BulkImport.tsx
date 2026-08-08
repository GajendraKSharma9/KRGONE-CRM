import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  ArrowRight, 
  RefreshCw,
  Building2,
  FileCheck,
  Info,
  Camera,
  Sparkles
} from 'lucide-react';
import { UserProfile, Business, ImportValidationResult } from '../types';
import { businessService } from '../services/businessService';
import { SmartCaptureModal } from '../components/SmartCaptureModal';
import { ExtractedLeadRecord } from '../services/aiExtractService';

interface BulkImportProps {
  user: UserProfile;
}

export const BulkImport: React.FC<BulkImportProps> = ({ user }) => {
  const [file, setFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [workbookData, setWorkbookData] = useState<XLSX.WorkBook | null>(null);

  // Mapped Rows
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);

  // Column Mappings
  const [columnMapping, setColumnMapping] = useState({
    companyName: '',
    contactPerson: '',
    mobile: '',
    email: '',
    industry: '',
    status: ''
  });

  // Smart Capture Modal State
  const [isSmartCaptureOpen, setIsSmartCaptureOpen] = useState(false);

  // Validation Preview State
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'complete'>('upload');
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [previewTab, setPreviewTab] = useState<'valid' | 'duplicates' | 'invalid'>('valid');

  // Existing businesses for duplicate checking
  const [existingBusinesses, setExistingBusinesses] = useState<Business[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  // Import Execution
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentCompany: '' });
  const [finalResult, setFinalResult] = useState<{ success: boolean; count: number; error?: string } | null>(null);

  // Load existing businesses to perform client-side duplicate detection
  useEffect(() => {
    async function loadExisting() {
      if (!user.organizationId) return;
      try {
        setLoadingExisting(true);
        const data = await businessService.getBusinesses(user.organizationId);
        setExistingBusinesses(data);
      } catch (err) {
        console.error('Error loading existing businesses:', err);
      } finally {
        setLoadingExisting(false);
      }
    }
    loadExisting();
  }, [user.organizationId]);

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setFinalResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        setWorkbookData(wb);
        setSheetNames(wb.SheetNames);
        if (wb.SheetNames.length > 0) {
          setSelectedSheet(wb.SheetNames[0]);
          parseSheet(wb, wb.SheetNames[0]);
        }
      } catch (err) {
        console.error('Error reading Excel file:', err);
        alert('Invalid Excel/CSV file format.');
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  // Parse worksheet rows & auto-detect headers
  const parseSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    const worksheet = wb.Sheets[sheetName];
    if (!worksheet) return;

    // Convert sheet to json with raw header array
    const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    if (!rows || rows.length === 0) {
      alert('The selected sheet is empty.');
      return;
    }

    const detectedHeaders = (rows[0] || []).map((h: any) => String(h || '').trim());
    setHeaders(detectedHeaders);

    const dataRows = rows.slice(1).filter(r => r && r.length > 0 && r.some((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== ''));
    setRawRows(dataRows);

    // Auto-map columns based on header strings
    const autoMap = {
      companyName: findBestHeader(detectedHeaders, ['company', 'organization', 'business', 'company name', 'name']),
      contactPerson: findBestHeader(detectedHeaders, ['contact', 'person', 'contact person', 'name', 'contact name']),
      mobile: findBestHeader(detectedHeaders, ['mobile', 'phone', 'mobile number', 'phone number', 'contact number', 'cell']),
      email: findBestHeader(detectedHeaders, ['email', 'email address', 'mail']),
      industry: findBestHeader(detectedHeaders, ['industry', 'sector', 'category', 'domain']),
      status: findBestHeader(detectedHeaders, ['status', 'stage', 'lead status'])
    };

    setColumnMapping(autoMap);
    setStep('mapping');
  };

  const findBestHeader = (headersList: string[], keywords: string[]) => {
    for (const kw of keywords) {
      const match = headersList.find(h => h.toLowerCase() === kw.toLowerCase() || h.toLowerCase().includes(kw.toLowerCase()));
      if (match) return match;
    }
    return '';
  };

  // Create normalization helper for duplicate matching rule: companyName + mobile (or companyName + email)
  const getSignature = (companyName: string, mobile: string, email: string) => {
    const normCompany = (companyName || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const normMobile = (mobile || '').toLowerCase().replace(/[^0-9]/g, '');
    const normEmail = (email || '').toLowerCase().trim();

    if (normMobile) {
      return `${normCompany}_mob_${normMobile}`;
    }
    if (normEmail) {
      return `${normCompany}_email_${normEmail}`;
    }
    return `${normCompany}_nameonly`;
  };

  // Run validation and duplicate detection
  const handleValidateMapping = () => {
    if (!columnMapping.companyName) {
      alert('Please select a column for Company Name.');
      return;
    }

    const companyIdx = headers.indexOf(columnMapping.companyName);
    const contactIdx = headers.indexOf(columnMapping.contactPerson);
    const mobileIdx = headers.indexOf(columnMapping.mobile);
    const emailIdx = headers.indexOf(columnMapping.email);
    const industryIdx = headers.indexOf(columnMapping.industry);
    const statusIdx = headers.indexOf(columnMapping.status);

    // Existing DB signatures
    const dbSignatures = new Set<string>();
    existingBusinesses.forEach(b => {
      const sig = getSignature(b.companyName, b.mobile, b.email);
      dbSignatures.add(sig);
    });

    const fileSignatures = new Set<string>();

    const valid: Omit<Business, 'id'>[] = [];
    const duplicates: { record: Omit<Business, 'id'>; reason: string }[] = [];
    const invalid: { row: number; record: Record<string, any>; reason: string }[] = [];

    rawRows.forEach((row, index) => {
      const rowNum = index + 2; // 1-indexed row number considering header
      const rawCompany = companyIdx >= 0 ? String(row[companyIdx] || '').trim() : '';
      const rawContact = contactIdx >= 0 ? String(row[contactIdx] || '').trim() : '';
      const rawMobile = mobileIdx >= 0 ? String(row[mobileIdx] || '').trim() : '';
      const rawEmail = emailIdx >= 0 ? String(row[emailIdx] || '').trim() : '';
      const rawIndustry = industryIdx >= 0 ? String(row[industryIdx] || '').trim() : 'General';
      let rawStatus = statusIdx >= 0 ? String(row[statusIdx] || '').trim() : 'New';

      // Normalize status
      if (!['New', 'Won', 'Lost'].includes(rawStatus)) {
        rawStatus = 'New';
      }

      if (!rawCompany) {
        invalid.push({
          row: rowNum,
          record: { companyName: rawCompany, contactPerson: rawContact, mobile: rawMobile, email: rawEmail },
          reason: 'Company Name is missing'
        });
        return;
      }

      const record: Omit<Business, 'id'> = {
        organizationId: user.organizationId,
        companyName: rawCompany,
        contactPerson: rawContact,
        mobile: rawMobile,
        email: rawEmail,
        industry: rawIndustry || 'General',
        status: rawStatus as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const sig = getSignature(rawCompany, rawMobile, rawEmail);

      if (dbSignatures.has(sig)) {
        duplicates.push({
          record,
          reason: 'Already exists in database'
        });
      } else if (fileSignatures.has(sig)) {
        duplicates.push({
          record,
          reason: 'Duplicate within uploaded file'
        });
      } else {
        fileSignatures.add(sig);
        valid.push(record);
      }
    });

    setValidationResult({ valid, duplicates, invalid });
    setStep('preview');
  };

  // Receive records extracted from Smart Capture (Camera / Image / PDF AI OCR)
  const handleSmartCaptureExtracted = (extractedRecords: ExtractedLeadRecord[]) => {
    if (!extractedRecords || extractedRecords.length === 0) return;

    const stdHeaders = ['Company Name', 'Contact Person', 'Mobile Number', 'Email', 'Industry', 'Status'];
    setHeaders(stdHeaders);

    const convertedRows = extractedRecords.map(r => [
      r.companyName,
      r.contactPerson,
      r.mobile,
      r.email,
      r.industry || 'General',
      r.status || 'New'
    ]);
    setRawRows(convertedRows);

    const mapping = {
      companyName: 'Company Name',
      contactPerson: 'Contact Person',
      mobile: 'Mobile Number',
      email: 'Email',
      industry: 'Industry',
      status: 'Status'
    };
    setColumnMapping(mapping);

    // Run duplicate detection against existing DB records
    const dbSignatures = new Set<string>();
    existingBusinesses.forEach(b => {
      const sig = getSignature(b.companyName, b.mobile, b.email);
      dbSignatures.add(sig);
    });

    const fileSignatures = new Set<string>();
    const valid: Omit<Business, 'id'>[] = [];
    const duplicates: { record: Omit<Business, 'id'>; reason: string }[] = [];
    const invalid: { row: number; record: Record<string, any>; reason: string }[] = [];

    extractedRecords.forEach((rec, index) => {
      const rawCompany = (rec.companyName || '').trim();
      const rawContact = (rec.contactPerson || '').trim();
      const rawMobile = (rec.mobile || '').trim();
      const rawEmail = (rec.email || '').trim();
      const rawIndustry = (rec.industry || 'General').trim();
      let rawStatus = (rec.status || 'New').trim();

      if (!['New', 'Won', 'Lost'].includes(rawStatus)) {
        rawStatus = 'New';
      }

      if (!rawCompany) {
        invalid.push({
          row: index + 1,
          record: { companyName: rawCompany, contactPerson: rawContact, mobile: rawMobile, email: rawEmail },
          reason: 'Company Name is missing'
        });
        return;
      }

      const record: Omit<Business, 'id'> = {
        organizationId: user.organizationId,
        companyName: rawCompany,
        contactPerson: rawContact,
        mobile: rawMobile,
        email: rawEmail,
        industry: rawIndustry,
        status: rawStatus as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const sig = getSignature(rawCompany, rawMobile, rawEmail);

      if (dbSignatures.has(sig)) {
        duplicates.push({
          record,
          reason: 'Already exists in database'
        });
      } else if (fileSignatures.has(sig)) {
        duplicates.push({
          record,
          reason: 'Duplicate within captured items'
        });
      } else {
        fileSignatures.add(sig);
        valid.push(record);
      }
    });

    setValidationResult({ valid, duplicates, invalid });
    setStep('preview');
  };

  // Perform Import using optimized batching
  const handleStartImport = async () => {
    if (!validationResult || validationResult.valid.length === 0) return;

    const validRecords = validationResult.valid;
    setImporting(true);
    setFinalResult(null);

    const activeOrgId = user?.organizationId || `org_${user?.uid}` || 'org_default';

    const recordsToSave = validRecords.map(rec => ({
      ...rec,
      organizationId: rec.organizationId || activeOrgId
    }));

    try {
      setProgress({
        current: 0,
        total: recordsToSave.length,
        currentCompany: `Saving ${recordsToSave.length} records...`
      });

      const saved = await businessService.addBusinessesBatch(recordsToSave, (current, total) => {
        setProgress({
          current,
          total,
          currentCompany: `Saved ${current} of ${total} records`
        });
      });

      if (saved.length > 0) {
        setFinalResult({
          success: true,
          count: saved.length
        });
        setStep('complete');
      } else {
        setFinalResult({
          success: false,
          count: 0,
          error: 'Failed to write records to the database.'
        });
        setStep('complete');
      }
    } catch (err: any) {
      console.error('Import failed:', err);
      let errMsg = err.message || 'Unknown error';
      try {
        const parsed = JSON.parse(errMsg);
        if (parsed.error) {
          errMsg = parsed.error;
        }
      } catch (_) {}

      setFinalResult({
        success: false,
        count: 0,
        error: `Import failed: ${errMsg}`
      });
      setStep('complete');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setSheetNames([]);
    setSelectedSheet('');
    setWorkbookData(null);
    setHeaders([]);
    setRawRows([]);
    setValidationResult(null);
    setFinalResult(null);
    setStep('upload');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Bulk Import & Smart Capture</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload Excel files or snap photos/PDFs with AI Smart Capture to import business records directly.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsSmartCaptureOpen(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-2 transition-transform active:scale-98 self-start sm:self-auto"
        >
          <Camera className="w-4 h-4 text-blue-200" />
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>Smart AI Photo/PDF Capture</span>
        </button>
      </div>

      {/* STEP 1: UPLOAD FILE OR SMART CAPTURE */}
      {step === 'upload' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Excel File Upload */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs text-center flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-center space-x-2 text-emerald-700 font-bold text-sm mb-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Option 1: Excel / CSV Bulk Upload</span>
              </div>
              <div className="border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-2xl p-6 bg-slate-50 hover:bg-emerald-50/20 transition-all cursor-pointer relative my-2">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">Click to upload or drag & drop</p>
                <p className="text-[11px] text-slate-400 mt-1">Supports Excel (.xlsx, .xls) and CSV (.csv)</p>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-left text-xs text-emerald-900 space-y-1">
              <p className="font-bold flex items-center">
                <Info className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Expected Format:
              </p>
              <p className="text-[11px]">Columns for Company Name, Contact Person, Mobile, Email, Industry, and Status.</p>
            </div>
          </div>

          {/* Smart AI Photo / PDF OCR */}
          <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-2xs text-center flex flex-col justify-between space-y-4 relative overflow-hidden bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/40">
            <div className="absolute top-0 right-0 p-3">
              <span className="bg-blue-600 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-2xs">
                AI Powered
              </span>
            </div>

            <div className="space-y-3 text-left">
              <div className="flex items-center space-x-2 text-blue-800 font-bold text-sm">
                <Camera className="w-5 h-5 text-blue-600" />
                <span>Option 2: Smart Camera & PDF OCR</span>
              </div>
              <p className="text-xs text-slate-600">
                Snap business cards, document photos, or upload PDF lead lists. Gemini AI automatically extracts contact details directly into Firestore records.
              </p>
            </div>

            <div className="p-4 bg-white/80 border border-blue-100 rounded-xl text-left text-xs space-y-2 backdrop-blur-2xs">
              <div className="flex items-center space-x-2 text-slate-700 font-medium text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Auto-detects Company, Phone, Email & Industry</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-700 font-medium text-[11px]">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                <span>Works with camera photos, JPGs, PNGs, and PDFs</span>
              </div>
            </div>

            <button
              onClick={() => setIsSmartCaptureOpen(true)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-2 transition-transform active:scale-98"
            >
              <Camera className="w-4 h-4 text-blue-200" />
              <span>Open Smart AI Camera / Document OCR</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: COLUMN MAPPING */}
      {step === 'mapping' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Map Worksheet Columns</h2>
              <p className="text-xs text-slate-500">Match the spreadsheet headers to KRGONE Sales Navigator™ business fields.</p>
            </div>
            {sheetNames.length > 1 && (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 font-medium">Sheet:</span>
                <select
                  value={selectedSheet}
                  onChange={(e) => {
                    setSelectedSheet(e.target.value);
                    if (workbookData) parseSheet(workbookData, e.target.value);
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700"
                >
                  {sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Company Name *</label>
              <select
                value={columnMapping.companyName}
                onChange={(e) => setColumnMapping({ ...columnMapping, companyName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <option value="">-- Select Header --</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
              <select
                value={columnMapping.contactPerson}
                onChange={(e) => setColumnMapping({ ...columnMapping, contactPerson: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <option value="">-- None / Select Header --</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
              <select
                value={columnMapping.mobile}
                onChange={(e) => setColumnMapping({ ...columnMapping, mobile: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <option value="">-- None / Select Header --</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <select
                value={columnMapping.email}
                onChange={(e) => setColumnMapping({ ...columnMapping, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <option value="">-- None / Select Header --</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
              <select
                value={columnMapping.industry}
                onChange={(e) => setColumnMapping({ ...columnMapping, industry: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <option value="">-- None / Select Header --</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={columnMapping.status}
                onChange={(e) => setColumnMapping({ ...columnMapping, status: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <option value="">-- None / Select Header --</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleValidateMapping}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center space-x-2"
            >
              <span>Validate & Preview Records</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PREVIEW VALIDATION & CONFIRMATION */}
      {step === 'preview' && validationResult && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Import Analysis & Preview</h2>
              <p className="text-xs text-slate-500">Review valid, duplicate, and invalid records before writing to Firestore.</p>
            </div>
            <button
              onClick={() => setStep('mapping')}
              className="text-xs text-blue-600 font-semibold hover:underline"
            >
              Edit Mapping
            </button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-500 block">Total Rows</span>
              <span className="text-xl font-bold text-slate-800 mt-1 block">{rawRows.length}</span>
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-[11px] font-semibold text-emerald-700 block flex items-center">
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                Valid Records
              </span>
              <span className="text-xl font-bold text-emerald-700 mt-1 block">{validationResult.valid.length}</span>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-[11px] font-semibold text-amber-700 block flex items-center">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                Duplicates
              </span>
              <span className="text-xl font-bold text-amber-700 mt-1 block">{validationResult.duplicates.length}</span>
            </div>
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
              <span className="text-[11px] font-semibold text-rose-700 block flex items-center">
                <XCircle className="w-3.5 h-3.5 mr-1" />
                Invalid Rows
              </span>
              <span className="text-xl font-bold text-rose-700 mt-1 block">{validationResult.invalid.length}</span>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setPreviewTab('valid')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                previewTab === 'valid' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Valid ({validationResult.valid.length})
            </button>
            <button
              onClick={() => setPreviewTab('duplicates')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                previewTab === 'duplicates' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Duplicates ({validationResult.duplicates.length})
            </button>
            <button
              onClick={() => setPreviewTab('invalid')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                previewTab === 'invalid' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Invalid ({validationResult.invalid.length})
            </button>
          </div>

          {/* List Display */}
          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
            {previewTab === 'valid' && (
              validationResult.valid.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No valid records to import.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="px-4 py-2">Company Name</th>
                      <th className="px-4 py-2">Contact</th>
                      <th className="px-4 py-2">Mobile</th>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validationResult.valid.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-bold text-slate-800">{item.companyName}</td>
                        <td className="px-4 py-2 text-slate-600">{item.contactPerson || '-'}</td>
                        <td className="px-4 py-2 font-mono text-slate-600">{item.mobile || '-'}</td>
                        <td className="px-4 py-2 text-slate-600">{item.email || '-'}</td>
                        <td className="px-4 py-2 font-semibold text-blue-600">{item.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {previewTab === 'duplicates' && (
              validationResult.duplicates.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No duplicate records detected.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="px-4 py-2">Company Name</th>
                      <th className="px-4 py-2">Mobile</th>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validationResult.duplicates.map((dup, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-bold text-slate-800">{dup.record.companyName}</td>
                        <td className="px-4 py-2 font-mono text-slate-600">{dup.record.mobile || '-'}</td>
                        <td className="px-4 py-2 text-slate-600">{dup.record.email || '-'}</td>
                        <td className="px-4 py-2 font-medium text-amber-700 bg-amber-50">{dup.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {previewTab === 'invalid' && (
              validationResult.invalid.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No invalid rows detected.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="px-4 py-2">Excel Row #</th>
                      <th className="px-4 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validationResult.invalid.map((inv, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-bold text-slate-800">Row {inv.row}</td>
                        <td className="px-4 py-2 font-medium text-rose-700 bg-rose-50">{inv.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>

          {/* Import Progress Indicator */}
          {importing && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center space-y-2">
              <div className="flex items-center justify-center space-x-2 text-blue-700 font-bold text-xs">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Importing Record {progress.current} / {progress.total}...</span>
              </div>
              <p className="text-xs text-slate-600 font-medium">{progress.currentCompany}</p>
              <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-150"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            <button
              onClick={handleReset}
              disabled={importing}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleStartImport}
              disabled={importing || validationResult.valid.length === 0}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center space-x-2"
            >
              <FileCheck className="w-4 h-4" />
              <span>
                {importing
                  ? `Importing... (${progress.current}/${progress.total})`
                  : `Confirm & Save ${validationResult.valid.length} Valid Records`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: COMPLETE & FINAL RESULT */}
      {step === 'complete' && finalResult && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-2xs text-center space-y-6">
          {finalResult.success ? (
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Bulk Import Completed!</h2>
              <p className="text-xs text-slate-600">
                Successfully imported <span className="font-bold text-emerald-600 text-sm">{finalResult.count}</span> valid business records directly to Firestore.
              </p>
              <div className="pt-4 flex justify-center space-x-3">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg"
                >
                  Import Another File
                </button>
                <a
                  href="#/businesses"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs"
                >
                  View Businesses Directory
                </a>
              </div>
            </div>
          ) : (
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <XCircle className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Import Stopped On Error</h2>
              <p className="text-xs text-rose-600 font-medium bg-rose-50 border border-rose-200 p-3 rounded-xl">
                {finalResult.error}
              </p>
              <p className="text-xs text-slate-500">
                {finalResult.count} records were successfully written before encountering the error.
              </p>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-lg"
              >
                Start Over
              </button>
            </div>
          )}
        </div>
      )}

      {/* Smart Capture Modal (Camera & PDF OCR) */}
      <SmartCaptureModal
        isOpen={isSmartCaptureOpen}
        onClose={() => setIsSmartCaptureOpen(false)}
        onExtracted={handleSmartCaptureExtracted}
      />
    </div>
  );
};
