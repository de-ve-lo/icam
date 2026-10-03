class DashboardManager {
    constructor(appRef) {
        this.app = appRef;
        this.chart = null;
        this.stats = {};
        this.refreshInterval = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Auto-refresh every 5 minutes
        this.refreshInterval = setInterval(() => {
            if (this.app.currentSection === 'dashboard') {
                this.loadData();
            }
        }, 300000); // 5 minutes
    }

    async loadData() {
        try {
            this.app.showLoading();
            this.stats = await Database.getDashboardStats();
            this.updateStatCards();
            await this.loadChart();
            await this.loadRecentActivity();
            await this.loadOverdueWarnings();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.app.showNotification('Failed to load dashboard data', 'error');
        } finally {
            this.app.hideLoading();
        }
    }

    updateStatCards() {
        // Update main dashboard cards
        const elements = {
            'total-customers': this.stats.totalCustomers || 0,
            'total-stock': this.stats.totalStock || 0,
            'pending-amount': Utils.formatCurrency(this.stats.pendingAmount || 0),
            'overdue-installments': this.stats.overdueInstallments || 0
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
                element.classList.add('stat-updated');
                setTimeout(() => element.classList.remove('stat-updated'), 1000);
            }
        });

        // Update additional stats if dashboard is expanded
        this.updateAdditionalStats();
    }

    updateAdditionalStats() {
        // Add additional dashboard stats
        const dashboardGrid = document.querySelector('.dashboard-grid');
        if (!dashboardGrid) return;

        // Check if additional cards already exist
        if (dashboardGrid.children.length <= 4) {
            const additionalCards = `
                <div class="dashboard-card">
                    <div class="card-icon">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div class="card-content">
                        <h3 id="monthly-collection">${Utils.formatCurrency(this.stats.monthlyCollection || 0)}</h3>
                        <p>This Month Collection</p>
                    </div>
                </div>
                
                <div class="dashboard-card">
                    <div class="card-icon">
                        <i class="fas fa-user-check"></i>
                    </div>
                    <div class="card-content">
                        <h3 id="active-customers">${this.stats.activeCustomers || 0}</h3>
                        <p>Active Customers</p>
                    </div>
                </div>
                
                <div class="dashboard-card">
                    <div class="card-icon">
                        <i class="fas fa-coins"></i>
                    </div>
                    <div class="card-content">
                        <h3 id="total-profit">${Utils.formatCurrency(this.stats.totalProfit || 0)}</h3>
                        <p>Total Profit</p>
                    </div>
                </div>
                
                <div class="dashboard-card">
                    <div class="card-icon">
                        <i class="fas fa-boxes"></i>
                    </div>
                    <div class="card-content">
                        <h3 id="sold-stock">${this.stats.totalSoldStock || 0}</h3>
                        <p>Items Sold</p>
                    </div>
                </div>
            `;
            dashboardGrid.insertAdjacentHTML('beforeend', additionalCards);
        } else {
            // Update existing additional cards
            const updates = {
                'monthly-collection': Utils.formatCurrency(this.stats.monthlyCollection || 0),
                'active-customers': this.stats.activeCustomers || 0,
                'total-profit': Utils.formatCurrency(this.stats.totalProfit || 0),
                'sold-stock': this.stats.totalSoldStock || 0
            };
            
            Object.entries(updates).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) element.textContent = value;
            });
        }
    }

    async loadChart() {
        const ctx = document.getElementById('installment-chart');
        if (!ctx) return;

        try {
            // Get actual monthly collection data
            const monthlyData = await Database.getMonthlyCollectionData(6);
            
            // Fill in missing months with zero values
            const last6Months = this.getLast6Months();
            const chartData = last6Months.map(month => {
                const found = monthlyData.find(d => d.month === month.value);
                return {
                    label: month.label,
                    value: found ? found.total : 0
                };
            });

            const data = {
                labels: chartData.map(d => d.label),
                datasets: [{
                    label: 'Collections (Rs.)',
                    data: chartData.map(d => d.value),
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderColor: 'rgba(37, 99, 235, 1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            };

            if (this.chart) {
                this.chart.destroy();
            }

            this.chart = new Chart(ctx, {
                type: 'line',
                data: data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => `Collections: ${Utils.formatCurrency(context.parsed.y)}`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return Utils.formatCurrency(value);
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });
        } catch (error) {
            console.error('Error loading chart data:', error);
            // Fallback to sample data
            this.loadSampleChart(ctx);
        }
    }

    loadSampleChart(ctx) {
        const data = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Collections',
                data: [12000, 19000, 3000, 5000, 2000, 3000],
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderColor: 'rgba(37, 99, 235, 1)',
                borderWidth: 2,
                fill: true
            }]
        };

        if (this.chart) {
            this.chart.destroy();
        }

        this.chart = new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    getLast6Months() {
        const months = [];
        const now = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
                label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            });
        }
        
        return months;
    }

    async loadRecentActivity() {
        const container = document.getElementById('recent-activity');
        if (!container) {
            // Create recent activity section if it doesn't exist
            this.createRecentActivitySection();
            return;
        }

        try {
            const endDate = Utils.getCurrentDate('YYYY-MM-DD');
            const startDate = Utils.formatDate(Utils.addMonths(new Date(), -1), 'YYYY-MM-DD');
            const payments = await Database.getPaymentHistory(startDate, endDate);
            
            const recentPayments = payments.slice(0, 5); // Show last 5 payments
            
            container.innerHTML = `
                <h4><i class="fas fa-clock"></i> Recent Payments</h4>
                ${recentPayments.length === 0 ? 
                    '<p class="text-muted">No recent payments found</p>' :
                    `<div class="activity-list">
                        ${recentPayments.map(payment => `
                            <div class="activity-item">
                                <div class="activity-icon">
                                    <i class="fas fa-money-bill text-success"></i>
                                </div>
                                <div class="activity-content">
                                    <div class="activity-title">
                                        ${payment.account_no} - Installment #${payment.installment_no}
                                    </div>
                                    <div class="activity-meta">
                                        ${Utils.formatCurrency(payment.amount)} • ${Utils.formatDate(payment.payment_date, 'readable')}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>`
                }
            `;
        } catch (error) {
            console.error('Error loading recent activity:', error);
            container.innerHTML = '<h4><i class="fas fa-clock"></i> Recent Payments</h4><p class="text-muted">Unable to load recent activity</p>';
        }
    }

    async loadOverdueWarnings() {
        const container = document.getElementById('overdue-warnings');
        if (!container) {
            this.createOverdueWarningsSection();
            return;
        }

        try {
            const overdueInstallments = await Database.getOverdueInstallments();
            const criticalOverdue = overdueInstallments.slice(0, 5); // Show top 5 overdue
            
            container.innerHTML = `
                <h4><i class="fas fa-exclamation-triangle text-warning"></i> Overdue Payments</h4>
                ${criticalOverdue.length === 0 ? 
                    '<p class="text-success">No overdue payments!</p>' :
                    `<div class="warning-list">
                        ${criticalOverdue.map(item => `
                            <div class="warning-item">
                                <div class="warning-content">
                                    <div class="warning-title">
                                        ${item.account_no} - ${Utils.truncate(item.item_name, 20)}
                                    </div>
                                    <div class="warning-meta">
                                        ${Utils.formatCurrency(item.remaining_amount != null ? item.remaining_amount : Math.max(0, (item.original_amount || item.amount || 0) - (item.paid_amount || 0)))} • 
                                        ${item.days_overdue} days overdue
                                    </div>
                                </div>
                                <div class="warning-action">
                                    <button class="btn btn-sm btn-outline-primary" 
                                        onclick="app.navigateToSection('installments'); document.getElementById('customer-search').value = '${item.account_no}'; app.installments.searchCustomer('${item.account_no}');">
                                        View
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>`
                }
            `;
        } catch (error) {
            console.error('Error loading overdue warnings:', error);
            container.innerHTML = '<h4><i class="fas fa-exclamation-triangle"></i> Overdue Payments</h4><p class="text-muted">Unable to load overdue data</p>';
        }
    }

    createRecentActivitySection() {
        const chartsSection = document.querySelector('.dashboard-charts');
        if (!chartsSection) return;

        const activityHTML = `
            <div class="dashboard-sidebar">
                <div class="sidebar-section" id="recent-activity">
                    <h4><i class="fas fa-clock"></i> Recent Payments</h4>
                    <p class="text-muted">Loading...</p>
                </div>
                <div class="sidebar-section" id="overdue-warnings">
                    <h4><i class="fas fa-exclamation-triangle"></i> Overdue Payments</h4>
                    <p class="text-muted">Loading...</p>
                </div>
            </div>
        `;

        chartsSection.insertAdjacentHTML('afterend', activityHTML);
    }

    createOverdueWarningsSection() {
        // This is handled in createRecentActivitySection
    }

    // Export dashboard data
    async exportDashboardData() {
        try {
            const data = {
                stats: this.stats,
                exportDate: new Date().toISOString(),
                monthlyData: await Database.getMonthlyCollectionData(12),
                overdueItems: await Database.getOverdueInstallments()
            };

            Utils.downloadJSON(data, `dashboard_export_${Utils.getCurrentDate('YYYY-MM-DD')}.json`);
            app.showNotification('Dashboard data exported successfully!', 'success');
        } catch (error) {
            console.error('Error exporting dashboard data:', error);
            app.showNotification('Failed to export dashboard data', 'error');
        }
    }

    cleanup() {
        if (this.chart) {
            this.chart.destroy();
        }
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

window.DashboardManager = DashboardManager;
