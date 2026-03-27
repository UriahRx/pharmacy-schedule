// 自動排班引擎 - 核心演算法
class AutoScheduler {
    constructor(dataManager, validator) {
        this.dataManager = dataManager;
        this.validator = validator;
        this.rules = dataManager.rules;
        this.maxAttempts = 100;
    }
    
    // 主排班方法
    generateSchedule(startDate, weeks = 4) {
        console.log('開始生成排班表...');
        
        // 1. 建立空排班表
        const schedule = this.dataManager.createEmptySchedule(startDate, weeks);
        
        // 2. 四階段排班演算法
        this.phase1AssignMandatoryShifts(schedule);
        this.phase2FillRemainingShifts(schedule);
        this.phase3OptimizeFairness(schedule);
        
        // 3. 法律合規檢查與調整
        const complianceResult = this.phase4LegalComplianceCheck(schedule);
        
        console.log('排班生成完成', complianceResult);
        return {
            schedule: schedule,
            compliance: complianceResult
        };
    }
    
    // 階段1：安排必要班次（確保每班有藥師）
    phase1AssignMandatoryShifts(schedule) {
        console.log('階段1：安排必要班次（藥師）');
        
        const pharmacists = this.dataManager.getEmployeesByRole('藥師');
        if (pharmacists.length === 0) {
            console.warn('警告：沒有藥師員工');
            return;
        }
        
        Object.keys(schedule.days).forEach(date => {
            const day = schedule.days[date];
            
            // 對每個需要藥師的班別
            Object.keys(this.rules.shifts).forEach(shiftType => {
                const shiftRule = this.rules.shifts[shiftType];
                if (shiftRule.requiresPharmacist && day.shifts[shiftType].length === 0) {
                    // 尋找可用的藥師
                    const availablePharmacist = this.findAvailableEmployee(
                        pharmacists, date, shiftType, schedule
                    );
                    
                    if (availablePharmacist) {
                        this.assignEmployeeToShift(availablePharmacist.id, date, shiftType, schedule);
                    } else {
                        console.warn(`無法為 ${date} ${shiftRule.name} 安排藥師`);
                    }
                }
            });
        });
    }
    
    // 階段2：填補剩餘班次
    phase2FillRemainingShifts(schedule) {
        console.log('階段2：填補剩餘班次');
        
        let attempts = 0;
        let allFilled = false;
        
        while (!allFilled && attempts < this.maxAttempts) {
            allFilled = true;
            
            Object.keys(schedule.days).forEach(date => {
                const day = schedule.days[date];
                
                Object.keys(this.rules.shifts).forEach(shiftType => {
                    const assignedCount = day.shifts[shiftType].length;
                    const requiredCount = this.dataManager.getRequiredStaffCount(date, shiftType);
                    
                    if (assignedCount < requiredCount) {
                        allFilled = false;
                        
                        // 尋找合適的員工
                        const candidate = this.findBestCandidate(date, shiftType, schedule);
                        if (candidate) {
                            this.assignEmployeeToShift(candidate.id, date, shiftType, schedule);
                        }
                    }
                });
            });
            
            attempts++;
        }
        
        if (!allFilled) {
            console.warn(`經過 ${attempts} 次嘗試後仍有空缺`);
        }
    }
    
    // 階段3：優化公平性
    phase3OptimizeFairness(schedule) {
        console.log('階段3：優化公平性');
        
        // 3.1 平衡週末班次
        this.balanceWeekendShifts(schedule);
        
        // 3.2 考慮員工偏好
        this.considerEmployeePreferences(schedule);
        
        // 3.3 優化連續班次
        this.optimizeConsecutiveShifts(schedule);
    }
    
