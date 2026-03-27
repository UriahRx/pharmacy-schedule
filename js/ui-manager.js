// UI管理器 - 處理介面互動
class UIManager {
    constructor(dataManager, validator, scheduler) {
        this.dataManager = dataManager;
        this.validator = validator;
        this.scheduler = scheduler;
        
        this.currentView = 'calendar';
        this.selectedEmployee = null;
        this.draggingShift = null;
        this.isEditMode = false;
        
        this.init();
    }
    
    init() {
        this.cacheElements();
        this.bindEvents();
        this.renderInitialView();
        this.updateStats();
    }
    
    cacheElements() {
        // 控制按鈕
        this.elements = {
            // 控制按鈕
            btnAutoSchedule: document.getElementById('btn-auto-schedule'),
            btnValidate: document.getElementById('btn-validate'),
            btnExport: document.getElementById('btn-export'),
            btnLoadData: document.getElementById('btn-load-data'),
            btnReset: document.getElementById('btn-reset'),
            btnSave: document.getElementById('btn-save'),
            btnEditMode: document.getElementById('btn-edit-mode'),
            btnClearAll: document.getElementById('btn-clear-all'),
            
            // 輸入控制
            startDate: document.getElementById('start-date'),
            periodLength: document.getElementById('period-length'),
            
            // 顯示區域
            employeeList: document.getElementById('employee-list'),
            scheduleGrid: document.getElementById('schedule-grid'),
            complianceStatus: document.getElementById('compliance-status'),
            violationsContainer: document.getElementById('violations-container'),
            noViolations: document.getElementById('no-violations'),
            
            // 統計資訊
            statTotalEmployees: document.getElementById('stat-total-employees'),
            statPharmacists: document.getElementById('stat-pharmacists'),
            statAvgHours: document.getElementById('stat-avg-hours'),
            statCompliance: document.getElementById('stat-compliance'),
            
            // 狀態顯示
            scheduleInfo: document.getElementById('schedule-info'),
            dataStatus: document.getElementById('data-status'),
            connectionStatus: document.getElementById('connection-status')
        };
    }
    
    bindEvents() {
        // 控制按鈕事件
        this.elements.btnAutoSchedule.addEventListener('click', () => this.generateSchedule());
        this.elements.btnValidate.addEventListener('click', () => this.validateSchedule());
        this.elements.btnExport.addEventListener('click', () => this.exportSchedule());
        this.elements.btnLoadData.addEventListener('click', () => this.loadSampleData());
        this.elements.btnReset.addEventListener('click', () => this.resetSchedule());
        this.elements.btnSave.addEventListener('click', () => this.saveData());
        this.elements.btnEditMode.addEventListener('click', () => this.toggleEditMode());
        this.elements.btnClearAll.addEventListener('click', () => this.clearAllShifts());
        
        // 輸入控制事件
        this.elements.startDate.addEventListener('change', () => this.updateScheduleInfo());
        this.elements.periodLength.addEventListener('change', () => this.updateScheduleInfo());
        
        // 拖放事件（稍後在renderSchedule中綁定）
        
        // 員工點選事件
        this.elements.employeeList.addEventListener('click', (e) => {
            const employeeCard = e.target.closest('.employee-card');
            if (employeeCard) {
                const employeeId = employeeCard.dataset.employeeId;
                this.selectEmployee(employeeId);
            }
        });
    }
    
    // 渲染初始視圖
    renderInitialView() {
        this.renderEmployeeList();
        this.updateScheduleInfo();
        
        if (this.dataManager.schedule) {
            this.renderSchedule();
            this.validateSchedule();
        } else {
            this.showNoScheduleMessage();
        }
    }
    
    // 渲染員工列表
    renderEmployeeList() {
        const employees = this.dataManager.employees;
        
        if (employees.length === 0) {
            this.elements.employeeList.innerHTML = `
                <div class="no-employees">
                    <p>無員工資料</p>
                    <button class="btn btn-small" onclick="uiManager.loadSampleData()">載入範例資料</button>
                </div>
            `;
            return;
        }
        
        let html = '';
        employees.forEach(employee => {
            const totalHours = this.dataManager.calculateEmployeeHours(employee.id);
            const isSelected = this.selectedEmployee === employee.id;
            
            html += `
                <div class="employee-card ${isSelected ? 'selected' : ''}" 
                     data-employee-id="${employee.id}">
                    <div class="employee-name">${employee.name}</div>
                    <div class="employee-details">
                        <span class="employee-role">${employee.role}</span>
                        <span class="employee-hours">${totalHours}h</span>
                    </div>
                </div>
            `;
        });
        
        this.elements.employeeList.innerHTML = html;
    }
    
