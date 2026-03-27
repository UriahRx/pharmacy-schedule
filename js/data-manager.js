// 資料管理模組
class DataManager {
    constructor() {
        this.employees = [];
        this.schedule = null;
        this.rules = this.getDefaultRules();
        this.currentPeriod = {
            startDate: '2026-04-01',
            weeks: 4,
            totalDays: 28
        };
        
        this.init();
    }
    
    init() {
        this.loadFromLocalStorage();
        this.setupAutoSave();
    }
    
    getDefaultRules() {
        return {
            // 法律規定
            laborLaw: {
                maxDailyHours: 8,
                maxWeeklyHours: 40,
                max4WeekHours: 160,
                minRestDaysPerWeek: 1,
                maxConsecutiveDays: 6,
                minShiftInterval: 11,
                maxMonthlyOvertime: 46
            },
            
            // 班別設定
            shifts: {
                morning: {
                    name: '早班',
                    start: 8,
                    end: 16,
                    duration: 8,
                    requiresPharmacist: true,
                    minStaff: 2,
                    idealStaff: 3
                },
                afternoon: {
                    name: '中班',
                    start: 12,
                    end: 20,
                    duration: 8,
                    requiresPharmacist: true,
                    minStaff: 2,
                    idealStaff: 3
                },
                evening: {
                    name: '晚班',
                    start: 16,
                    end: 24,
                    duration: 8,
                    requiresPharmacist: true,
                    minStaff: 1,
                    idealStaff: 2
                }
            },
            
            // 排班規則
            scheduling: {
                preferConsecutiveShifts: true,
                balanceWeekendShifts: true,
                considerEmployeePreferences: true,
                maxAttempts: 100
            }
        };
    }
    
    // 員工資料管理
    generateSampleEmployees() {
        return [
            {
                id: 'P001',
                name: '陳大明',
                role: '藥師',
                phone: '0912-345-678',
                email: 'daming@example.com',
                startDate: '2024-01-15',
                seniority: '2年2個月',
                preferredShifts: ['morning', 'afternoon'],
                unavailableDays: [0], // 週日
                maxWeeklyHours: 40,
                skillLevel: 'A',
                notes: '資深藥師，可獨立作業'
            },
            {
                id: 'P002',
                name: '林小美',
                role: '藥師',
                phone: '0923-456-789',
                email: 'xiaomei@example.com',
                startDate: '2024-08-20',
                seniority: '1年7個月',
                preferredShifts: ['afternoon', 'evening'],
                unavailableDays: [6], // 週六
                maxWeeklyHours: 40,
                skillLevel: 'A-',
                notes: '疫苗注射專長'
            },
            {
                id: 'P003',
                name: '王中平',
                role: '藥劑生',
                phone: '0934-567-890',
                email: 'zhongping@example.com',
                startDate: '2023-03-10',
                seniority: '3年',
                preferredShifts: ['morning'],
                unavailableDays: [],
                maxWeeklyHours: 40,
                skillLevel: 'B+',
                notes: '庫存管理專長'
            },
            {
                id: 'P004',
                name: '李曉芳',
                role: '藥劑生',
                phone: '0945-678-901',
                email: 'xiaofang@example.com',
                startDate: '2024-11-05',
                seniority: '1年4個月',
                preferredShifts: ['afternoon'],
                unavailableDays: [1], // 週一
                maxWeeklyHours: 40,
                skillLevel: 'B',
                notes: '細心謹慎'
            },
            {
                id: 'P005',
                name: '張偉志',
                role: '助理',
                phone: '0956-789-012',
                email: 'weizhi@example.com',
                startDate: '2025-06-15',
                seniority: '9個月',
                preferredShifts: ['evening'],
                unavailableDays: [3], // 週三晚上
                maxWeeklyHours: 32,
                skillLevel: 'C+',
                notes: '學習中，需指導'
            },
            {
                id: 'P006',
                name: '劉雅婷',
                role: '助理',
                phone: '0967-890-123',
                email: 'yating@example.com',
                startDate: '2025-01-20',
                seniority: '1年2個月',
                preferredShifts: ['morning', 'evening'],
                unavailableDays: [0], // 週日
                maxWeeklyHours: 32,
                skillLevel: 'C+',
                notes: '親切有耐心'
            }
        ];
    }
    
    loadSampleData() {
        this.employees = this.generateSampleEmployees();
        this.saveToLocalStorage();
        return this.employees;
    }
    