    // 階段4：法律合規檢查與調整
    phase4LegalComplianceCheck(schedule) {
        console.log('階段4：法律合規檢查與調整');
        
        // 儲存原始排班
        const originalSchedule = JSON.parse(JSON.stringify(schedule));
        
        let attempts = 0;
        let lastViolationCount = Infinity;
        
        while (attempts < 20) { // 最多嘗試20次調整
            const validation = this.validator.validateFullSchedule();
            
            if (validation.isValid) {
                console.log(`✅ 經過 ${attempts} 次調整後完全合規`);
                return validation;
            }
            
            const currentViolationCount = validation.violations.length;
            
            // 如果違規沒有減少，嘗試更激進的調整
            if (currentViolationCount >= lastViolationCount) {
                console.log('違規未減少，嘗試重新排班');
                this.adjustForStubbornViolations(schedule, validation.violations);
            } else {
                // 針對違規進行調整
                this.adjustForViolations(schedule, validation.violations);
            }
            
            lastViolationCount = currentViolationCount;
            attempts++;
        }
        
        console.warn(`⚠️ 經過 ${attempts} 次調整仍無法完全合規`);
        return this.validator.validateFullSchedule();
    }
    
    // 尋找可用員工
    findAvailableEmployee(employees, date, shiftType, schedule) {
        const candidates = employees.filter(employee => 
            this.isEmployeeAvailable(employee, date, shiftType, schedule)
        );
        
        if (candidates.length === 0) {
            return null;
        }
        
        // 評分選擇最佳員工
        return this.selectBestEmployee(candidates, date, shiftType, schedule);
    }
    
    // 檢查員工是否可用
    isEmployeeAvailable(employee, date, shiftType, schedule) {
        const day = schedule.days[date];
        if (!day) return false;
        
        // 1. 檢查不可上班日
        if (employee.unavailableDays.includes(day.weekday)) {
            return false;
        }
        
        // 2. 檢查是否已排班（當日）
        const existingAssignment = this.dataManager.findEmployeeAssignment(employee.id, date);
        if (existingAssignment) {
            return false;
        }
        
        // 3. 檢查本週工時
        const weeklyHours = this.calculateEmployeeWeeklyHours(employee.id, schedule, day.week);
        const shiftHours = this.rules.shifts[shiftType].duration;
        
        if (weeklyHours + shiftHours > employee.maxWeeklyHours) {
            return false;
        }
        
        // 4. 檢查四週總工時
        const totalHours = this.calculateEmployeeTotalHours(employee.id, schedule);
        if (totalHours + shiftHours > this.rules.laborLaw.max4WeekHours) {
            return false;
        }
        
        // 5. 檢查連續工作天數
        if (this.isEmployeeAtConsecutiveLimit(employee.id, date, schedule)) {
            return false;
        }
        
        // 6. 檢查班次間隔
        if (!this.checkShiftInterval(employee.id, date, shiftType, schedule)) {
            return false;
        }
        
        return true;
    }
    
    // 選擇最佳員工（評分系統）
    selectBestEmployee(candidates, date, shiftType, schedule) {
        const scores = candidates.map(employee => ({
            employee: employee,
            score: this.calculateEmployeeScore(employee, date, shiftType, schedule)
        }));
        
        // 按分數排序（高分優先）
        scores.sort((a, b) => b.score - a.score);
        
        return scores.length > 0 ? scores[0].employee : null;
    }
    
    // 計算員工評分
    calculateEmployeeScore(employee, date, shiftType, schedule) {
        let score = 0;
        const day = schedule.days[date];
        
        // 1. 偏好加分（最高權重）
        if (employee.preferredShifts.includes(shiftType)) {
            score += 50;
        }
        
        // 2. 公平性：工時少的優先
        const totalHours = this.calculateEmployeeTotalHours(employee.id, schedule);
        score += (this.rules.laborLaw.max4WeekHours - totalHours) * 0.5;
        
        // 3. 週末班公平性
        if (day.weekday === 0 || day.weekday === 6) { // 週末
            const weekendShifts = this.countWeekendShifts(employee.id, schedule);
            score -= weekendShifts * 15; // 週末班越多，分數越低
        }
        
        // 4. 技能需求
        const shiftRule = this.rules.shifts[shiftType];
        if (shiftRule.requiresPharmacist && employee.role === '藥師') {
            score += 30;
        }
        
        // 5. 連續工作懲罰
        if (this.getConsecutiveDays(employee.id, date, schedule) >= 5) {
            score -= 20;
        }
        
        // 6. 隨機因素（避免完全確定性）
        score += Math.random() * 5;
        
        return score;
    }
    
