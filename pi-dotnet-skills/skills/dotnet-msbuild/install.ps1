# install.ps1 — установка скиллов плагина 'dotnet-msbuild' (глобально или локально)
[CmdletBinding()]
param(
    [ValidateSet('Global', 'Local')]
    [string]$Scope = 'Global',
    [string]$LocalDir
)
$rootScript = (Resolve-Path (Join-Path $PSScriptRoot '..\..\install.ps1')).Path
$extra = @{}
if ($LocalDir) { $extra.LocalDir = $LocalDir }
& $rootScript -Plugins @('dotnet-msbuild') -Scope $Scope @extra
