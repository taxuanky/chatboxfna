Set-Location d:\FARM
$log = 'd:\FARM\.agents\_verify.log'
Remove-Item $log -Force -ErrorAction SilentlyContinue

function Step($name, $cmd) {
  Add-Content -Path $log -Value "`n################ $name ################"
  cmd.exe /c "$cmd 1>> $log 2>&1"
  Add-Content -Path $log -Value "---- EXITCODE($name): $LASTEXITCODE ----"
}

Step 'typecheck' 'npm.cmd run typecheck'
Step 'ingest-dry-run' 'npm.cmd run ingest -- --dry-run'
Step 'fixtures-1' 'npm.cmd run fixtures'
Step 'fixtures-2' 'npm.cmd run fixtures'
Step 'test-feat002' 'npm.cmd run test -- tests/unit/kb tests/unit/scripts tests/integration/ingest.test.ts'
Step 'test-all' 'npm.cmd run test'
Step 'lint' 'npm.cmd run lint'
Step 'build' 'npm.cmd run build'

Add-Content -Path $log -Value "`n################ knowledge/02_Cloud_Farm *.md ################"
Get-ChildItem d:\FARM\knowledge\02_Cloud_Farm -Recurse -Filter *.md |
  ForEach-Object { $_.FullName } | Add-Content -Path $log
Add-Content -Path $log -Value "################ data/ ################"
$data = Get-ChildItem d:\FARM\data -Force -ErrorAction SilentlyContinue
if ($null -eq $data) { Add-Content -Path $log -Value '(khong co thu muc data/)' }
else { $data | ForEach-Object { $_.FullName } | Add-Content -Path $log }
Add-Content -Path $log -Value "################ 5 dong dau README CF ################"
Get-Content d:\FARM\knowledge\02_Cloud_Farm\README.md -TotalCount 5 | Add-Content -Path $log
Add-Content -Path $log -Value "################ so dong bang glossary ################"
Add-Content -Path $log -Value ((Select-String -Path d:\FARM\knowledge\04_Bilingual_Glossary\glossary.md -Pattern '^\|').Count)
Add-Content -Path $log -Value "################ DONE ################"
