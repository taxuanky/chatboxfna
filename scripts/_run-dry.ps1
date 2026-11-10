Set-Location d:\FARM
cmd.exe /c "npm.cmd run ingest -- --dry-run 1> d:\FARM\.agents\_ingest-dry.log 2>&1"
Add-Content -Path d:\FARM\.agents\_ingest-dry.log -Value "=== EXITCODE: $LASTEXITCODE ==="
