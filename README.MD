# CloudCollectApp

CloudCollectApp is a desktop application built with Electron.

## Installation

1. Clone the repository:
```bash
git clone <repository URL>
cd CloudCollectDesktopApp
```
2. Install dependencies:
```bash
npm install
```
3. Create config.json:
```json
{
    "BACKEND_URL":"APP_BACKEND_URL",
    "FRONTEND_URL":"APP_FRONTEND_URL"
}
```
## Running the Application
To start the application in development mode, run:
```bash
npm start
```
This will open the application in an Electron window.

## Building the Application
To build the application run:

```bash
npm dist
```
This will generate an installer in the dist folder using electron-builder.

## Notes
For building on Windows update the version section in the package.json file and push to the main branch. Github CI/CD will proccess it. 
