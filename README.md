# Shiksha Pilot - React Frontend & Slim PHP Backend Application

This is a decoupled application featuring a modern React frontend (bootstrapped with Vite) and a Slim PHP 4 micro-framework backend. The frontend and backend are housed in separate directories (`frontend/` and `backend/`).

---

## System Architecture

- **Frontend (`frontend/`)**: React 18, Vite (dev server with API proxy, runs on port `3000`), Lucide Icons, and custom Glassmorphism CSS design system.
- **Backend (`backend/`)**: Slim PHP 4, PSR-7 HTTP Message interfaces (`slim/psr7`), PHP-DI Container (`php-di/php-di`), and local JSON file-based database simulation. Runs on port `8000`.

---

## 🛠️ Windows Installation Guide

Since Node, PHP, and Composer are not currently active in your system's PATH, please follow these steps to install them.

### Step 1: Install Node.js & npm (Frontend Runtime)
1. Download the **Node.js LTS** installer for Windows from the official website: [https://nodejs.org/](https://nodejs.org/).
2. Run the installer and click **Next** through the setup wizard (make sure the option to **Add to PATH** is checked).
3. Restart your terminal/command prompt to apply path changes. Verify by running:
   ```bash
   node -v
   npm -v
   ```

### Step 2: Install PHP (Backend Runtime)
There are two common ways to set up PHP on Windows:

#### Option A: Direct PHP Zip (Recommended for lightweight setup)
1. Download the PHP 8.x "VS16 x64 Non Thread Safe" zip from: [https://windows.php.net/download/](https://windows.php.net/download/).
2. Extract the zip to a folder, e.g., `C:\php`.
3. Open `C:\php`, copy `php.ini-development` and rename it to `php.ini`. Open `php.ini` in a text editor, find the following extensions, and remove the leading semicolon `;` to enable them:
   - `extension=curl`
   - `extension=mbstring`
   - `extension=openssl`
4. Add `C:\php` to your Windows Environment Variables:
   - Search for **"Edit the system environment variables"** in the Windows Start menu.
   - Click **Environment Variables...**.
   - Under **System variables**, select **Path** and click **Edit...**.
   - Click **New** and type `C:\php`. Click **OK** on all windows.
5. Restart your terminal and verify:
   ```bash
   php -v
   ```

#### Option B: XAMPP (Includes Apache, MySQL, and PHP)
1. Download XAMPP for Windows from [https://www.apachefriends.org/](https://www.apachefriends.org/).
2. Run the installer. By default, it will install to `C:\xampp`.
3. Add `C:\xampp\php` to your system environment **Path** variable following the instructions in Step 4 of Option A above.

### Step 3: Install Composer (PHP Dependency Manager)
1. Download the official **Composer-Setup.exe** from: [https://getcomposer.org/download/](https://getcomposer.org/download/).
2. Run the installer. It will automatically detect your `php.exe` path (e.g. `C:\php\php.exe` or `C:\xampp\php\php.exe`).
3. Follow the wizard steps to complete.
4. Restart your terminal and verify:
   ```bash
   composer -v
   ```

---

## 🚀 Running the Application

Once you have installed the requirements, you can start both servers.

### 1. Launch Backend API (Slim PHP)

Open a terminal window and navigate to the backend directory:
```bash
cd backend
```

Install PHP packages:
```bash
composer install
```

Start the built-in PHP development server:
```bash
php -S localhost:8000 -t public
```
> [!NOTE]
> The API will be active at `http://localhost:8000`. You can test it in a browser or API tool by visiting `http://localhost:8000/api/status`.

---

### 2. Launch Frontend (React + Vite)

Open a **separate** terminal window and navigate to the frontend directory:
```bash
cd frontend
```

Install node packages:
```bash
npm install
```

Start the Vite dev server:
```bash
npm run dev
```
> [!NOTE]
> The React App will launch at `http://localhost:3000`. Vite automatically proxies any client-side queries made to `/api/*` to the Slim backend on `http://localhost:8000/*`.

---

## 📡 API Endpoints (Slim Backend)

| Method | Endpoint | Description | Payload Example |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/status` | Returns API server environment and status metadata. | *None* |
| **GET** | `/api/courses` | Retrieves the list of all courses (reads from `data/school_store.json`). | *None* |
| **POST** | `/api/courses` | Creates and persists a new course. Returns the created course with an incremented ID. | `{"code":"CS201", "name":"Data Structures", "instructor":"Prof. Grace"}` |
