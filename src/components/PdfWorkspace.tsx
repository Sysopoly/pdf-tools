import { useState, useCallback } from 'react';
import { FileUp, File, X, GripVertical, Download, Loader2, Plus } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import * as pdfjsLib from 'pdfjs-dist';
// Vite standard way of loading a worker
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { PDF } from '@libpdf/core';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PdfPageData {
  id: string;          // unique id for dnd-kit
  sourceFileId: string; // which file this came from
  originalIndex: number; // 0-based original order in the source file
  dataUrl: string;     // rendered canvas thumbnail
}

interface SourceFile {
  id: string;
  name: string;
  size: number;
  bytes: Uint8Array;
}

function SortablePage({ page, activeIndex, onRemove }: { page: PdfPageData, activeIndex: number, onRemove: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition, // Disable transition while dragging to fix lag
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "group relative bg-white border border-gray-200 shadow-sm rounded-lg flex flex-col aspect-[1/1.4] overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all",
        isDragging && "ring-2 ring-blue-500 shadow-xl scale-105"
      )}
    >
      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-md shadow-sm border border-gray-200 text-xs font-bold px-2 py-0.5 rounded text-gray-700 z-10 cursor-default">
          {activeIndex + 1}
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        onPointerDown={(e) => e.stopPropagation()} 
        className="absolute top-2 right-2 bg-red-100 hover:bg-red-500 text-red-600 hover:text-white p-1.5 rounded transition-colors opacity-0 group-hover:opacity-100 z-10 cursor-pointer shadow-sm"
        title="Remove page from document"
      >
          <X className="w-4 h-4" />
      </button>
      
      <div className="flex-grow flex items-center justify-center bg-gray-50 overflow-hidden cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
          {page.dataUrl ? (
            <img src={page.dataUrl} alt={`Page ${activeIndex + 1}`} className="w-full h-full object-cover pointer-events-none" />
          ) : (
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none flex items-center justify-center">
             <GripVertical className="w-8 h-8 text-black/50 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
          </div>
      </div>
    </div>
  );
}

