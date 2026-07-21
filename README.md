# Inventory System

A cross-platform desktop and web-based Inventory System.

## Project Architecture

The application is structured into the following components:

- **[Backend](./InventorySystem/Backend)**: An ASP.NET Core Web API project powered by .NET 10.
  - **Database**: SQLite with SQLCipher for encrypted, lightweight local storage.
  - **Reporting**: [ClosedXML](https://github.com/ClosedXML/ClosedXML) for Excel generation and [QuestPDF](https://github.com/QuestPDF/Quest) for PDF generation.
  - **Logging**: Serilog for structured application logging.
- **[Frontend](./InventorySystem/Frontend)**: A React application built with TypeScript and Vite.
  - **Styling**: Modern, responsive user interfaces.
  - **Testing**: End-to-end integration testing using Playwright.
  - **Linting**: Oxlint for performance-focused code validation.
- **[Desktop](./InventorySystem/Desktop)**: A cross-platform desktop shell utilizing [Photino.NET](https://www.tryphotino.io/) to package the React frontend and ASP.NET Core backend into a single executable application.
- **Tests**:
  - **[Backend.Tests](./InventorySystem/Backend.Tests)**: Unit tests for backend features.
  - **[Performance.Tests](./InventorySystem/Performance.Tests)**: Load and stress testing.
  - **[Security.Tests](./InventorySystem/Security.Tests)**: Security and vulnerability analysis.

---

## Features

- **Dashboard**: High-level metrics, stock status, and charts.
- **Products & Masters**: Manage Products, Brands, Categories, and Units of Measure.
- **Purchasing & Sales**: Record stock purchases, sales orders, and invoices.
- **Stock Control**: Stock Adjustments and Stock Counts.
- **Finance & Reports**: Comprehensive finance summaries, ledger updates, and exportable reports (Excel/PDF).
- **Launcher**: System configuration utility.

---

## Getting Started

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Node.js](https://nodejs.org/) (v18+) & npm

### Running the Backend (Web API)

Navigate to the Backend directory or run from the repository root:

```bash
dotnet run --project InventorySystem/Backend
```

### Running the Frontend

Navigate to the Frontend directory, install dependencies, and run the development server:

```bash
cd InventorySystem/Frontend
npm install
npm run dev
```

### Running as a Desktop Application

Ensure the Frontend is built or compiled, then launch the Photino.NET desktop container:

```bash
dotnet run --project InventorySystem/Desktop
```

For macOS packaging:
```bash
cd InventorySystem/Desktop
./package_macos.sh
```
