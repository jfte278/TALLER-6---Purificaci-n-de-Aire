# Genera capturas de cada módulo con Microsoft Edge en modo headless (tema claro).
# Requiere el servidor corriendo:  node server.js   (por defecto puerto 3000)
param([int]$Puerto = 3000)
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$out = (Resolve-Path (Join-Path $PSScriptRoot "..\docs\capturas")).Path
$perfil = Join-Path $env:TEMP "edge-aqi-capturas"
$alturas = @{ monitoreo = 1650; proceso = 1450; validacion = 1250; dashboard = 2250; reportes = 1500 }
foreach ($t in $alturas.Keys) {
  Start-Process -FilePath $edge -Wait -WindowStyle Hidden -ArgumentList @(
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--user-data-dir=`"$perfil`"",
    "--blink-settings=preferredColorScheme=1", "--window-size=1440,$($alturas[$t])", "--virtual-time-budget=6000",
    "--screenshot=`"$out\$t.png`"", "http://localhost:$Puerto/#$t")
}
# Divide la captura del dashboard en dos partes para el informe impreso
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile("$out\dashboard.png")
$corte = 1205
foreach ($p in @(@{ n = 'dashboard_1'; y = 0; h = $corte }, @{ n = 'dashboard_2'; y = $corte; h = $img.Height - $corte })) {
  $r = New-Object System.Drawing.Rectangle 0, $p.y, $img.Width, $p.h
  $parte = $img.Clone($r, $img.PixelFormat)
  $parte.Save("$out\$($p.n).png", [System.Drawing.Imaging.ImageFormat]::Png); $parte.Dispose()
}
$img.Dispose()
Get-ChildItem $out | Select-Object Name, Length
