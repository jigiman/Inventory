# Velopack Auto-Updater Setup & Packaging Guide

This guide explains how to release updates for the Single-Store Inventory System desktop application using **Velopack**.

---

## Automated Release via GitHub Actions (Recommended)

Releases are built automatically using GitHub Actions when you push a Git tag:

```bash
git add .
git commit -m "Release v1.1.0"
git tag v1.1.0
git push origin v1.1.0
```

The workflow file [.github/workflows/release-windows.yml](file:///Users/jigiman/Repositories/Inventory/.github/workflows/release-windows.yml) automatically builds the Windows `.exe` setup package and publishes it directly to GitHub Releases.

---

## 1. Configure the Release Source URL

The application reads the update source from `InventorySystem/Backend/appsettings.json`. Update `Velopack:GithubUrl` (or `Velopack:UpdateUrl`) with your repository URL:

```json
{
  "Velopack": {
    "GithubUrl": "https://github.com/jigiman/inventory",
    "UpdateUrl": ""
  }
}
```

---

## 2. Install the Velopack CLI (`vpk`)

Install the Velopack packaging tool globally on your dev machine or build server:

```bash
dotnet tool install -g vpk
```

To update `vpk` in the future:
```bash
dotnet tool update -g vpk
```

---

## 3. Build & Package a New Release

### Step A: Publish the Desktop Application

Publish the desktop executable using `.NET`:

#### macOS:
```bash
dotnet publish InventorySystem/Desktop/Desktop.csproj -c Release -r osx-x64 --self-contained
```

#### Windows:
```bash
dotnet publish InventorySystem/Desktop/Desktop.csproj -c Release -r win-x64 --self-contained
```

---

### Step B: Package with `vpk pack`

Run `vpk pack` to generate release manifests, installer binaries, and delta `.nupkg` packages:

#### macOS:
```bash
vpk pack -u InventorySystem -v 1.0.0 -p InventorySystem/Desktop/bin/Release/net10.0/osx-x64/publish -e Desktop
```

#### Windows:
```bash
vpk pack -u InventorySystem -v 1.0.0 -p InventorySystem/Desktop/bin/Release/net10.0/win-x64/publish -e Desktop.exe
```

This outputs release packages into a local `Releases/` directory.

---

## 4. Publish Release to GitHub

Upload the contents of the generated `Releases/` folder to GitHub Releases:

### Option A: Automatic upload via CLI
```bash
vpk upload github --repoUrl https://github.com/jigiman/inventory --token YOUR_GITHUB_PERSONAL_ACCESS_TOKEN
```

### Option B: Manual upload via GitHub UI
1. Go to `https://github.com/jigiman/inventory/releases`.
2. Click **Draft a new release**.
3. Create a version tag matching your build version (e.g. `v1.0.0`).
4. Drag and drop all files generated inside the `Releases/` folder (`RELEASES`, `.nupkg`, installer executables).
5. Click **Publish release**.

---

## 5. How End-Users Experience Auto-Updates

1. End users install the application via the Velopack-generated installer.
2. On launch, the backend checks the GitHub Releases feed in the background.
3. When a new version is detected, an **Update Available** banner appears in the desktop app UI.
4. Users can click **Download Update** followed by **Restart & Apply** to update seamlessly without losing local database data.