export function PdfWorkspace() {
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [pages, setPages] = useState<PdfPageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [optimize, setOptimize] = useState(false);
  const [compressionLevel, setCompressionLevel] = useState('/ebook');
  const [outputName, setOutputName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (droppedFiles.length > 0) {
       handleFiles(droppedFiles);
    }
  }, []);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(f => f.type === 'application/pdf');
    if (selectedFiles.length > 0) {
       handleFiles(selectedFiles);
    }
  }, []);

  const handleFiles = async (files: File[]) => {
    setLoading(true);
    setStatusMsg(`Loading ${files.length > 1 ? 'files' : 'file'} securely in browser...`);
    
    try {
      const newSourceFiles: SourceFile[] = [];
      const newPages: PdfPageData[] = [];

      for (const f of files) {
        const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const arrayBuffer = await f.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        newSourceFiles.push({
          id: fileId,
          name: f.name,
          size: f.size,
          bytes
        });

        setStatusMsg(`Rendering previews for ${f.name}...`);
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
        const numPages = pdf.numPages;
        
        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.0 });
          
          const scale = Math.min(300 / viewport.width, 1.0);
          const scaledViewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d', { alpha: false });
          if (!context) continue;

          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;

          await page.render({
            canvasContext: context,
            viewport: scaledViewport
          }).promise;

          newPages.push({
            id: `page-${fileId}-${i}`,
            sourceFileId: fileId,
            originalIndex: i - 1,
            dataUrl: canvas.toDataURL('image/jpeg', 0.8)
          });
        }
      }
      
      setSourceFiles(prev => [...prev, ...newSourceFiles]);
      setPages(prev => [...prev, ...newPages]);
    } catch (err) {
      console.error(err);
      alert('Failed to process one or more PDFs. Ensure they are valid and not highly DRM encrypted.');
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  const clearWorkspace = () => {
    setSourceFiles([]);
    setPages([]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPages((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const removePage = (id: string) => {
    setPages(prev => prev.filter(p => p.id !== id));
  };

  const handleExport = async () => {
    if (sourceFiles.length === 0 || pages.length === 0) return;
    
    try {
      setLoading(true);
      setStatusMsg('Building your new PDF...');
      
      const newDoc = await PDF.create();
      
      // Load all necessary source docs into memory only once
      const loadedDocs: Record<string, PDF> = {};
      const requiredSourceIds = new Set(pages.map(p => p.sourceFileId));
      
      for (const sourceId of requiredSourceIds) {
        const sourceFile = sourceFiles.find(f => f.id === sourceId);
        if (sourceFile) {
          loadedDocs[sourceId] = await PDF.load(sourceFile.bytes);
        }
      }

      // @libpdf/core automatically appends copied pages to the destination document.
      // We will loop through the user's chosen page order and let copyPagesFrom stitch them in.
      for (const page of pages) {
        const sourceDoc = loadedDocs[page.sourceFileId];
        if (sourceDoc) {
           await newDoc.copyPagesFrom(sourceDoc, [page.originalIndex]);
        }
      }
      
      const savedBytes = await newDoc.save({ useXRefStream: true });
      
      // Trigger a synthetic download
      const downloadDocument = async (finalBytes: Uint8Array) => {
        const blob = new Blob([finalBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        let targetName = outputName.trim();
        if (!targetName) {
            targetName = sourceFiles.length > 1 ? 'merged-document' : `edited-${sourceFiles[0].name.replace('.pdf', '')}`;
        }
        if (!targetName.toLowerCase().endsWith('.pdf')) {
            targetName += '.pdf';
        }
        
        a.download = targetName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      if (!optimize) {
        await downloadDocument(savedBytes);
        setLoading(false);
        setStatusMsg('');
      } else {
        setStatusMsg('Securely compressing PDF via API... (This may take a few seconds)');
        
        // POST to the Go backend for deep ghostscript image rasterization
        const formData = new FormData();
        const blob = new Blob([savedBytes], { type: 'application/pdf' });
        formData.append('pdf', blob, 'temp.pdf');
        formData.append('compressionLevel', compressionLevel);

        const response = await fetch('/api/compress', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          console.error("Backend compression failed");
          alert("Backend compression failed. Downloading the standard, un-optimized version instead.");
          await downloadDocument(savedBytes);
        } else {
          const optimizedBuffer = await response.arrayBuffer();
          await downloadDocument(new Uint8Array(optimizedBuffer));
        }

        setLoading(false);
        setStatusMsg('');
      }
    } catch (err) {
      console.error("Export failed:", err);
      alert('Failed to export PDF.');
      setLoading(false);
      setStatusMsg('');
    }
  };

  if (sourceFiles.length === 0) {
    return (
      <div 
        className="flex-grow flex flex-col items-center justify-center p-12 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg mx-4 my-4 relative"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onFileDrop}
      >
        <div className="bg-white p-6 rounded-full shadow-sm mb-6 z-10 pointer-events-none">
            <FileUp className="w-12 h-12 text-blue-500" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2 z-10 pointer-events-none">Drop your PDF files here</h3>
        <p className="text-gray-500 mb-8 max-w-sm text-center z-10 pointer-events-none">
            Your files stay fully secure and never leave your computer. Processing happens in your browser.
        </p>
        <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-full shadow-md transition-colors z-20">
            <span>Select PDF Files</span>
            <input 
              type="file" 
              multiple
              className="hidden" 
              accept=".pdf,application/pdf"
              onChange={onFileInput}
            />
        </label>
      </div>
    );
  }

  const totalSize = sourceFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div 
       className="flex-grow flex flex-col h-full bg-gray-100"
       onDragOver={(e) => e.preventDefault()}
       onDrop={onFileDrop}
    >
      {/* Workspace Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col sm:flex-row gap-4 items-center justify-between sticky shadow-sm z-20">
        <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-700 transition">
                <File className="w-5 h-5" />
            </div>
            <div className="flex flex-col flex-grow">
                <input 
                    type="text"
                    value={outputName}
                    onChange={(e) => setOutputName(e.target.value)}
                    placeholder={sourceFiles.length === 1 ? `edited-${sourceFiles[0].name}` : 'merged-document.pdf'}
                    className="font-semibold text-gray-900 text-sm bg-gray-50 border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-[200px]"
                />
                <p className="text-xs text-gray-500 font-medium text-left mt-0.5 ml-1">
                    {(totalSize / 1024 / 1024).toFixed(2)} MB • {pages.length} pages total
                </p>
            </div>
        </div>
        
        <div className="flex flex-wrap justify-end items-center gap-3 sm:gap-4 w-full sm:w-auto">
            
            {optimize && (
              <select 
                value={compressionLevel} 
                onChange={(e) => setCompressionLevel(e.target.value)}
                className="text-sm bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                  <option value="/rasterize">Flatten to Images (Best for Scans/Bleed)</option><option value="/extreme">Maximum (Extreme, Slower)</option>
                  <option value="/screen">High (Screen Quality)</option>
                  <option value="/ebook">Medium (Ebook Quality)</option>
                  <option value="/printer">Low (Print Quality)</option>
              </select>
            )}
            <label className="flex items-center justify-center gap-2 cursor-pointer group" title="Uses our secure backend to heavily compress images. File is immediately deleted after processing.">
              <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">
                Optimize
              </span>
              <div className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={optimize} 
                  onChange={(e) => setOptimize(e.target.checked)} 
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </div>
            </label>

            <div className="h-8 w-px bg-gray-200 mx-1"></div>

            <button 
                onClick={clearWorkspace}
                className="text-gray-500 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors cursor-pointer"
                title="Discard all files and restart"
                disabled={loading}
            >
                <X className="w-6 h-6" />
            </button>
            <div className="h-8 w-px bg-gray-200 mx-1"></div>
            <button 
              onClick={handleExport}
              disabled={loading || pages.length === 0}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-colors cursor-pointer"
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                <span>{loading ? 'Processing...' : 'Export'}</span>
            </button>
        </div>
      </div>

      {/* Main Grid Area */}
      <div className="p-8 flex-grow relative overflow-y-auto">
        {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-800 font-bold tracking-wide animate-pulse text-lg">{statusMsg || 'Processing...'}</p>
            </div>
        )}
        
        <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-end mb-6">
                <h2 className="text-xl font-bold text-gray-800 tracking-tight">Organize Pages</h2>
                <div className="flex items-center gap-3">
                    <p className="text-sm text-gray-500 font-medium hidden sm:block">Drag to reorder • Hover/Click X to remove</p>
                    <label className="flex items-center gap-1.5 text-sm bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 px-3 py-1.5 rounded shadow-sm transition-colors cursor-pointer">
                        <Plus className="w-4 h-4" /> Add PDFs
                        <input 
                          type="file" 
                          multiple
                          className="hidden" 
                          accept=".pdf,application/pdf"
                          onChange={onFileInput}
                        />
                    </label>
                </div>
            </div>

            {pages.length === 0 && !loading ? (
                <div className="text-center py-20 text-gray-500 bg-white rounded-xl border border-gray-200 shadow-sm">
                  <p className="text-lg font-medium text-gray-700 mb-2">All pages removed.</p>
                  <label className="text-blue-600 hover:underline cursor-pointer">
                    Add another PDF to continue
                    <input 
                      type="file" 
                      multiple
                      className="hidden" 
                      accept=".pdf,application/pdf"
                      onChange={onFileInput}
                    />
                  </label>
                </div>
            ) : (
                <DndContext 
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext 
                    items={pages.map(p => p.id)}
                    strategy={rectSortingStrategy}
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                        {pages.map((page, index) => (
                            <SortablePage 
                              key={page.id} 
                              page={page} 
                              activeIndex={index} 
                              onRemove={() => removePage(page.id)}
                            />
                        ))}
                    </div>
                  </SortableContext>
                </DndContext>
            )}
        </div>
      </div>
    </div>
  );
}
// cache buster: 1
