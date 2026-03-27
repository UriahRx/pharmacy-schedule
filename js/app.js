// 主應用程式 - 整合所有模組
class PharmacyScheduleApp {
    constructor() {
        this.dataManager = null;
        this.validator = null;
        this.scheduler = null;
        this.uiManager = null;
        
        this.init();
    }
    
    async init() {
        console.log('藥局自動排班系統初始化...');
        
        try {
            // 1. 初始化資料管理
            this.dataManager = new DataManager();
            console.log('資料管理模組初始化完成');
            
            // 2. 初始化法律檢查器
            this.validator = new LaborLawValidator(this.dataManager);
            console.log('法律檢查模組初始化完成');
            
            // 3. 初始化排班引擎
            this.scheduler = new AutoScheduler(this.dataManager, this.validator);
            console.log('排班引擎初始化完成');
            
            // 4. 初始化UI管理器
            this.uiManager = new UIManager(this.dataManager, this.validator, this.scheduler);
            console.log('UI管理模組初始化完成');
            
            // 5. 設定全域變數（方便除錯）
            window.app = this;
            window.dataManager = this.dataManager;
            window.validator = this.validator;
            window.scheduler = this.scheduler;
            window.uiManager = this.uiManager;
            
            // 6. 檢查PWA支援
            this.setupPWA();
            
            // 7. 顯示歡迎訊息
            this.showWelcomeMessage();
            
            console.log('✅ 藥局自動排班系統初始化完成');
            
        } catch (error) {
            console.error('系統初始化失敗:', error);
            this.showError('系統初始化失敗，請重新整理頁面');
        }
    }
    
    setupPWA() {
        // 檢查是否為PWA模式
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('PWA獨立模式運行');
            document.body.classList.add('pwa-mode');
        }
        
        // 檢查網路狀態
        window.addEventListener('online', () => {
            this.uiManager.updateConnectionStatus(true);
            console.log('網路連線恢復');
        });
        
        window.addEventListener('offline', () => {
            this.uiManager.updateConnectionStatus(false);
            console.log('網路離線，使用本地資料');
            this.showMessage('網路離線，使用本地資料', 'warning');
        });
        
