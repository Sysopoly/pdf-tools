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
"-c", ".setpdfwrite << /ColorImageDict << /QFactor 0.15 /Blend 1 >> >> setdistillerparams",
fmt.Sprintf("-sOutputFile=%s", outPath),
inPath,
)
output, err := cmd.CombinedOutput()
if err != nil {
return fmt.Errorf("ghostscript error: %v, output: %s", err, string(output))
}
