@"
$content = Get-Content main.go -Raw
$content = $content -replace "(?s)`"github\.com/unidoc/unipdf.*?optimize`"\n", ""
$content = $content -replace "(?s)func init\(\) \{.*?\n\}\n\n", ""
$content = $content -replace "(?s)func optimizeWithUniPDF\(.*?\n\}\n\n", ""
$content = $content -replace "(?s)log\.Println\(`"Attempting EXTREME optimization via UniPDF...`"\)\n\t\terr = optimizeWithUniPDF\(inPath, outPath\)\n\t\tif err != nil \{\n\t\t\tlog\.Printf\(`"UniPDF failed.*?Ghostscript...`", err\)", "log.Println(`"Attempting EXTREME optimization via Advanced Ghostscript...`")"
$content = $content -replace "(?s)\t\t\t\tlog\.Printf\(`"Advanced Ghostscript fallback failed: %v`", err\)\n.*?\n\t\t\t\}\n\t\t\}", "\t\tlog.Printf(`"Advanced Ghostscript failed: %v`", err)`n`t`t`tc.JSON(http.StatusInternalServerError, gin.H{`"error`": `"Failed to compress file during Extreme optimization.`"})`n`t`t`treturn`n`t`t}"
Set-Content main.go $content -NoNewline
"@