    // 排班資料結構
    createEmptySchedule(startDate, weeks = 4) {
        const schedule = {
            id: `schedule_${Date.now()}`,
            startDate: startDate,
            weeks: weeks,
            totalDays: weeks * 7,
            generatedAt: new Date().toISOString(),
            days: {}
        };
        
        // 初始化每一天
        const start = new Date(startDate);
        for (let i = 0; i < schedule.totalDays; i++) {
            const currentDate = new Date(start);
            currentDate.setDate(start.getDate() + i);
            const dateStr = currentDate.toISOString().split('T')[0];
            const weekday = currentDate.getDay(); // 0=週日, 1=週一, ..., 6=週六
            
            schedule.days[dateStr] = {
                date: dateStr,
                weekday: weekday,
                week: Math.floor(i / 7) + 1,
                isHoliday: this.isHoliday(dateStr, weekday),
                shifts: {
                    morning: [],
                    afternoon: [],
                    evening: []
                }
            };
        }
        
        this.schedule = schedule;
        return schedule;
    }
    
    isHoliday(dateStr, weekday) {
        // 簡單的假日判斷（可擴展）
        const date = new Date(dateStr);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        
        // 週末
        if (weekday === 0 || weekday === 6) {
            return true;
        }
        
        // 國定假日範例（需要完整台灣假日表）
        const holidays = {
            '01-01': '元旦',
            '02-28': '228紀念日',
            '04-04': '兒童節',
            '05-01': '勞動節',
            '10-10': '國慶日'
        };
        
        const key = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        return holidays[key] !== undefined;
    }
    
    // 排班操作
    assignShift(employeeId, date, shiftType) {
        if (!this.schedule || !this.schedule.days[date]) {
            console.error('排班不存在或日期無效');
            return false;
        }
        
        const employee = this.employees.find(e => e.id === employeeId);
        if (!employee) {
            console.error('員工不存在');
            return false;
        }
        
        // 檢查是否已排班
        const existingAssignment = this.findEmployeeAssignment(employeeId, date);
        if (existingAssignment) {
            console.error('員工當日已有班次');
            return false;
        }
        
        // 添加到班次
        this.schedule.days[date].shifts[shiftType].push({
            employeeId: employeeId,
            assignedAt: new Date().toISOString(),
            hours: this.rules.shifts[shiftType].duration
        });
        
        this.saveToLocalStorage();
        return true;
    }
    
    removeShift(employeeId, date, shiftType) {
        if (!this.schedule || !this.schedule.days[date]) {
            return false;
        }
        
        const shiftIndex = this.schedule.days[date].shifts[shiftType]
            .findIndex(assignment => assignment.employeeId === employeeId);
        
        if (shiftIndex === -1) {
            return false;
        }
        
        this.schedule.days[date].shifts[shiftType].splice(shiftIndex, 1);
        this.saveToLocalStorage();
        return true;
    }
    
    findEmployeeAssignment(employeeId, date) {
        if (!this.schedule || !this.schedule.days[date]) {
            return null;
        }
        
        const day = this.schedule.days[date];
        for (const shiftType of Object.keys(day.shifts)) {
            const assignment = day.shifts[shiftType].find(a => a.employeeId === employeeId);
            if (assignment) {
                return {
                    date: date,
                    shiftType: shiftType,
                    ...assignment
                };
            }
        }
        
        return null;
    }
    
    getEmployeeSchedule(employeeId) {
        if (!this.schedule) {
            return [];
        }
        
        const assignments = [];
        Object.keys(this.schedule.days).forEach(date => {
            const day = this.schedule.days[date];
            Object.keys(day.shifts).forEach(shiftType => {
                const assignment = day.shifts[shiftType].find(a => a.employeeId === employeeId);
                if (assignment) {
                    assignments.push({
                        date: date,
                        weekday: day.weekday,
                        week: day.week,
                        shiftType: shiftType,
                        shiftName: this.rules.shifts[shiftType].name,
                        hours: assignment.hours,
                        assignedAt: assignment.assignedAt
                    });
                }
            });
        });
        
        return assignments;
    }
    
    // 統計計算
    calculateEmployeeHours(employeeId) {
        const assignments = this.getEmployeeSchedule(employeeId);
        return assignments.reduce((total, assignment) => total + assignment.hours, 0);
    }
    
    calculateWeeklyHours(employeeId) {
        const assignments = this.getEmployeeSchedule(employeeId);
        const weeklyHours = {};
        
        assignments.forEach(assignment => {
            const week = assignment.week;
            if (!weeklyHours[week]) {
                weeklyHours[week] = 0;
            }
            weeklyHours[week] += assignment.hours;
        });
        
        return weeklyHours;
    }
    