    // 渲染排班表
    renderSchedule() {
        if (!this.dataManager.schedule) {
            this.showNoScheduleMessage();
            return;
        }
        
        const schedule = this.dataManager.schedule;
        const employees = this.dataManager.employees;
        
        // 建立網格HTML
        let html = this.generateScheduleGridHTML(schedule, employees);
        this.elements.scheduleGrid.innerHTML = html;
        
        // 綁定拖放事件
        this.setupDragAndDrop();
        
        // 更新資訊
        this.updateScheduleInfo();
    }
    
    generateScheduleGridHTML(schedule, employees) {
        const dates = Object.keys(schedule.days).sort();
        const totalDays = dates.length;
        
        let html = `
            <div class="calendar-header">
                <div class="header-cell employee-header">員工</div>
        `;
        
        // 日期標頭
        dates.forEach(date => {
            const day = schedule.days[date];
            const dateObj = new Date(date);
            const month = dateObj.getMonth() + 1;
            const dayOfMonth = dateObj.getDate();
            const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];
            
            html += `
                <div class="header-cell" title="${date}">
                    <div>${month}/${dayOfMonth}</div>
                    <div>週${weekdayNames[day.weekday]}</div>
                </div>
            `;
        });
        
        html += `</div>`; // 結束標頭
        
        // 員工列
        employees.forEach(employee => {
            const employeeHours = this.dataManager.calculateEmployeeHours(employee.id);
            const weeklyHours = this.dataManager.calculateWeeklyHours(employee.id);
            const avgWeeklyHours = Object.values(weeklyHours).reduce((a, b) => a + b, 0) / 4;
            
            html += `
                <div class="calendar-row" data-employee-id="${employee.id}">
                    <div class="employee-cell">
                        <div class="employee-name-row">${employee.name}</div>
                        <div class="employee-role-row">${employee.role}</div>
                        <div class="employee-hours-row">${employeeHours}h (平均${avgWeeklyHours.toFixed(1)}h/週)</div>
                    </div>
            `;
            
            // 每日班次單元格
            dates.forEach(date => {
                const day = schedule.days[date];
                const assignment = this.dataManager.findEmployeeAssignment(employee.id, date);
                
                html += this.generateShiftCellHTML(employee, date, day, assignment);
            });
            
            html += `</div>`; // 結束員工列
        });
        
