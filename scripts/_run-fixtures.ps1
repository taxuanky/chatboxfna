Set-Location d:\FARM
cmd.exe /c "npm.cmd run fixtures 1> d:\FARM\.agents\_fixtures.log 2>&1"
Add-Content -Path d:\FARM\.agents\_fixtures.log -Value "=== EXITCODE: $LASTEXITCODE ==="
cmd.exe /c "npm.cmd run typecheck 1> d:\FARM\.agents\_typecheck.log 2>&1"
Add-Content -Path d:\FARM\.agents\_typecheck.log -Value "=== EXITCODE: $LASTEXITCODE ==="
