// 台灣勞基法合規檢查器
class LaborLawValidator {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.rules = dataManager.rules.laborLaw;
    }
    
    // 完整排班合規檢查
    validateFullSchedule() {
        if (!this.dataManager.schedule) {
            return {
                isValid: false,
                message: '無排班資料',
                violations: [],
                summary: {}
            };
        }
        
        const violations = [];
        const employeeChecks = {};
        
        // 檢查每位員工
        this.dataManager.employees.forEach(employee => {
            const employeeResult = this.validateEmployeeSchedule(employee.id);
            employeeChecks[employee.id] = employeeResult;
            
            if (!employeeResult.isValid) {
                violations.push(...employeeResult.violations.map(v => ({
                    ...v,
                    employeeName: employee.name
                })));
            }
        });
        
        // 檢查每日人力配置
        const coverageViolations = this.validateDailyCoverage();
        violations.push(...coverageViolations);
        
        // 生成總結報告
        const summary = this.generateSummary(employeeChecks);
        
        return {
            isValid: violations.length === 0,
            violations: violations,
            summary: summary,
            employeeChecks: employeeChecks
        };
    }
    
    // 檢查單一員工排班
    validateEmployeeSchedule(employeeId) {
        const employee = this.dataManager.getEmployeeById(employeeId);
        if (!employee) {
            return {
                isValid: false,
                violations: [{ type: 'employee_not_found', message: '員工不存在' }]
            };
        }
        
        const assignments = this.dataManager.getEmployeeSchedule(employeeId);
        const violations = [];
        
        // 1. 四週總工時檢查
        const totalHours = assignments.reduce((sum, a) => sum + a.hours, 0);
        if (totalHours > this.rules.max4WeekHours) {
            violations.push({
                type: '4week_hours_exceeded',
                actual: totalHours,
                limit: this.rules.max4WeekHours,
                excess: totalHours - this.rules.max4WeekHours,
                message: `四週總工時 ${totalHours} 小時，超過上限 ${this.rules.max4WeekHours} 小時`
            });
        }
        
        // 2. 每週工時檢查
        const weeklyHours = this.calculateWeeklyHours(assignments);
        weeklyHours.forEach((hours, weekIndex) => {
            if (hours > this.rules.maxWeeklyHours) {
                violations.push({
                    type: 'weekly_hours_exceeded',
                    week: weekIndex + 1,
                    actual: hours,
                    limit: this.rules.maxWeeklyHours,
                    excess: hours - this.rules.maxWeeklyHours,
                    message: `第${weekIndex + 1}週工時 ${hours} 小時，超過上限 ${this.rules.maxWeeklyHours} 小時`
                });
            }
        });
        
        // 3. 連續工作天數檢查
        const consecutiveDays = this.checkConsecutiveDays(assignments);
        if (consecutiveDays > this.rules.maxConsecutiveDays) {
            violations.push({
                type: 'consecutive_days_exceeded',
                actual: consecutiveDays,
                limit: this.rules.maxConsecutiveDays,
                message: `連續工作 ${consecutiveDays} 天，超過上限 ${this.rules.maxConsecutiveDays} 天`
            });
        }
        
        // 4. 休息日檢查
        const restDays = this.checkRestDays(assignments);
        if (restDays < this.rules.minRestDaysPerWeek) {
            violations.push({
                type: 'insufficient_rest_days',
                actual: restDays,
                required: this.rules.minRestDaysPerWeek,
                message: `平均每週休息 ${restDays.toFixed(1)} 天，少於要求 ${this.rules.minRestDaysPerWeek} 天`
            });
        }
        
        // 5. 班次間隔檢查
        const intervalViolations = this.checkShiftIntervals(assignments);
        violations.push(...intervalViolations);
        
        // 6. 不可上班日檢查
        const unavailableViolations = this.checkUnavailableDays(employee, assignments);
        violations.push(...unavailableViolations);
        
        return {
            isValid: violations.length === 0,
            violations: violations,
            totalHours: totalHours,
            weeklyHours: weeklyHours,
            consecutiveDays: consecutiveDays,
            restDays: restDays
        };
    }
    
    // 計算每週工時
    calculateWeeklyHours(assignments) {
        const weeklyHours = [0, 0, 0, 0]; // 假設最多4週
        
        assignments.forEach(assignment => {
            const weekIndex = assignment.week - 1;
            if (weekIndex >= 0 && weekIndex < weeklyHours.length) {
                weeklyHours[weekIndex] += assignment.hours;
            }
        });
        
        return weeklyHours;
    }
    
    // 檢查連續工作天數
    checkConsecutiveDays(assignments) {
        if (assignments.length === 0) return 0;
        
        // 按日期排序
        const sortedDates = assignments
            .map(a => a.date)
            .sort()
            .map(date => new Date(date).getTime());
        
        let maxConsecutive = 1;
        let currentConsecutive = 1;
        
        for (let i = 1; i < sortedDates.length; i++) {
            const diffDays = (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24);
            
            if (diffDays === 1) {
                currentConsecutive++;
                maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
            } else if (diffDays > 1) {
                currentConsecutive = 1;
            }
        }
        
        return maxConsecutive;
    }
    
    // 檢查休息日
    checkRestDays(assignments) {
        if (assignments.length === 0) return 7; // 沒上班 = 全休息
        
        // 取得排班期間
        const dates = assignments.map(a => a.date).sort();
        const startDate = new Date(dates[0]);
        const endDate = new Date(dates[dates.length - 1]);
        
        const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24) + 1;
        const workDays = new Set(dates).size; // 去除重複日期
        
        const restDays = totalDays - workDays;
        const weeks = totalDays / 7;
        
        return weeks > 0 ? restDays / weeks : 0;
    }
    
    // 檢查班次間隔
    checkShiftIntervals(assignments) {
        const violations = [];
        
        // 按日期排序
        const sortedAssignments = [...assignments].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );
        
        for (let i = 1; i < sortedAssignments.length; i++) {
            const prev = sortedAssignments[i - 1];
            const curr = sortedAssignments[i];
            
            const prevDate = new Date(prev.date);
            const currDate = new Date(curr.date);
            const diffDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);
            
            if (diffDays === 1) {
                // 連續兩天上班，檢查班次間隔
                const prevShift = this.dataManager.rules.shifts[prev.shiftType];
                const currShift = this.dataManager.rules.shifts[curr.shiftType];
                
                if (prevShift && currShift) {
                    const interval = (24 - prevShift.end) + currShift.start;
                    if (interval < this.rules.minShiftInterval) {
                        violations.push({
                            type: 'insufficient_shift_interval',
                            date1: prev.date,
                            date2: curr.date,
                            shift1: prevShift.name,
                            shift2: currShift.name,
                            interval: interval,
                            required: this.rules.minShiftInterval,
                            message: `${prev.date} ${prevShift.name} → ${curr.date} ${currShift.name} 間隔 ${interval} 小時，少於要求 ${this.rules.minShiftInterval} 小時`
                        });
                    }
                }
            }
        }
        
        return violations;
    }
    
    // 檢查不可上班日
    checkUnavailableDays(employee, assignments) {
        const violations = [];
        
        assignments.forEach(assignment => {
            const date = new Date(assignment.date);
            const weekday = date.getDay(); // 0=週日, 1=週一, ..., 6=週六
            
            if (employee.unavailableDays.includes(weekday)) {
                const weekdayNames = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
                violations.push({
                    type: 'unavailable_day_violation',
                    date: assignment.date,
                    weekday: weekdayNames[weekday],
                    shift: this.dataManager.rules.shifts[assignment.shiftType]?.name || assignment.shiftType,
                    message: `${assignment.date} (${weekdayNames[weekday]}) 為不可上班日，但排了 ${this.dataManager.rules.shifts[assignment.shiftType]?.name || assignment.shiftType}`
                });
            }
        });
        
        return violations;
    }
    
    // 檢查每日人力配置
    validateDailyCoverage() {
        const violations = [];
        
        if (!this.dataManager.schedule) {
            return violations;
        }
        
        Object.keys(this.dataManager.schedule.days).forEach(date => {
            const day = this.dataManager.schedule.days[date];
            
            Object.keys(day.shifts).forEach(shiftType => {
                const assignedCount = day.shifts[shiftType].length;
                const requiredCount = this.dataManager.getRequiredStaffCount(date, shiftType);
                
                if (assignedCount < requiredCount) {
                    const shiftName = this.dataManager.rules.shifts[shiftType]?.name || shiftType;
                    violations.push({
                        type: 'insufficient_staff',
                        date: date,
                        shift: shiftName,
                        assigned: assignedCount,
                        required: requiredCount,
                        message: `${date} ${shiftName} 只有 ${assignedCount} 人，需要 ${requiredCount} 人`
                    });
                }
                
                // 檢查是否有藥師（如果需要）
                const shiftRule = this.dataManager.rules.shifts[shiftType];
                if (shiftRule.requiresPharmacist) {
                    const hasPharmacist = day.shifts[shiftType].some(assignment => {
                        const employee = this.dataManager.getEmployeeById(assignment.employeeId);
                        return employee && employee.role === '藥師';
                    });
                    
                    if (!hasPharmacist) {
                        const shiftName = this.dataManager.rules.shifts[shiftType]?.name || shiftType;
                        violations.push({
                            type: 'missing_pharmacist',
                            date: date,
                            shift: shiftName,
                            message: `${date} ${shiftName} 缺少藥師`
                        });
                    }
                }
            });
        });
        
        return violations;
    }
    
    // 生成總結報告
    generateSummary(employeeChecks) {
        const totalEmployees = this.dataManager.employees.length;
        const compliantEmployees = Object.values(employeeChecks)
            .filter(check => check.isValid).length;
        
        const complianceRate = totalEmployees > 0 ? 
            Math.round((compliantEmployees / totalEmployees) * 100) : 0;
        
        // 收集所有違規類型
        const violationTypes = {};
        Object.values(employeeChecks).forEach(check => {
            check.violations?.forEach(violation => {
                violationTypes[violation.type] = (violationTypes[violation.type] || 0) + 1;
            });
        });
        
        // 計算平均工時
        let totalHours = 0;
        let employeeCount = 0;
        
        Object.values(employeeChecks).forEach(check => {
            if (check.totalHours !== undefined) {
                totalHours += check.totalHours;
                employeeCount++;
            }
        });
        
        const avgHours = employeeCount > 0 ? totalHours / employeeCount : 0;
        
        return {
            totalEmployees: totalEmployees,
            compliantEmployees: compliantEmployees,
            complianceRate: complianceRate,
            violationTypes: violationTypes,
            totalViolations: Object.values(violationTypes).reduce((sum, count) => sum + count, 0),
            averageHours: Math.round(avgHours * 10) / 10,
            status: complianceRate === 100 ? '完全合規' : 
                   complianceRate >= 80 ? '基本合規' :
                   complianceRate >= 60 ? '部分合規' : '嚴重違規'
        };
    }
    
    // 快速檢查（用於即時反饋）
    quickCheck(employeeId, date, shiftType) {
        const employee = this.dataManager.getEmployeeById(employeeId);
        if (!employee) {
            return { isValid: false, warnings: ['員工不存在'] };
        }
        
        const warnings = [];
        
        // 檢查不可上班日
        const day = this.dataManager.schedule.days[date];
        if (day && employee.unavailableDays.includes(day.weekday)) {
            const weekdayNames = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
            warnings.push(`⚠️ ${weekdayNames[day.weekday]} 為不可上班日`);
        }
        
        // 檢查連續工作
        const assignments = this.dataManager.getEmployeeSchedule(employeeId);
        const recentAssignments = assignments
            .filter(a => {
                const assignmentDate = new Date(a.date);
                const checkDate = new Date(date);
                const diffDays = (checkDate - assignmentDate) / (1000 * 60 * 60 * 24);
                return diffDays >= 0 && diffDays <= 6; // 最近一週
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (recentAssignments.length >= 6) {
            // 檢查是否連續6天
            let consecutive = 1;
            for (let i = 1; i < recentAssignments.length; i++) {
                const date1 = new Date(recentAssignments[i-1].date);
                const date2 = new Date(recentAssignments[i].date);
                const diffDays = (date2 - date1) / (1000 * 60 * 60 * 24);
                
                if (diffDays === 1) {
                    consecutive++;
                    if (consecutive >= 6) {
                        warnings.push('⚠️ 已連續工作接近6天');
                        break;
                    }
                } else {
                    consecutive = 1;
                }
            }
        }
        
        // 檢查本週工時
        const weeklyHours = this.calculateWeeklyHours(assignments);
        const currentWeek = day ? day.week : 1;
        const weekIndex = currentWeek - 1;
        
        if (weekIndex >= 0 && weekIndex < weeklyHours.length) {
            const shiftHours = this.dataManager.rules.shifts[shiftType]?.duration || 8;
            const projectedHours = weeklyHours[weekIndex] + shiftHours;
            
            if (projectedHours > this.rules.maxWeeklyHours) {
                warnings.push(`⚠️ 本週工時將達 ${projectedHours} 小時，超過 ${this.rules.maxWeeklyHours} 小時上限`);
            }
        }
        
        // 檢查四週總工時
        const totalHours = assignments.reduce((sum, a) => sum + a.hours, 0);
        const newTotalHours = totalHours + (this.dataManager.rules.shifts[shiftType]?.duration || 8);
        
        if (newTotalHours > this.rules.max4WeekHours) {
            warnings.push(`⚠️ 四週總工時將達 ${newTotalHours} 小時，超過 ${this.rules.max4WeekHours} 小時上限`);
        }
        
        return {
            isValid: warnings.length === 0,
            warnings: warnings,
            employee: employee.name,
            currentHours: totalHours,
            projectedHours: newTotalHours
        };
    }
    
    // 生成詳細報告HTML
    generateReportHTML(validationResult) {
        if (!validationResult.isValid) {
            let html = `
                <div class="compliance-error">
                    <h4>❌ 排班存在違規項目</h4>
                    <p>共發現 ${validationResult.violations.length} 個違規項目</p>
                    
                    <div class="violation-summary">
                        <h5>違規類型統計：</h5>
                        <ul>
            `;
            
            const typeCounts = {};
            validationResult.violations.forEach(v => {
                typeCounts[v.type] = (typeCounts[v.type] || 0) + 1;
            });
            
            Object.entries(typeCounts).forEach(([type, count]) => {
                const typeName = this.getViolationTypeName(type);
                html += `<li>${typeName}: ${count} 項</li>`;
            });
            
            html += `
                        </ul>
                    </div>
                    
                    <div class="violation-details">
                        <h5>詳細違規：</h5>
            `;
            
            // 分組顯示：按員工分組
            const violationsByEmployee = {};
            validationResult.violations.forEach(v => {
                if (!violationsByEmployee[v.employeeName]) {
                    violationsByEmployee[v.employeeName] = [];
                }
                violationsByEmployee[v.employeeName].push(v);
            });
            
            Object.entries(violationsByEmployee).forEach(([employeeName, violations]) => {
                html += `<div class="employee-violations">
                            <h6>👤 ${employeeName}</h6>
                            <ul>`;
                
                violations.forEach(v => {
                    html += `<li>${v.message}</li>`;
                });
                
                html += `</ul></div>`;
