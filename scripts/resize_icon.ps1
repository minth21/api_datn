Add-Type -AssemblyName System.Drawing

$iconPath = "D:\DOANTOTNGHIEP_MT\toeic_practice_app\assets\icon\app_icon.png"
$tempPath = "D:\DOANTOTNGHIEP_MT\toeic_practice_app\assets\icon\app_icon_padded.png"

Write-Host "Processing: $iconPath"

# Load original image
$originalImage = [System.Drawing.Image]::FromFile($iconPath)
$width = $originalImage.Width
$height = $originalImage.Height
$size = [Math]::Max($width, $height)

# Create new square bitmap with white background
$newBitmap = New-Object System.Drawing.Bitmap($size, $size)
$graphics = [System.Drawing.Graphics]::FromImage($newBitmap)
$graphics.Clear([System.Drawing.Color]::White)
# Optional: Set high quality interpolation
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Calculate centered position and size (60% scale)
$scale = 0.60
$newWidth = $width * $scale
$newHeight = $height * $scale
$x = ($size - $newWidth) / 2
$y = ($size - $newHeight) / 2

# Draw original image onto new bitmap
$graphics.DrawImage($originalImage, $x, $y, $newWidth, $newHeight)

# Dispose original so we can overwrite if needed (but we write to temp first)
$originalImage.Dispose()
$graphics.Dispose()

# Save new image
$newBitmap.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
$newBitmap.Dispose()

# Replace original
Move-Item -Path $tempPath -Destination $iconPath -Force

Write-Host "Success! Icon padded and saved."
