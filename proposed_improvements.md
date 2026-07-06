# Proposed Enhancements & Technical Improvements

This document lists potential security, reliability, architecture, and performance enhancements for the **Single-Store Inventory Management System** (Photino + .NET 10 + SQLite/SQLCipher + React).

---

## 1. Security & Cryptography Enhancements

### Secure Password Handling in Memory
*   **Current State:** The SQLite password is stored in `DatabaseState.Password` as a standard, immutable C# `string`.
*   **Improvement:** Store passwords in `SecureString` or use `byte[]`/`char[]` buffers that are pinned in memory and explicitly zeroed out (using `CryptographicOperations.ZeroMemory`) immediately after opening the connection. This prevents sensitive keys from sitting in plaintext in garbage-collected memory.

### Key Derivation Function (KDF) Strengthening
*   **Current State:** The user-entered plaintext password is used directly as the SQLCipher connection password.
*   **Improvement:** Pass the password through a heavy password-hashing function (such as Argon2id or PBKDF2 with high iterations) before sending it to SQLCipher. This ensures database key entropy is high even if users pick relatively weak passwords.

### Native Credential Manager Integration
*   **Improvement:** Support storing database file passwords in the user's operating system credential store (macOS Keychain or Windows Credential Manager). This enables a seamless user experience (e.g., "Remember Password" or auto-unlocking recent databases) without storing passwords in plain text JSON configuration files.

---

## 2. Database Resilience & Maintenance

### Automated Database Maintenance
*   **Improvement:** Implement a background maintenance worker or startup check that executes SQLite `VACUUM;` and `ANALYZE;` queries (e.g., weekly or post-backup) to rebuild database files, reclaim unused storage, and update query planner index statistics.

### Encrypted & Compressed Offline Backups
*   **Current State:** The `BackupService` copies the raw SQLite database file directly.
*   **Improvement:** Compress the database and the user's uploaded product images folder into a password-protected zip file (using AES-256) during manual or daily backup runs.

### Remote Backup Sync
*   **Improvement:** Implement optional integrations (via OAuth/APIs) to sync backup archives directly to personal cloud storage (e.g., Google Drive, Microsoft OneDrive, Dropbox) so local database drives aren't single points of failure.

---

## 3. Application Performance & Reliability

### Write-Ahead Logging (WAL) & Lock Prevention
*   **Current State:** WAL mode is enabled upon migrating.
*   **Improvement:** EF Core operations should utilize `IMMEDIATE` transaction types for command operations. By default, SQLite transactions start in `DEFERRED` mode, which can lead to `SQLITE_BUSY` errors if a write transaction is initiated when a read transaction is already open.

### Diagnostics & Log Exporting
*   **Improvement:** Create an endpoint to compile current Serilog rolling logs, SQLite health metrics, and disk space details into a diagnostic bundle (`.zip`) that can be exported directly from the frontend settings page to simplify customer troubleshooting.

---

## 4. Codebase Architecture & Structure

### Vertical Slice Architecture (Feature Folders)
*   **Improvement:** Migrate the backend structure from standard vertical layers (e.g., grouping all controllers/services together) into cohesive feature folders (e.g., `Features/Products`, `Features/Reports`). Group the endpoint mappings, request models, handlers, and validation rules together within each respective folder to maximize cohesion.

### Decoupled Request Validation Pipeline
*   **Improvement:** Implement a validation filter (such as using FluentValidation) as an endpoint filter on Minimal APIs. This ensures incoming requests are automatically validated before entering feature handlers, reducing boilerplate checking code.