    getScheduleStats() {
        if (!this.schedule) {
            return null;
        }
        
        const stats = {
            totalEmployees: this.employees.length,
            pharmacists: this.employees.filter(e => e.role === '藥師').length,
            technicians: this.employees.filter(e => e.role === '藥劑生').length,
            assistants: this.employees.filter(e => e.role === '助理').length,
            totalShifts: 0,
            coverageRate: {},
            employeeHours: {}
        };
        
        // 計算班次覆蓋率
        Object.keys(this.rules.shifts).forEach(shiftType => {
            let totalRequired = 0;
            let totalAssigned = 0;
            
            Object.keys(this.schedule.days).forEach(date => {
                const day = this.schedule.days[date];
                const required = this.getRequiredStaffCount(date, shiftType);
                const assigned = day.shifts[shiftType].length;
                
                totalRequired += required;
                totalAssigned += assigned;
            });
            
            stats.coverageRate[shiftType] = totalRequired > 0 ? 
                Math.round((totalAssigned / totalRequired) * 100) : 100;
        });
        
        // 計算員工工時
        this.employees.forEach(employee => {
            stats.employeeHours[employee.id] = {
                name: employee.name,
                totalHours: this.calculateEmployeeHours(employee.id),
                weeklyHours: this.calculateWeeklyHours(employee.id)
            };
        });
        
        return stats;
    }
    
    getRequiredStaffCount(date, shiftType) {
        const day = this.schedule.days[date];
        if (!day) return 0;
        
        const shiftRule = this.rules.shifts[shiftType];
        if (day.isHoliday || day.weekday === 0 || day.weekday === 6) {
            // 假日/週末需求較少
            return shiftRule.minStaff;
        }
        
        // 平日需求
        if (day.weekday >= 1 && day.weekday <= 5) {
            // 週一至週五
            if (shiftType === 'evening') {
                return 1; // 晚班平日1人即可
            }
            return shiftRule.minStaff;
        }
        
        return shiftRule.minStaff;
    }
    
    // 資料持久化
    saveToLocalStorage() {
        try {
            const data = {
                employees: this.employees,
                schedule: this.schedule,
                rules: this.rules,
                currentPeriod: this.currentPeriod,
                lastSaved: new Date().toISOString()
            };
            
            localStorage.setItem('pharmacy_schedule_data', JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('儲存到LocalStorage失敗:', error);
            return false;
        }
    }
    
    loadFromLocalStorage() {
        try {
            const dataStr = localStorage.getItem('pharmacy_schedule_data');
            if (!dataStr) {
                // 無資料，載入範例
                this.loadSampleData();
                return false;
            }
            
            const data = JSON.parse(dataStr);
            this.employees = data.employees || [];
            this.schedule = data.schedule || null;
            this.rules = data.rules || this.getDefaultRules();
            this.currentPeriod = data.currentPeriod || {
                startDate: '2026-04-01',
                weeks: 4,
                totalDays: 28
            };
            
            return true;
        } catch (error) {
            console.error('從LocalStorage載入失敗:', error);
            this.loadSampleData();
            return false;
        }
    }
    
    exportData() {
        const data = {
            employees: this.employees,
            schedule: this.schedule,
            rules: this.rules,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `pharmacy_schedule_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    // 驗證資料格式
                    if (!data.employees || !Array.isArray(data.employees)) {
                        throw new Error('無效的資料格式：缺少員工資料');
                    }
                    
                    this.employees = data.employees;
                    this.schedule = data.schedule || null;
                    this.rules = data.rules || this.getDefaultRules();
                    
                    this.saveToLocalStorage();
                    resolve(true);
                } catch (error) {
                    console.error('匯入資料失敗:', error);
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('讀取檔案失敗'));
            reader.readAsText(file);
        });
    }
    
    // 自動儲存
    setupAutoSave() {
        // 每30秒自動儲存
        setInterval(() => {
            if (this.hasUnsavedChanges()) {
                this.saveToLocalStorage();
                console.log('自動儲存完成');
            }
        }, 30000);
        
        // 離開頁面前提醒
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '排班資料尚未儲存，確定要離開嗎？';
            }
        });
    }
    
    hasUnsavedChanges() {
        // 簡化檢查：總是返回true以確保資料安全
        return true;
    }
    
    // 工具方法
    getEmployeeById(id) {
        return this.employees.find(e => e.id === id);
    }
    
    getEmployeesByRole(role) {
        return this.employees.filter(e => e.role === role);
    }
    
    getAvailableEmployees(date, shiftType) {
        const day = this.schedule.days[date];
        if (!day) return [];
        
        const assignedIds = day.shifts[shiftType].map(a => a.employeeId);
        
        return this.employees.filter(employee => {
            // 檢查是否已排班
            if (assignedIds.includes(employee.id)) {
                return false;
            }
            
            // 檢查不可上班日
            if (employee.unavailableDays.includes(day.weekday)) {
                return false;
            }
            
            // 檢查班次間隔（簡化）
            const yesterday = new Date(date);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            if (this.schedule.days[yesterdayStr]) {
                const yesterdayShifts = Object.keys(this.schedule.days[yesterdayStr].shifts)
                    .filter(st => this.schedule.days[yesterdayStr].shifts[st]
                        .some(a => a.employeeId === employee.id));
                
                if (yesterdayShifts.length > 0) {
                    const lastShift = yesterdayShifts[0]; // 簡化：取第一個班次
