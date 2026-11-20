# Convierte docs/informe/informe.html en .docx y .pdf usando Microsoft Word (COM).
$docs = (Resolve-Path (Join-Path $PSScriptRoot "..\docs")).Path
$html = Join-Path $docs "informe\informe.html"
$docx = Join-Path $docs "Informe_Tecnico_Air_Quality_Intelligence.docx"
$pdf  = Join-Path $docs "Informe_Tecnico_Air_Quality_Intelligence.pdf"
$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
  $doc = $word.Documents.Open($html, $false, $true)
  # Incrustar las imágenes (al abrir HTML quedan vinculadas)
  $doc.PageSetup.TopMargin = 56; $doc.PageSetup.BottomMargin = 56; $doc.PageSetup.LeftMargin = 62; $doc.PageSetup.RightMargin = 62
  $maxW = $doc.PageSetup.PageWidth - 124
  $maxH = ($doc.PageSetup.PageHeight - 112) * 0.78
  for ($i = $doc.InlineShapes.Count; $i -ge 1; $i--) {
    $s = $doc.InlineShapes.Item($i)
    if ($s.LinkFormat) { $s.LinkFormat.SavePictureWithDocument = $true; $s.LinkFormat.BreakLink() }
  }
  foreach ($s in @($doc.InlineShapes)) {
    $s.LockAspectRatio = -1
    $s.ScaleWidth = 100; $s.ScaleHeight = 100
    $f = [Math]::Min($maxW / $s.Width, $maxH / $s.Height)
    $s.Width = $s.Width * $f
  }
  $word.ActiveWindow.View.Type = 3   # vista de diseño de impresión
  $doc.SaveAs2([string]$docx, 16)             # wdFormatDocumentDefault
  $doc.ExportAsFixedFormat([string]$pdf, 17)  # wdExportFormatPDF
  $doc.Close([ref]$false)
  "Generados:`n  $docx`n  $pdf"
} finally { $word.Quit() }
