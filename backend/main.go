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
)

func main() {
	r := gin.Default()

	// CORS for dev environments
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	r.Use(cors.New(config))

	r.POST("/api/compress", func(c *gin.Context) {
		// Parse the multipart form
		err := c.Request.ParseMultipartForm(100 << 20) // 100MB grab
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

		// Setup temporary environment
		id := uuid.New().String()
		tempDir := os.TempDir()
		inPath := filepath.Join(tempDir, fmt.Sprintf("%s-in.pdf", id))
		outPath := filepath.Join(tempDir, fmt.Sprintf("%s-out.pdf", id))

		// IMPORTANT: Always clean up files immediately after this request ends
		defer func() {
			os.Remove(inPath)
			os.Remove(outPath)
			log.Printf("Cleaned up temp files for push %s\n", id)
		}()

		// Write to disk
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
		validLevels := map[string]bool{
			"/screen":   true,
			"/ebook":    true,
			"/printer":  true,
			"/prepress": true,
			"/default":  true,
		}
		if !validLevels[compressionLevel] {
			compressionLevel = "/ebook" // Default to medium compression
		}

		// Call Ghostscript to re-encode and heavily compress
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

		// Read resulting file
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