        // 初始網路狀態
        this.uiManager.updateConnectionStatus(navigator.onLine);
    }
    
    showWelcomeMessage() {
        const hasData = this.dataManager.employees.length > 0;
        const hasSchedule = this.dataManager.schedule !== null;
        
        let message = '🧠 藥局自動排班系統已就緒';
        
        if (!hasData) {
            message += '\n\n目前無員工資料，請：';
            message += '\n1. 點擊「載入資料」使用範例資料';
            message += '\n2. 或點擊「自動排班」開始生成排班表';
        } else if (!hasSchedule) {
            message += '\n\n已載入員工資料，請點擊「自動排班」開始';
        } else {
            message += '\n\n已載入上次的排班資料';
        }
        
        console.log(message);
        
        // 在控制台顯示使用說明
        console.log(`
        🎯 使用說明：
        1. 載入資料：點擊「載入資料」按鈕
        2. 自動排班：設定日期和週期後點擊「自動排班」
        3. 手動調整：開啟編輯模式後拖放班次
        4. 合規檢查：隨時點擊「合規檢查」驗證
        5. 匯出使用：點擊「匯出班表」下載JSON
        
        📱 手機操作：
        - 可安裝到主畫面（PWA）
        - 支援觸控拖放
        - 離線可用
        `);
    }
    
    showMessage(text, type = 'info') {
        // 建立訊息彈出
        const messageDiv = document.createElement('div');
        messageDiv.className = `app-message ${type}`;
        messageDiv.innerHTML = `
            <div class="message-content">
                <span class="message-icon">${this.getMessageIcon(type)}</span>
                <span class="message-text">${text}</span>
                <button class="message-close">&times;</button>
            </div>
        `;
        
        // 樣式
        messageDiv.style.position = 'fixed';
        messageDiv.style.top = '20px';
        messageDiv.style.right = '20px';
        messageDiv.style.background = this.getMessageColor(type);
        messageDiv.style.color = 'white';
        messageDiv.style.padding = '15px 20px';
        messageDiv.style.borderRadius = '8px';
        messageDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        messageDiv.style.zIndex = '9999';
        messageDiv.style.maxWidth = '400px';
        messageDiv.style.animation = 'slideIn 0.3s ease';
        
        document.body.appendChild(messageDiv);
        
        // 關閉按鈕
        const closeBtn = messageDiv.querySelector('.message-close');
        closeBtn.addEventListener('click', () => {
            messageDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 300);
        });
        
        // 自動消失（如果是info類型）
        if (type === 'info' || type === 'success') {
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    closeBtn.click();
                }
            }, 5000);
        }
        
        // 添加動畫樣式
        if (!document.querySelector('#message-animations')) {
            const style = document.createElement('style');
            style.id = 'message-animations';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    getMessageIcon(type) {
        const icons = {
            'info': 'ℹ️',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌'
        };
        return icons[type] || icons.info;
    }
    
    getMessageColor(type) {
        const colors = {
            'info': '#3498db',
            'success': '#27ae60',
            'warning': '#f39c12',
            'error': '#e74c3c'
        };
        return colors[type] || colors.info;
    }
    
    showError(error) {
        console.error('應用程式錯誤:', error);
        this.showMessage(`錯誤：${error.message || error}`, 'error');
    }
    
    // 工具方法
    loadSampleData() {
        this.dataManager.loadSampleData();
        this.uiManager.renderEmployeeList();
        this.uiManager.updateStats();
        this.showMessage('已載入範例員工資料', 'success');
    }
    
    clearAllData() {
        if (confirm('確定要清除所有資料嗎？此操作無法復原。')) {
            localStorage.removeItem('pharmacy_schedule_data');
            location.reload();
        }
    }
    
    // 匯出功能擴展
    exportToExcel() {
        // 簡化版本：匯出為CSV
        if (!this.dataManager.schedule) {
            this.showMessage('請先建立排班表', 'warning');
            return;
        }
        
        let csv = '日期,星期,早班,中班,晚班\n';
        
        const dates = Object.keys(this.dataManager.schedule.days).sort();
        dates.forEach(date => {
            const day = this.dataManager.schedule.days[date];
            const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];
            
            const morningStaff = day.shifts.morning.map(a => {
                const emp = this.dataManager.getEmployeeById(a.employeeId);
                return emp ? emp.name : '未知';
            }).join('、');
            
            const afternoonStaff = day.shifts.afternoon.map(a => {
                const emp = this.dataManager.getEmployeeById(a.employeeId);
                return emp ? emp.name : '未知';
            }).join('、');
            
            const eveningStaff = day.shifts.evening.map(a => {
                const emp = this.dataManager.getEmployeeById(a.employeeId);
                return emp ? emp.name : '未知';
            }).join('、');
            
            csv += `${date},週${weekdayNames[day.weekday]},"${morningStaff}","${afternoonStaff}","${eveningStaff}"\n`;
        });
        
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `排班表_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showMessage('已匯出CSV檔案', 'success');
    }
    
    // 列印功能
    printSchedule() {
        if (!this.dataManager.schedule) {
            this.showMessage('請先建立排班表', 'warning');
            return;
        }
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>藥局排班表</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
                    th { background: #f8f9fa; }
                    .shift-morning { background: #e3f2fd; }
                    .shift-afternoon { background: #f3e5f5; }
                    .shift-evening { background: #e8f5e8; }
                    .print-date { margin: 20px 0; color: #666; }
                </style>
            </head>
            <body>
                <h1>藥局排班表</h1>
                <div class="print-date">列印時間：${new Date().toLocaleString('zh-TW')}</div>
        `);
        
        // 建立表格
        printWindow.document.write('<table>');
        printWindow.document.write('<tr><th>日期</th><th>星期</th><th>早班 (08-16)</th><th>中班 (12-20)</th><th>晚班 (16-24)</th></tr>');
        
        const dates = Object.keys(this.dataManager.schedule.days).sort();
        dates.forEach(date => {
            const day = this.dataManager.schedule.days[date];
            const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];
            
            const morningStaff = day.shifts.morning.map(a => {
                const emp = this.dataManager.getEmployeeById(a.employeeId);
                return emp ? `${emp.name}(${emp.role.charAt(0)})` : '未知';
            }).join('、');
            
            const afternoonStaff = day.shifts.afternoon.map(a => {
                const emp = this.dataManager.getEmployeeById(a.employeeId);
                return emp ? `${emp.name}(${emp.role.charAt(0)})` : '未知';
            }).join('、');
            
            const eveningStaff = day.shifts.evening.map(a => {
                const emp = this.dataManager.getEmployeeById(a.employeeId);
                return emp ? `${emp.name}(${emp.role.charAt(0)})` : '未知';
            }).join('、');
            
            printWindow.document.write(`
                <tr>
                    <td>${date}</td>
                    <td>週${weekdayNames[day.weekday]}</td>
                    <td class="shift-morning">${morningStaff || '未安排'}</td>
                    <td class="shift-afternoon">${afternoonStaff || '未安排'}</td>
                    <td class="shift-evening">${eveningStaff || '未安排'}</td>
                </tr>
            `);
        });
        
        printWindow.document.write('</table>');
        
        // 合規狀態
        const validation = this.validator.validateFullSchedule();
        printWindow.document.write(`
            <div style="margin-top: 30px; padding: 15px; border: 1px solid #ddd; border-radius: 5px;">
                <h3>合規檢查結果</h3>
                <p>狀態：${validation.isValid ? '✅ 完全合規' : '⚠️ 存在違規'}</p>
                <p>檢查時間：${new Date().toLocaleString('zh-TW')}</p>
                ${!validation.isValid ? `<p>違規項目數：${validation.violations.length}</p>` : ''}
            </div>
        `);
        
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.print();
        }, 500);
    }
    
    // 資料備份與恢復
    createBackup() {
        const backup = {
            employees: this.dataManager.employees,
            schedule: this.dataManager.schedule,
            rules: this.dataManager.rules,
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
        
        const backupStr = JSON.stringify(backup, null, 2);
        localStorage.setItem('pharmacy_backup_' + Date.now(), backupStr);
        
        // 只保留最近5個備份
        const backupKeys = Object.keys(localStorage)
            .filter(key => key.startsWith('pharmacy_backup_'))
            .sort()
            .reverse()
            .slice(5);
        
        backupKeys.forEach(key => {
            localStorage.removeItem(key);
        });
        
        this.showMessage('已建立資料備份', 'success');
    }
    
    restoreBackup() {
        const backupKeys = Object.keys(localStorage)
            .filter(key => key.startsWith('pharmacy_backup_'))
            .sort()
            .reverse();
        
        if (backupKeys.length === 0) {
            this.showMessage('無可用備份', 'warning');
            return;
        }
        
        // 顯示備份列表讓使用者選擇
        const backupList = backupKeys.map(key => {
            const data = JSON.parse(localStorage.getItem(key));
            return {
                key: key,
                timestamp: new Date(data.timestamp).toLocaleString('zh-TW'),
                employeeCount: data.employees?.length || 0,
                hasSchedule: !!data.schedule
            };
        });
        
        let message = '可用的備份：\n\n';
        backupList.forEach((backup, index) => {
            message += `${index + 1}. ${backup.timestamp} (${backup.employeeCount}名員工${backup.hasSchedule ? '，有排班' : ''})\n`;
        });
        
        const choice = prompt(message + '\n輸入編號選擇要恢復的備份（1-' + backupList.length + '）：');
        const index = parseInt(choice) - 1;
        
        if (index >= 0 && index < backupList.length) {
            if (confirm(`確定要恢復 ${backupList[index].timestamp} 的備份嗎？當前資料將會被覆蓋。`)) {
                const backupData = JSON.parse(localStorage.getItem(backupList[index].key));
                
                this.dataManager.employees = backupData.employees || [];
                this.dataManager.schedule = backupData.schedule || null;
                this.dataManager.rules = backupData.rules || this.dataManager.getDefaultRules();
                this.dataManager.saveToLocalStorage();
                
                location.reload();
            }
        }
    }
}

// 全域輔助函數
function showLoading(message = '處理中...') {
    let loadingDiv = document.getElementById('app-loading');
    
    if (!loadingDiv) {
        loadingDiv = document.createElement('div');
        loadingDiv.id = 'app-loading';
        loadingDiv.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
            </div>
        `;
        
        // 樣式
        loadingDiv.style.position = 'fixed';
        loadingDiv.style.top = '0';
        loadingDiv.style.left = '0';
        loadingDiv.style.right = '0';
        loadingDiv.style.bottom = '0';
        loadingDiv.style.background = 'rgba(255,255,255,0.9)';
        loadingDiv.style.display = 'flex';
        loadingDiv.style.alignItems = 'center';
        loadingDiv.style.justifyContent = 'center';
        loadingDiv.style.zIndex = '99999';
        
        const style = document.createElement('style');
        style.textContent = `
            .loading-spinner {
                width: 50px;
                height: 50px;
                border: 5px solid #f3f3f3;
                border-top: 5px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }
            .loading-text {
                text-align: center;
                font-size: 16px;
                color: #333;