    // 尋找最佳候選人（考慮更多因素）
    findBestCandidate(date, shiftType, schedule) {
        const day = schedule.days[date];
        const allEmployees = this.dataManager.employees;
        
        // 過濾可用員工
        const availableEmployees = allEmployees.filter(employee =>
            this.isEmployeeAvailable(employee, date, shiftType, schedule)
        );
        
        if (availableEmployees.length === 0) {
            // 嘗試放寬條件（允許加班）
            const flexibleEmployees = allEmployees.filter(employee => {
                // 基本檢查（除了工時限制）
                if (employee.unavailableDays.includes(day.weekday)) {
                    return false;
                }
                
                const existingAssignment = this.dataManager.findEmployeeAssignment(employee.id, date);
                if (existingAssignment) {
                    return false;
                }
                
                if (this.isEmployeeAtConsecutiveLimit(employee.id, date, schedule)) {
                    return false;
                }
                
                if (!this.checkShiftInterval(employee.id, date, shiftType, schedule)) {
                    return false;
                }
                
                return true;
            });
            
            if (flexibleEmployees.length > 0) {
                // 選擇工時最少的員工（公平性）
                return flexibleEmployees.reduce((min, emp) => {
                    const minHours = this.calculateEmployeeTotalHours(min.id, schedule);
                    const empHours = this.calculateEmployeeTotalHours(emp.id, schedule);
                    return empHours < minHours ? emp : min;
                });
            }
            
            return null;
        }
        
        // 使用評分系統選擇
        return this.selectBestEmployee(availableEmployees, date, shiftType, schedule);
    }
    
    // 安排員工到班次
    assignEmployeeToShift(employeeId, date, shiftType, schedule) {
        const day = schedule.days[date];
        if (!day) return false;
        
        // 檢查是否已存在
        const existing = day.shifts[shiftType].find(a => a.employeeId === employeeId);
        if (existing) return true;
        
        day.shifts[shiftType].push({
            employeeId: employeeId,
            assignedAt: new Date().toISOString(),
            hours: this.rules.shifts[shiftType].duration
        });
        
        return true;
    }
    
    // 平衡週末班次
    balanceWeekendShifts(schedule) {
        const weekendDays = Object.keys(schedule.days).filter(date => {
            const day = schedule.days[date];
            return day.weekday === 0 || day.weekday === 6; // 週末
        });
        
        if (weekendDays.length === 0) return;
        
        // 計算每位員工的週末班次數
        const weekendCounts = {};
        this.dataManager.employees.forEach(emp => {
            weekendCounts[emp.id] = 0;
        });
        
        weekendDays.forEach(date => {
            const day = schedule.days[date];
            Object.keys(day.shifts).forEach(shiftType => {
                day.shifts[shiftType].forEach(assignment => {
                    weekendCounts[assignment.employeeId] = (weekendCounts[assignment.employeeId] || 0) + 1;
                });
            });
        });
        
        // 找出週末班最多和最少的員工
        const sortedEmployees = this.dataManager.employees
            .map(emp => ({ ...emp, count: weekendCounts[emp.id] || 0 }))
            .sort((a, b) => a.count - b.count);
        
        // 嘗試重新分配（簡化版本）
        // 實際實現需要更複雜的交換邏輯
    }
    
