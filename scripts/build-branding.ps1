# Deterministic extraction authorized by the logo owner. Requires Windows System.Drawing.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot
$source = [Drawing.Bitmap]::new((Join-Path $root 'Frontend/public/gta-szerviz-logo.png'))
$out = Join-Path $root 'Frontend/public/brand'
New-Item -ItemType Directory -Force $out | Out-Null
$logo = [Drawing.Bitmap]::new($source.Width, $source.Height)
# Remove only exact solid black. All distinguishable nonblack outlines and original RGB remain.
for ($y=0; $y -lt $source.Height; $y++) {
    for ($x=0; $x -lt $source.Width; $x++) {
        $c = $source.GetPixel($x,$y)
        if ($c.R -ne 0 -or $c.G -ne 0 -or $c.B -ne 0) { $logo.SetPixel($x,$y,$c) }
    }
}
$logo.Save((Join-Path $out 'gta-szerviz-transparent.png'), [Drawing.Imaging.ImageFormat]::Png)
# Source-specific GTA bounds; exclude the SZERVIZ row below/right of the g descender.
$compact = [Drawing.Bitmap]::new(620,350)
for ($y=0; $y -lt 350; $y++) {
    for ($x=0; $x -lt 620; $x++) {
        if ($y -lt 280 -or $x -lt 220) { $compact.SetPixel($x,$y,$logo.GetPixel($x+20,$y+230)) }
    }
}
foreach ($size in @(16,32,48,180)) {
    $icon = [Drawing.Bitmap]::new($size,$size)
    $g = [Drawing.Graphics]::FromImage($icon)
    # Dark tile keeps white original lettering visible on light browser chrome too.
    $g.Clear([Drawing.Color]::FromArgb(17,24,39))
    $g.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $w = $size-2; $h = [int]($w*350/620)
    $g.DrawImage($compact,1,[int](($size-$h)/2),$w,$h)
    $name = if ($size -eq 180) { 'apple-touch-icon.png' } else { "favicon-$size.png" }
    $icon.Save((Join-Path $out $name),[Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $icon.Dispose()
}
$compact.Dispose(); $logo.Dispose(); $source.Dispose()
