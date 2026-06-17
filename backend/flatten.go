package main

import (
"fmt"
        "image"
        _ "image/jpeg"
        _ "image/png"
"log"
"os"
"path/filepath"
        "sort"

"github.com/jung-kurt/gofpdf"
"github.com/pdfcpu/pdfcpu/pkg/api"
)

func flattenToImages(inPath, outPath string) error {
tempDir, err := os.MkdirTemp("", "pdf-extract-*")
if err != nil {
return fmt.Errorf("failed to create temp dir: %v", err)
}
defer os.RemoveAll(tempDir)

err = api.ExtractImagesFile(inPath, tempDir, nil, nil)
if err != nil {
return fmt.Errorf("extraction error: %v", err)
}

files, err := filepath.Glob(filepath.Join(tempDir, "*"))
if err != nil || len(files) == 0 {
return fmt.Errorf("no extracted pages found or error: %v", err)
}
        sort.Strings(files)

pdf := gofpdf.New("P", "pt", "A4", "")

for _, file := range files {
f, err := os.Open(file)
if err != nil {
return err
}
imgConf, _, err := image.DecodeConfig(f)
f.Close()
if err != nil {
log.Println("ignoring file, not image:", file)
                        continue
}

wPt := float64(imgConf.Width) * 72.0 / 150.0
hPt := float64(imgConf.Height) * 72.0 / 150.0
                
                if wPt == 0 || hPt == 0 {
                    wPt = 595.28
                    hPt = 841.89
                }

orientation := "P"
if wPt > hPt {
orientation = "L"
}

pdf.AddPageFormat(orientation, gofpdf.SizeType{Wd: wPt, Ht: hPt})
pdf.ImageOptions(file, 0, 0, wPt, hPt, false, gofpdf.ImageOptions{ReadDpi: false}, 0, "")
}

err = pdf.OutputFileAndClose(outPath)
if err != nil {
return fmt.Errorf("failed to save flattened PDF: %v", err)
}
log.Printf("Successfully generated flattened PDF: %s", outPath)
        
        // Optimize to shrink the raw extracted images
        finalOut := inPath + "-compressed.pdf"
        err = optimizeWithAdvancedGhostscript(outPath, finalOut)
        if err == nil {
             os.Rename(finalOut, outPath)
        }
        
return nil
}
