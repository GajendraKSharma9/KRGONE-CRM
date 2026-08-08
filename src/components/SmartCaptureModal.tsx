import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  X, 
  Sparkles, 
  FileText, 
  RefreshCw, 
  CheckCircle, 
  Trash2, 
  Plus, 
  AlertCircle,
  FlipHorizontal,
  FileCheck,
  ShieldCheck,
  Building2,
  Mail,
  Phone,
  User
} from 'lucide-react';
import { aiExtractService, ExtractedLeadRecord } from '../services/aiExtractService';

interface SmartCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExtracted: (records: ExtractedLeadRecord[]) => void;
}

export const SmartCaptureModal: React.FC<SmartCaptureModalProps> = ({
  isOpen,
  onClose,
  onExtracted
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('upload');
  
  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  
  // Stored snapshots or files for extraction
  const [capturedFiles, setCapturedFiles] = useState<{ id: string; name: string; data: string; mimeType: string; preview: string }[]>([]);
  
  // Extraction & Processing State
  const [customPrompt, setCustomPrompt] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractedRecords, setExtractedRecords] = useState<ExtractedLeadRecord[]>([]);
  const [step, setStep] = useState<'capture' | 'review'>('capture');

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setIsCameraActive(true);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(
        'Unable to access camera. Please check camera permissions or use the File Upload tab.'
      );
      setIsCameraActive(false);
    }
  };

  // Stop Camera Stream completely
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (isOpen && activeTab === 'camera' && step === 'capture') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, activeTab, facingMode, step]);

  if (!isOpen) return null;

  // Snap photo from webcam
  const handleSnapPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    const newSnap = {
      id: `snap_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: `Photo Capture #${capturedFiles.length + 1}.jpg`,
      data: dataUrl,
      mimeType: 'image/jpeg',
      preview: dataUrl
    };

    setCapturedFiles(prev => [...prev, newSnap]);
  };

  // Handle file uploads (Images & PDFs)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: { id: string; name: string; data: string; mimeType: string; preview: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const base64Obj = await aiExtractService.fileToBase64(file);
        let preview = base64Obj.data;
        if (file.type === 'application/pdf') {
          preview = 'pdf_placeholder';
        }

        newItems.push({
          id: `file_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
          name: file.name,
          data: base64Obj.data,
          mimeType: base64Obj.mimeType,
          preview
        });
      } catch (err) {
        console.error('Error reading file:', err);
      }
    }

    setCapturedFiles(prev => [...prev, ...newItems]);
  };

  const removeFile = (id: string) => {
    setCapturedFiles(prev => prev.filter(f => f.id !== id));
  };

  // Run AI Extraction via Gemini endpoint
  const handleRunAiExtraction = async () => {
    if (capturedFiles.length === 0) {
      alert('Please snap a photo or upload at least one image/PDF document first.');
      return;
    }

    setIsExtracting(true);
    setExtractError(null);
    stopCamera(); // Immediately stop camera active stream when starting AI extraction

    try {
      const payloadFiles = capturedFiles.map(f => ({
        data: f.data,
        mimeType: f.mimeType
      }));

      const results = await aiExtractService.extractFromFiles(payloadFiles, customPrompt);

      if (!results || results.length === 0) {
        setExtractError('No business details found in the uploaded file(s). Try taking a clearer photo or adding notes.');
      } else {
        setExtractedRecords(results);
        setStep('review');
      }
    } catch (err: any) {
      console.error('Extraction error:', err);
      setExtractError(err.message || 'AI Extraction failed. Please try again.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Record modification helpers
  const handleUpdateRecord = (index: number, field: keyof ExtractedLeadRecord, value: string) => {
    setExtractedRecords(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddBlankRow = () => {
    setExtractedRecords(prev => [
      ...prev,
      {
        companyName: '',
        contactPerson: '',
        mobile: '',
        email: '',
        industry: 'General',
        status: 'New'
      }
    ]);
  };

  const handleDeleteRow = (index: number) => {
    setExtractedRecords(prev => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    stopCamera();
    setStep('capture');
    setCapturedFiles([]);
    setExtractedRecords([]);
    setExtractError(null);
    onClose();
  };

  // Final confirmation: Send to parent page for validation & Firestore write
  const handleConfirmAndSend = () => {
    const valid = extractedRecords.filter(r => r.companyName.trim().length > 0);
    if (valid.length === 0) {
      alert('Please make sure at least one record has a valid Company Name.');
      return;
    }
    onExtracted(valid);
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded-xl">
              <Sparkles className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center space-x-2">
                <span>Smart AI Capture & Document OCR</span>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 font-semibold px-2 py-0.5 rounded-full border border-blue-500/30">
                  Gemini AI Powered
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Snap business cards, document photos, or PDFs to auto-extract records into Firestore.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: CAPTURE / UPLOAD */}
        {step === 'capture' && (
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Mode Switcher Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-2 transition-all ${
                  activeTab === 'upload'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Upload Image or PDF</span>
              </button>
              <button
                onClick={() => setActiveTab('camera')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-2 transition-all ${
                  activeTab === 'camera'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>Camera Photo Capture</span>
              </button>
            </div>

            {/* TAB: CAMERA */}
            {activeTab === 'camera' && (
              <div className="space-y-4">
                <div className="relative bg-slate-950 rounded-2xl overflow-hidden aspect-video max-h-72 flex items-center justify-center border border-slate-800 shadow-inner">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Camera overlay guideline frame */}
                  <div className="absolute inset-8 border-2 border-dashed border-blue-400/50 rounded-xl pointer-events-none flex items-center justify-center">
                    <span className="bg-slate-900/80 text-blue-200 text-[11px] font-semibold px-3 py-1 rounded-full border border-blue-400/30 backdrop-blur-xs">
                      Align Business Card / Document Here
                    </span>
                  </div>

                  {/* Camera Controls Overlay */}
                  <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center space-x-4">
                    <button
                      type="button"
                      onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                      className="p-2.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full border border-slate-700 backdrop-blur-xs transition-transform active:scale-95"
                      title="Flip Camera"
                    >
                      <FlipHorizontal className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={handleSnapPhoto}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-full shadow-lg flex items-center space-x-2 border border-blue-400 active:scale-95 transition-transform"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Take Snap</span>
                    </button>
                  </div>
                </div>

                {cameraError && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                )}
              </div>
            )}

            {/* TAB: UPLOAD */}
            {activeTab === 'upload' && (
              <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-8 bg-slate-50 hover:bg-blue-50/20 transition-all text-center relative cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg, image/png, image/webp, application/pdf"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-800">
                  Click to select or drag & drop documents
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Supports Business Card Photos (.jpg, .png), Invoices, Leads Sheets, & PDFs (.pdf)
                </p>
              </div>
            )}

            {/* GALLERY OF CAPTURED FILES / SNAPSHOTS */}
            {capturedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Selected Items for AI OCR ({capturedFiles.length})
                  </span>
                  <button
                    onClick={() => setCapturedFiles([])}
                    className="text-[11px] font-semibold text-rose-600 hover:underline"
                  >
                    Clear All
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-48 overflow-y-auto p-1">
                  {capturedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="relative group bg-slate-100 rounded-xl border border-slate-200 overflow-hidden shadow-2xs p-2 flex flex-col items-center"
                    >
                      {file.preview === 'pdf_placeholder' ? (
                        <div className="w-full h-20 bg-rose-50 rounded-lg flex flex-col items-center justify-center text-rose-600">
                          <FileText className="w-8 h-8" />
                          <span className="text-[10px] font-bold mt-1">PDF Document</span>
                        </div>
                      ) : (
                        <img
                          src={file.preview}
                          alt={file.name}
                          className="w-full h-20 object-cover rounded-lg"
                        />
                      )}
                      <p className="text-[10px] font-semibold text-slate-700 truncate w-full mt-1.5 text-center">
                        {file.name}
                      </p>

                      <button
                        onClick={() => removeFile(file.id)}
                        className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-md opacity-90 hover:opacity-100 transition-opacity shadow-xs"
                        title="Remove file"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom AI Prompt Guidance */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Optional AI Prompt Notes / Hints
              </label>
              <input
                type="text"
                placeholder="e.g. 'These cards are from Mumbai Tech Expo', 'Extract mobile numbers starting with +91'"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            {extractError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{extractError}</span>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: REVIEW & EDIT EXTRACTED RECORDS */}
        {step === 'review' && (
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>AI Extraction Complete</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Review and edit the extracted business details before feeding into bulk import validation.
                </p>
              </div>

              <button
                onClick={handleAddBlankRow}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Record</span>
              </button>
            </div>

            {/* Editable Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Company Name *</th>
                    <th className="px-3 py-2">Contact Person</th>
                    <th className="px-3 py-2">Mobile Number</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Industry</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-2 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {extractedRecords.map((rec, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          value={rec.companyName}
                          onChange={(e) => handleUpdateRecord(idx, 'companyName', e.target.value)}
                          placeholder="Company Name"
                          className="w-full px-2 py-1 border border-slate-200 rounded-md text-xs font-bold text-slate-800 bg-white"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          value={rec.contactPerson}
                          onChange={(e) => handleUpdateRecord(idx, 'contactPerson', e.target.value)}
                          placeholder="Contact Person"
                          className="w-full px-2 py-1 border border-slate-200 rounded-md text-xs text-slate-700 bg-white"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          value={rec.mobile}
                          onChange={(e) => handleUpdateRecord(idx, 'mobile', e.target.value)}
                          placeholder="Mobile / Phone"
                          className="w-full px-2 py-1 border border-slate-200 rounded-md text-xs font-mono text-slate-700 bg-white"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          value={rec.email}
                          onChange={(e) => handleUpdateRecord(idx, 'email', e.target.value)}
                          placeholder="Email Address"
                          className="w-full px-2 py-1 border border-slate-200 rounded-md text-xs text-slate-700 bg-white"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          value={rec.industry}
                          onChange={(e) => handleUpdateRecord(idx, 'industry', e.target.value)}
                          placeholder="Industry"
                          className="w-full px-2 py-1 border border-slate-200 rounded-md text-xs text-slate-700 bg-white"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={rec.status}
                          onChange={(e) => handleUpdateRecord(idx, 'status', e.target.value as any)}
                          className="w-full px-2 py-1 border border-slate-200 rounded-md text-xs font-semibold text-blue-700 bg-white"
                        >
                          <option value="New">New</option>
                          <option value="Won">Won</option>
                          <option value="Lost">Lost</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          onClick={() => handleDeleteRow(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                          title="Delete row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {step === 'capture' ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-xl"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleRunAiExtraction}
                disabled={isExtracting || capturedFiles.length === 0}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm flex items-center space-x-2 transition-transform active:scale-98"
              >
                {isExtracting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Gemini AI Processing Document...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-blue-200" />
                    <span>Extract {capturedFiles.length} Item(s) with AI</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('capture')}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-xl"
              >
                Back to Capture
              </button>

              <button
                type="button"
                onClick={handleConfirmAndSend}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center space-x-2"
              >
                <FileCheck className="w-4 h-4" />
                <span>Validate & Import {extractedRecords.length} Record(s)</span>
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
