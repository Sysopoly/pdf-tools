package main

import (
"fmt"
"os/exec"
)

func flattenToImages(inPath, outPath string) error {
cmd := exec.Command(
"gs",
"-sDEVICE=pdfwrite",
"-dCompatibilityLevel=1.4",
"-dColorImageDownsampleType=/Bicubic",
"-dColorImageResolution=72",
"-dGrayImageResolution=72",
"-dMonoImageResolution=72",
"-dAutoFilterColorImages=false",
"-dAutoFilterGrayImages=false",
"-dColorImageFilter=/DCTEncode",
"-dGrayImageFilter=/DCTEncode",
"-dPDFFitPage",
"-dFIXEDMEDIA",
"-sPAPERSIZE=a4",
"-dNOPAUSE", "-dQUIET", "-dBATCH",
fmt.Sprintf("-sOutputFile=%s", outPath),
"-c", "<< /ColorImageDict << /QFactor 0.15 /Blend 1 >> >> setdistillerparams",
"-f",
inPath,
)

output, err := cmd.CombinedOutput()
if err != nil {
return fmt.Errorf("ghostscript fit-to-page error: %v, out: %s", err, string(output))
}
return nil
}
