package main

import (
"fmt"
"image"
_ "image/jpeg"
"log"
"os"
"os/exec"
"path/filepath"

"github.com/jung-kurt/gofpdf"
)

func flattenToImages(inPath, outPath string) error {
tempDir, err := os.MkdirTemp("", "pdf-rasterize-*")
if err != nil {
return fmt.Errorf("failed to create temp dir: %v", err)
}
defer os.RemoveAll(tempDir)

// Dump PDF pages to JPEG at 150 DPI
jpgPattern := filepath.Join(tempDir, "page-%04d.jpg")
cmd := exec.Command(
"gs",
"-dNOPAUSE", "-dBATCH", "-dSAFER",
"-sDEVICE=jpeg",
"-r150", 
"-dJPEGQ=60",
fmt.Sprintf("-sOutputFile=%s", jpgPattern),
inPath,
)

output, err := cmd.CombinedOutput()
if err != nil {
return fmt.Errorf("ghostscript rasterize error: %v, out: %s", err, string(output))
}

// Find the images
files, err := filepath.Glob(filepath.Join(tempDir, "page-*.jpg"))
if err != nil || len(files) == 0 {
return fmt.Errorf("no extracted pages found or error: %v", err)
}

pdf := gofpdf.New("P", "pt", "A4", "")

for _, file := range files {
f, err := os.Open(file)
if err != nil {
return err
}
imgConf, _, err := image.DecodeConfig(f)
f.Close()
if err != nil {
return err
}

wPt := float64(imgConf.Width) * 72.0 / 150.0
hPt := float64(imgConf.Height) * 72.0 / 150.0

orientation := "P"
if wPt > hPt {
orientation = "L"
}

pdf.AddPageFormat(orientation, gofpdf.SizeType{Wd: wPt, Ht: hPt})
pdf.ImageOptions(file, 0, 0, wPt, hPt, false, gofpdf.ImageOptions{ReadDpi: true}, 0, "")
}

err = pdf.OutputFileAndClose(outPath)
if err != nil {
return fmt.Errorf("failed to save flattened PDF: %v", err)
}
log.Printf("Successfully generated flattened PDF: %s", outPath)
return nil
}
