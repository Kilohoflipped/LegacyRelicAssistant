function Get-PrimaryCsprojPath {
    $repoRoot = (Get-Location).Path
    $csprojs = Get-ChildItem -Path $repoRoot -Recurse -Filter '*.csproj' -File |
    Where-Object { $_.FullName -notmatch '[\\/]obj[\\/]' -and $_.FullName -notmatch '[\\/]bin[\\/]' }
    return ($csprojs[0].FullName.Substring($repoRoot.Length + 1) -replace '\\', '/')
}
