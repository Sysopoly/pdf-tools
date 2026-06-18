package main

import (
"fmt"
        "os"
"os/exec"
)

func flattenToImages(inPath, outPath string) error {
        psOut := inPath + ".ps"

        // 1. Convert to PS to strip objects / flush geometry boundaries cleanly.
cmd1 := exec.Command("gs", "-q", "-dNOPAUSE", "-dBATCH", "-sDEVICE=ps2write", fmt.Sprintf("-sOutputFile=%s", psOut), inPath)
out, err := cmd1.CombinedOutput()
        if err != nil {
            return fmt.Errorf("ghostscript ps2write error: %v, out: %s", err, string(out))
        }
        defer os.Remove(psOut)

        // 2. Conver back to PDF with resizing and max compression.
cmd2 := exec.Command(
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
"-f", psOut,
)

out, err = cmd2.CombinedOutput()
if err != nil {
return fmt.Errorf("ghostscript pdfwrite error: %v, out: %s", err, string(out))
}
return nil
}
