const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // 간단한 로컬 앱이므로 false 설정
    },
    // 아이콘 경로 (선택사항: public 폴더에 favicon.ico가 있다면)
    icon: path.join(__dirname, '../dist/favicon.ico') 
  });

  // 빌드된 index.html 파일 로드
  // 개발 중일 때는 http://localhost:5173, 배포 시에는 파일 경로
  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../dist/index.html')}`;
  
  win.loadURL(startUrl);
  
  // 메뉴바 제거 (선택사항)
  // win.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});