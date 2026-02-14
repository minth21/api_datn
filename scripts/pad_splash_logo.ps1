Add-Type -AssemblyName System.Drawing

$sourcePath = "D:\DOANTOTNGHIEP_MT\toeic_practice_app\assets\images\logo.png"
$destPath = "D:\DOANTOTNGHIEP_MT\toeic_practice_app\assets\images\logo_splash.png"

Write-Host "Processing Splash Logo: $sourcePath"

if (-not (Test-Path $sourcePath)) {
    Write-Error "Source file not found!"
    exit 1
}

# Load original image
$originalImage = [System.Drawing.Image]::FromFile($sourcePath)
$width = $originalImage.Width
$height = $originalImage.Height

# We want the final image to be square to work best with the circle crop
$size = [Math]::Max($width, $height)

# Create new square bitmap with TRANSPARENT background (for splash)
$newBitmap = New-Object System.Drawing.Bitmap($size, $size)
$graphics = [System.Drawing.Graphics]::FromImage($newBitmap)
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Calculate centered position and size
# Scale down to 55% to fit safely within the circle (which is ~66% of diameter visible)
$scale = 0.55 
$newWidth = $width * $scale
$newHeight = $height * $scale

$x = ($size - $newWidth) / 2
$y = ($size - $newHeight) / 2

# Draw original image onto new bitmap
$graphics.DrawImage($originalImage, $x, $y, $newWidth, $newHeight)

$originalImage.Dispose()
$graphics.Dispose()

# Save new image
$newBitmap.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
$newBitmap.Dispose()

Write-Host "Success! Splash logo padded and saved to $destPath"
