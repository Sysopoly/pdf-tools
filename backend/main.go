package main

import (
"fmt"
"io"
"log"
"net/http"
"os"
"os/exec"
"path/filepath"

"github.com/gin-contrib/cors"
"github.com/gin-gonic/gin"
"github.com/google/uuid"
"github.com/unidoc/unipdf/v3/common/license"
"github.com/unidoc/unipdf/v3/model"
"github.com/unidoc/unipdf/v3/model/optimize"
)

func init() {
apiKey := os.Getenv("UNIDOC_LICENSE_API_KEY")
if apiKey != "" {
err := license.SetMeteredKey(apiKey)
if err != nil {
log.Printf("Failed to set UniDoc metered key: %v", err)
} else {
log.Println("UniDoc metered key initialized.")
}
}
}

func optimizeWithUniPDF(inPath, outPath string) error {
pdfReader, fIn, err := model.NewPdfReaderFromFile(inPath, nil)
if err != nil {
return err
}
defer fIn.Close()

pdfWriter, err := pdfReader.ToWriter(nil)
if err != nil {
return err
}

options := optimize.Options{
CombineDuplicateStreams:         true,
CombineDuplicateDirectObjects:   true,
CombineIdenticalIndirectObjects: true,
ImageUpperPPI:                   50,
ImageQuality:                    20,
UseObjectStreams:                true,
CompressStreams:                 true,
CleanFonts:                      true,
SubsetFonts:                     true,
CleanContentstream:              true,
CleanUnusedResources:            true,
}

pdfWriter.SetOptimizer(optimize.New(options))

fOut, err := os.Create(outPath)
if err != nil {
return err
}
defer fOut.Close()

return pdfWriter.Write(fOut)
}

func optimizeWithAdvancedGhostscript(inPath, outPath string) error {
cmd := exec.Command(
"gs",
"-sDEVICE=pdfwrite",
"-dCompatibilityLevel=1.4",
"-dNOPAUSE", "-dQUIET", "-dBATCH",
"-dColorImageDownsampleType=/Bicubic",
"-dColorImageResolution=72",
"-dGrayImageResolution=72",
"-dMonoImageResolution=72",
"-dAutoFilterColorImages=false",
"-dAutoFilterGrayImages=false",
"-dColorImageFilter=/DCTEncode",
"-dGrayImageFilter=/DCTEncode",
fmt.Sprintf("-sOutputFile=%s", outPath),
		"-c", "<< /ColorImageDict << /QFactor 0.15 /Blend 1 >> >> setdistillerparams",
		"-f",
		inPath,
)
output, err := cmd.CombinedOutput()
if err != nil {
return fmt.Errorf("ghostscript error: %v, output: %s", err, string(output))
}
return nil
}

func main() {
r := gin.Default()

config := cors.DefaultConfig()
config.AllowAllOrigins = true
config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
r.Use(cors.New(config))

r.POST("/api/compress", func(c *gin.Context) {
err := c.Request.ParseMultipartForm(100 << 20)
if err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": "File too large or bad request."})
return
}

file, handler, err := c.Request.FormFile("pdf")
if err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": "No 'pdf' field found in form."})
return
}
defer file.Close()

id := uuid.New().String()
tempDir := os.TempDir()
inPath := filepath.Join(tempDir, fmt.Sprintf("%s-in.pdf", id))
outPath := filepath.Join(tempDir, fmt.Sprintf("%s-out.pdf", id))

defer func() {
os.Remove(inPath)
os.Remove(outPath)
log.Printf("Cleaned up temp files for push %s\n", id)
}()

outFile, err := os.Create(inPath)
if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create temp file."})
return
}
_, err = io.Copy(outFile, file)
outFile.Close()
if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write temp file."})
return
}

log.Printf("Received file %s (Size: %d) -> Optimizing to %s\n", handler.Filename, handler.Size, outPath)

compressionLevel := c.Request.FormValue("compressionLevel")

if compressionLevel == "/extreme" {
log.Println("Attempting EXTREME optimization via UniPDF...")
err = optimizeWithUniPDF(inPath, outPath)
if err != nil {
log.Printf("UniPDF failed (Credits exhausted?): %v. Falling back to Advanced Ghostscript...", err)
err = optimizeWithAdvancedGhostscript(inPath, outPath)
if err != nil {
log.Printf("Advanced Ghostscript fallback failed: %v", err)
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to compress file during Extreme optimization."})
return
}
}
} else {
validLevels := map[string]bool{
"/screen":   true,
"/ebook":    true,
"/printer":  true,
"/prepress": true,
"/default":  true,
}
if !validLevels[compressionLevel] {
compressionLevel = "/screen"
}

cmd := exec.Command(
"gs",
"-sDEVICE=pdfwrite",
"-dCompatibilityLevel=1.4",
fmt.Sprintf("-dPDFSETTINGS=%s", compressionLevel),
"-dNOPAUSE",
"-dQUIET",
"-dBATCH",
fmt.Sprintf("-sOutputFile=%s", outPath),
inPath,
)

output, err := cmd.CombinedOutput()
if err != nil {
log.Printf("Ghostscript error: %s\nOutput: %s", err.Error(), string(output))
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to compress file during Ghostscript optimization."})
return
}
}

compressedData, err := os.ReadFile(outPath)
if err != nil {
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read compiled file."})
return
}

c.Data(http.StatusOK, "application/pdf", compressedData)
})

port := os.Getenv("PORT")
if port == "" {
port = "8080"
}
log.Printf("Backend starting on port %s...", port)
r.Run(":" + port)
}