        return html;
    }
    
    generateShiftCellHTML(employee, date, day, assignment) {
        let cellClass = 'shift-cell';
        let cellContent = '';
        let title = date;
        
        if (assignment) {
            const shiftType = assignment.shiftType;
            const shiftRule = this.dataManager.rules.shifts[shiftType];
            
            cellClass += ` shift-${shiftType}`;
            cellContent = `
                <div class="shift-content">
                    <div class="shift-time">${shiftRule.name}</div>
                    <div class="shift-role">${employee.role.charAt(0)}</div>
                </div>
            `;
            
            title = `${date} ${shiftRule.name} (${shiftRule.start}:00-${shiftRule.end}:00)`;
            
            // 檢查是否有違規
            const quickCheck = this.validator.quickCheck(employee.id, date, shiftType);
            if (quickCheck.warnings.length > 0) {
                cellClass += ' violation';
                title += '\n⚠️ ' + quickCheck.warnings.join('\n⚠️ ');
            }
        }
        
        // 檢查不可上班日
        if (employee.unavailableDays.includes(day.weekday)) {
            cellClass += ' unavailable';
            if (!assignment) {
                title += '\n❌ 不可上班日';
            }
        }
        
        return `
            <div class="${cellClass}" 
                 data-date="${date}" 
                 data-employee="${employee.id}"
                 data-shift-type="${assignment?.shiftType || ''}"
                 draggable="true"
                 title="${title}">
                ${cellContent}
            </div>
        `;
    }
    
    // 設定拖放功能
    setupDragAndDrop() {
        const cells = document.querySelectorAll('.shift-cell');
        
        cells.forEach(cell => {
            // 清除舊事件監聽器
            cell.replaceWith(cell.cloneNode(true));
        });
        
        // 重新取得元素
        const newCells = document.querySelectorAll('.shift-cell');
        
        newCells.forEach(cell => {
            cell.addEventListener('dragstart', this.handleDragStart.bind(this));
            cell.addEventListener('dragover', this.handleDragOver.bind(this));
            cell.addEventListener('drop', this.handleDrop.bind(this));
            cell.addEventListener('click', this.handleCellClick.bind(this));
        });
    }
    
    handleDragStart(e) {
        if (!this.isEditMode) {
            e.preventDefault();
            return;
        }
        
        const cell = e.target;
        const employeeId = cell.dataset.employee;
        const date = cell.dataset.date;
        const shiftType = cell.dataset.shiftType;
        
        if (shiftType) {
            this.draggingShift = {
                employeeId: employeeId,
                date: date,
                shiftType: shiftType,
                element: cell
            };
            
            cell.classList.add('dragging');
            e.dataTransfer.setData('text/plain', JSON.stringify(this.draggingShift));
            e.dataTransfer.effectAllowed = 'move';
        } else {
            e.preventDefault(); // 空單元格不能拖動
        }
    }
    
    handleDragOver(e) {
        if (!this.isEditMode) return;
        
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const cell = e.target.closest('.shift-cell');
        if (cell) {
            cell.classList.add('drag-over');
        }
    }
    
    handleDrop(e) {
        if (!this.isEditMode) return;
        
        e.preventDefault();
        
        const cell = e.target.closest('.shift-cell');
        if (!cell) return;
        
        // 移除拖放視覺效果
        document.querySelectorAll('.shift-cell').forEach(c => {
            c.classList.remove('drag-over');
            c.classList.remove('dragging');
        });
        
        try {
            const dataStr = e.dataTransfer.getData('text/plain');
            if (!dataStr) return;
            
            const sourceShift = JSON.parse(dataStr);
            const targetEmployeeId = cell.dataset.employee;
            const targetDate = cell.dataset.date;
            
            // 檢查是否可以交換
            if (this.canSwapShifts(sourceShift, targetEmployeeId, targetDate)) {
                this.swapShifts(sourceShift, targetEmployeeId, targetDate);
                this.renderSchedule();
                this.validateSchedule();
                this.updateStats();
            }
        } catch (error) {
            console.error('拖放操作失敗:', error);
        }
        
        this.draggingShift = null;
    }
    
    handleCellClick(e) {
        if (!this.isEditMode) return;
        
        const cell = e.target.closest('.shift-cell');
        if (!cell) return;
        
        const employeeId = cell.dataset.employee;
        const date = cell.dataset.date;
        const currentShiftType = cell.dataset.shiftType;
        
        if (currentShiftType) {
            // 已有班次：移除或更改
            if (confirm('要移除這個班次嗎？')) {
                this.dataManager.removeShift(employeeId, date, currentShiftType);
                this.renderSchedule();
                this.validateSchedule();
                this.updateStats();
            }
        } else {
            // 空單元格：添加班次
            this.showShiftSelection(employeeId, date, cell);
        }
    }
    
    showShiftSelection(employeeId, date, cell) {
        const shiftTypes = Object.keys(this.dataManager.rules.shifts);
        const employee = this.dataManager.getEmployeeById(employeeId);
        const day = this.dataManager.schedule.days[date];
        
        // 建立選擇菜單
        const menu = document.createElement('div');
        menu.className = 'shift-selection-menu';
        menu.style.position = 'absolute';
        menu.style.background = 'white';
        menu.style.border = '1px solid #ddd';
        menu.style.borderRadius = '4px';
        menu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        menu.style.zIndex = '1000';
        
        let menuHTML = '<div class="menu-header">選擇班別</div>';
        
        shiftTypes.forEach(shiftType => {
            const shiftRule = this.dataManager.rules.shifts[shiftType];
            const quickCheck = this.validator.quickCheck(employeeId, date, shiftType);
            const isAvailable = quickCheck.isValid;
            
            menuHTML += `
                <div class="menu-item ${isAvailable ? '' : 'disabled'}" 
                     data-shift-type="${shiftType}"
                     onclick="uiManager.assignShift('${employeeId}', '${date}', '${shiftType}')">
                    <span class="shift-color ${shiftType}"></span>
                    <span class="shift-name">${shiftRule.name}</span>
                    <span class="shift-time">${shiftRule.start}:00-${shiftRule.end}:00</span>
                    ${!isAvailable ? '<span class="shift-warning">⚠️</span>' : ''}
                </div>
            `;
        });
        
        menu.innerHTML = menuHTML;
        
        // 定位並顯示菜單
        const rect = cell.getBoundingClientRect();
        menu.style.left = rect.left + 'px';
        menu.style.top = rect.bottom + 'px';
        
        document.body.appendChild(menu);
        
        // 點擊外部關閉
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                document.body.removeChild(menu);
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    }
    
    // 排班操作
    canSwapShifts(sourceShift, targetEmployeeId, targetDate) {
        // 1. 檢查目標單元格是否為空
        const targetAssignment = this.dataManager.findEmployeeAssignment(targetEmployeeId, targetDate);
        if (targetAssignment) {
            // 目標有班次，檢查是否可以交換
            const sourceEmployee = this.dataManager.getEmployeeById(sourceShift.employeeId);
            const targetEmployee = this.dataManager.getEmployeeById(targetEmployeeId);
            
            // 檢查雙方是否都可以上對方的班
            const sourceCanTakeTarget = this.validator.quickCheck(
                sourceShift.employeeId, 
                targetDate, 
                targetAssignment.shiftType
            ).isValid;
            
            const targetCanTakeSource = this.validator.quickCheck(
                targetEmployeeId,
                sourceShift.date,
                sourceShift.shiftType
            ).isValid;
            
            return sourceCanTakeTarget && targetCanTakeTarget;
        } else {
            // 目標為空，檢查源員工是否可以移到目標
            return this.validator.quickCheck(
                sourceShift.employeeId,
                targetDate,
                sourceShift.shiftType
            ).isValid;
        }
    }
    
    swapShifts(sourceShift, targetEmployeeId, targetDate) {
        const targetAssignment = this.dataManager.findEmployeeAssignment(targetEmployeeId, targetDate);
        
        if (targetAssignment) {
            // 交換班次
            // 1. 移除源班次
            this.dataManager.removeShift(sourceShift.employeeId, sourceShift.date, sourceShift.shiftType);
            // 2. 移除目標班次
            this.dataManager.removeShift(targetEmployeeId, targetDate, targetAssignment.shiftType);
            // 3. 添加源員工到目標班次
            this.dataManager.assignShift(sourceShift.employeeId, targetDate, sourceShift.shiftType);
            // 4. 添加目標員工到源班次
            this.dataManager.assignShift(targetEmployeeId, sourceShift.date, targetAssignment.shiftType);
        } else {
            // 移動班次
            this.dataManager.removeShift(sourceShift.employeeId, sourceShift.date, sourceShift.shiftType);
            this.dataManager.assignShift(sourceShift.employeeId, targetDate, sourceShift.shiftType);
        }
    }
    
    assignShift(employeeId, date, shiftType) {
        this.dataManager.assignShift(employeeId, date, shiftType);
        this.renderSchedule();
        this.validateSchedule();
        this.updateStats();
    }
    
    // 主要功能
    generateSchedule() {
        const startDate = this.elements.startDate.value;
        const weeks = parseInt(this.elements.periodLength.value);
        
        this.showLoading('正在生成排班表...');
        
        // 使用排班引擎
        const result = this.scheduler.generateSchedule(startDate, weeks);
        
        this.dataManager.schedule = result.schedule;
        this.dataManager.saveToLocalStorage();
        
        this.renderSchedule();
        this.displayComplianceResult(result.compliance);
        this.updateStats();
        
        this.hideLoading();
    }
    
    validateSchedule() {
        if (!this.dataManager.schedule) {
            this.showMessage('請先建立排班表', 'warning');
            return;
        }
        
        const result = this.validator.validateFullSchedule();
        this.displayComplianceResult(result);
        this.updateStats();
    }
    
    exportSchedule() {
        this.dataManager.