    // 考慮員工偏好
    considerEmployeePreferences(schedule) {
        // 嘗試將員工調整到偏好班次
        Object.keys(schedule.days).forEach(date => {
            const day = schedule.days[date];
            
            Object.keys(day.shifts).forEach(shiftType => {
                day.shifts[shiftType].forEach((assignment, index) => {
                    const employee = this.dataManager.getEmployeeById(assignment.employeeId);
                    if (!employee) return;
                    
                    // 如果員工不偏好這個班次，嘗試交換
                    if (!employee.preferredShifts.includes(shiftType)) {
                        // 尋找偏好此班次且可交換的員工
                        const preferredEmployee = this.dataManager.employees.find(emp => 
                            emp.preferredShifts.includes(shiftType) &&
                            emp.id !== employee.id &&
                            this.canSwapShifts(employee.id, emp.id, date, shiftType, schedule)
                        );
                        
                        if (preferredEmployee) {
                            // 執行交換（簡化）
                            this.swapShifts(employee.id, preferredEmployee.id, date, shiftType, schedule);
                        }
                    }
                });
            });
        });
    }
    
    // 優化連續班次
    optimizeConsecutiveShifts(schedule) {
        // 嘗試讓員工有連續的班次（減少通勤）
        this.dataManager.employees.forEach(employee => {
            const assignments = this.dataManager.getEmployeeSchedule(employee.id);
            const assignmentDates = assignments.map(a => a.date).sort();
            
            // 找出孤立的班次（前後都沒班）
            for (let i = 0; i < assignmentDates.length; i++) {
                const currentDate = assignmentDates[i];
                const prevDate = i > 0 ? assignmentDates[i-1] : null;
                const nextDate = i < assignmentDates.length-1 ? assignmentDates[i+1] : null;
                
                const currentDay = new Date(currentDate);
                const prevDay = prevDate ? new Date(prevDate) : null;
                const nextDay = nextDate ? new Date(nextDate) : null;
                
                // 如果前後都沒班（間隔>1天），嘗試移動到有班的日子附近
                const prevDiff = prevDay ? (currentDay - prevDay) / (1000*60*60*24) : Infinity;
                const nextDiff = nextDay ? (nextDay - currentDay) / (1000*60*60*24) : Infinity;
                
                if (prevDiff > 2 && nextDiff > 2) {
                    // 孤立的班次，嘗試移動
                    this.tryMoveIsolatedShift(employee.id, currentDate, schedule);
                }
            }
        });
    }
    
    // 針對違規進行調整
    adjustForViolations(schedule, violations) {
        violations.forEach(violation => {
            switch (violation.type) {
                case '4week_hours_exceeded':
                case 'weekly_hours_exceeded':
                    this.adjustForOvertime(violation, schedule);
                    break;
                    
                case 'consecutive_days_exceeded':
                    this.adjustForConsecutiveDays(violation, schedule);
                    break;
                    
                case 'insufficient_rest_days':
                    this.adjustForRestDays(violation, schedule);
                    break;
                    
                case 'insufficient_shift_interval':
                    this.adjustForShiftInterval(violation, schedule);
                    break;
                    
                case 'unavailable_day_violation':
                    this.adjustForUnavailableDay(violation, schedule);
                    break;
                    
                case 'insufficient_staff':
                case 'missing_pharmacist':
                    this.adjustForStaffing(violation, schedule);
                    break;
            }
        });
    }
    
    // 調整加班違規
    adjustForOvertime(violation, schedule) {
        const employee = this.dataManager.employees.find(e => e.name === violation.employeeName);
        if (!employee) return;
        
        // 找出該員工的班次，嘗試移除一些
        const assignments = this.dataManager.getEmployeeSchedule(employee.id);
        
        // 按重要性排序（週末、非偏好班次優先移除）
        const sortedAssignments = assignments.sort((a, b) => {
            const aDay = schedule.days[a.date];
            const bDay = schedule.days[b.date];
            
            // 週末班次優先保留
            if (aDay.weekday === 0 || aDay.weekday === 6) return 1;
            if (bDay.weekday === 0 || bDay.weekday === 6) return -1;
            
            // 非偏好班次優先移除
            const aIsPreferred = employee.preferredShifts.includes(a.shiftType);
            const bIsPreferred = employee.preferredShifts.includes(b.shiftType);
            
            if (!aIsPreferred && bIsPreferred) return -1;
            if (aIsPreferred && !bIsPreferred) return 1;
            
            return 0;
        });
        
        // 移除一個班次
        if (sortedAssignments.length > 0) {
            const toRemove = sortedAssignments[