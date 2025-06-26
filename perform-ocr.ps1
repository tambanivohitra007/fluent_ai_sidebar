# perform-ocr.ps1
# This script uses the built-in Windows.Media.Ocr API to extract text from an image.
# FINAL COMPATIBILITY VERSION: This version adds a pre-flight check to ensure
# the core OCR APIs are available before attempting to use them.

param (
    [string]$ImagePath
)

# --- PRE-FLIGHT CHECK ---
# Add a guard clause at the very beginning to test for the existence of the core OCR class.
# If this fails, the script will exit immediately with a clear error.
$OcrEngineType = [Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType=WindowsRuntime]
if (-not $OcrEngineType) {
    Write-Error "Windows OCR components are not available on this system. This feature requires Windows 10 or newer with the appropriate language packs installed."
    exit 1
}


try {
    # Load the necessary Windows Runtime assemblies.
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
    $null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType=WindowsRuntime]

    # A simple, robust function to block until an async operation is complete
    function Complete-Async($asyncOperation) {
        while ($asyncOperation.Status -eq [Windows.Foundation.AsyncStatus]::Started) {
            Start-Sleep -Milliseconds 20
        }
        return $asyncOperation
    }

    # Check if the image path was provided and if the file exists.
    if (-not $ImagePath -or -not (Test-Path $ImagePath)) {
        throw "Image path not provided or file does not exist: $ImagePath"
    }

    # Create an OCR engine for the user's current language.
    $OcrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if (-not $OcrEngine) {
        throw "Could not create Windows OCR Engine. Ensure your language is installed in Windows Settings > Time & Language > Language, and that it supports 'Optical character recognition'."
    }

    # --- Execute and wait for each async step sequentially ---

    # Get the storage file from the path.
    $fileAsync = [Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)
    $fileResult = Complete-Async($fileAsync)
    if ($fileResult.Status -ne [Windows.Foundation.AsyncStatus]::Completed) { throw $fileResult.ErrorCode.Message }
    $File = $fileResult.GetResults()

    # Open the file and create a bitmap decoder.
    $streamAsync = $File.OpenAsync(0) # 0 is for Read access
    $streamResult = Complete-Async($streamAsync)
    if ($streamResult.Status -ne [Windows.Foundation.AsyncStatus]::Completed) { throw $streamResult.ErrorCode.Message }
    $Stream = $streamResult.GetResults()
    
    $decoderAsync = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($Stream)
    $decoderResult = Complete-Async($decoderAsync)
    if ($decoderResult.Status -ne [Windows.Foundation.AsyncStatus]::Completed) { throw $decoderResult.ErrorCode.Message }
    $Decoder = $decoderResult.GetResults()

    $bitmapAsync = $Decoder.GetSoftwareBitmapAsync()
    $bitmapResult = Complete-Async($bitmapAsync)
    if ($bitmapResult.Status -ne [Windows.Foundation.AsyncStatus]::Completed) { throw $bitmapResult.ErrorCode.Message }
    $SoftwareBitmap = $bitmapResult.GetResults()

    # Perform the OCR operation.
    $ocrAsync = $OcrEngine.RecognizeAsync($SoftwareBitmap)
    $ocrResultOp = Complete-Async($ocrAsync)
    if ($ocrResultOp.Status -ne [Windows.Foundation.AsyncStatus]::Completed) { throw $ocrResultOp.ErrorCode.Message }
    $OcrResult = $ocrResultOp.GetResults()
    
    # Output the extracted text.
    Write-Output $OcrResult.Text

} catch {
    # If any part of the 'try' block fails, this will execute.
    # Write the specific error message to the standard error stream.
    Write-Error $_.Exception.Message
    exit 1
}
