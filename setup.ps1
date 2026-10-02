$dir = $PSScriptRoot
$htmlFiles = Get-ChildItem -Path $dir -Filter '*_leaflet.html'

if ($htmlFiles.Count -eq 0) {
    Write-Host "Error: No *_leaflet.html file found in this directory. Make sure you copy this entire tool folder INTO your map folder before running!" -ForegroundColor Red
    exit
}

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    
    if ($content -match 'omm-annotator.js') {
        Write-Host "$($file.Name) is already upgraded." -ForegroundColor Yellow
        continue
    }

    $injection = "<link rel=`"stylesheet`" href=`"assets/leaflet.draw.css`" />`r`n<script src=`"assets/leaflet.draw.js`"></script>`r`n<script src=`"assets/leaflet.geometryutil.js`"></script>`r`n<script src=`"assets/leaflet.snap.js`"></script>`r`n<script src=`"assets/omm-annotator.js`"></script>`r`n</body>"
    
    $newContent = $content -replace '</body>', $injection
    Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8
    
    Write-Host "Successfully upgraded $($file.Name)!" -ForegroundColor Green
}
