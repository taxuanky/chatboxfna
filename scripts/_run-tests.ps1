Set-Location d:\FARM
cmd.exe /c "npm.cmd run typecheck 1> d:\FARM\.agents\_tc.log 2>&1"
Add-Content -Path d:\FARM\.agents\_tc.log -Value "=== EXITCODE: $LASTEXITCODE ==="
cmd.exe /c "npx vitest run tests/unit/kb tests/unit/scripts tests/integration/ingest.test.ts 1> d:\FARM\.agents\_vitest.log 2>&1"
Add-Content -Path d:\FARM\.agents\_vitest.log -Value "=== EXITCODE: $LASTEXITCODE ==="
