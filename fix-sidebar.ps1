$filePath = "views\index.html"
$content = Get-Content $filePath -Raw

$adCode = @'
<script>
  atOptions = {
    'key' : '4461b86dfa413fea1916711a8f1fa008',
    'format' : 'iframe',
    'height' : 250,
    'width' : 300,
    'params' : {}
  };
</script>
<script src="https://www.highrevenueformat.com/4461b86dfa413fea1916711a8f1fa008/invoke.js"></script>
'@

$pattern = '(?s)(<div id="ad-slot-sidebar" class="ad-slot-box">\s*<span class="ad-disclaimer">Sponsor</span>\s*)(<span class="ad-placeholder-code">.*?</span>\s*<span>.*?</span>|<div class="ad-placeholder-content">.*?</div>)?'

$replacement = '${1}' + $adCode

$newContent = $content -replace $pattern, $replacement

Set-Content -Path $filePath -Value $newContent

Write-Host "Done. Checking result:"
Select-String -Path $filePath -Pattern "ad-slot-sidebar" -Context 0,10
