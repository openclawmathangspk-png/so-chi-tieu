const STORAGE_KEY = "so_chi_tieu_expenses";

const expenseForm = document.getElementById("expense-form");
const amountInput = document.getElementById("amount");
const categorySelect = document.getElementById("category");
const dateInput = document.getElementById("date");
const noteInput = document.getElementById("note");
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const formTitle = document.getElementById("form-title");

const expenseListEl = document.getElementById("expense-list");
const emptyStateEl = document.getElementById("empty-state");
const totalAmountEl = document.getElementById("total-amount");

const filterCategoryEl = document.getElementById("filter-category");
const filterMonthEl = document.getElementById("filter-month");
const clearFiltersBtn = document.getElementById("clear-filters");

const statsMonthInput = document.getElementById("stats-month");
const monthTotalEl = document.getElementById("month-total");
const categoryPieCanvas = document.getElementById("category-pie");
const chartEmptyEl = document.getElementById("chart-empty");
const exportExcelBtn = document.getElementById("export-excel");

const errorAmount = document.getElementById("error-amount");
const errorCategory = document.getElementById("error-category");
const errorDate = document.getElementById("error-date");

let expenses = [];
let editingId = null;
let categoryChart = null;

function getTodayISO() {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const local = new Date(now - tzOffset);
    return local.toISOString().slice(0, 10);
}

function formatCurrency(value) {
    const number = Number(value) || 0;
    return new Intl.NumberFormat("vi-VN").format(number) + " ₫";
}

function loadExpenses() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            expenses = [];
            return;
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            expenses = parsed;
        } else {
            expenses = [];
        }
    } catch (error) {
        console.error("Không thể tải dữ liệu từ localStorage", error);
        expenses = [];
    }
}

function saveExpenses() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    } catch (error) {
        console.error("Không thể lưu dữ liệu vào localStorage", error);
    }
}

function clearErrors() {
    errorAmount.textContent = "";
    errorCategory.textContent = "";
    errorDate.textContent = "";
}

function validateForm() {
    clearErrors();
    let isValid = true;

    const amountValue = Number(amountInput.value);
    if (amountInput.value === "" || Number.isNaN(amountValue) || amountValue <= 0) {
        errorAmount.textContent = "Vui lòng nhập số tiền hợp lệ (> 0)";
        isValid = false;
    }

    if (!categorySelect.value) {
        errorCategory.textContent = "Vui lòng chọn danh mục";
        isValid = false;
    }

    if (!dateInput.value) {
        errorDate.textContent = "Vui lòng chọn ngày";
        isValid = false;
    }

    return isValid;
}

function resetForm() {
    expenseForm.reset();
    dateInput.value = getTodayISO();
    editingId = null;
    formTitle.textContent = "Thêm khoản chi";
    submitBtn.textContent = "Thêm khoản chi";
    cancelEditBtn.hidden = true;
    clearErrors();
}

function enterEditMode(expense) {
    editingId = expense.id;
    amountInput.value = expense.amount;
    categorySelect.value = expense.category;
    dateInput.value = expense.date;
    noteInput.value = expense.note || "";
    formTitle.textContent = "Chỉnh sửa khoản chi";
    submitBtn.textContent = "Cập nhật";
    cancelEditBtn.hidden = false;
    clearErrors();
    window.scrollTo({ top: 0, behavior: "smooth" });
    amountInput.focus();
}

function getFilteredExpenses() {
    const categoryFilter = filterCategoryEl.value;
    const monthFilter = filterMonthEl.value;

    return expenses
        .filter((item) => {
            if (categoryFilter !== "all" && item.category !== categoryFilter) {
                return false;
            }
            if (monthFilter) {
                const itemMonth = item.date.slice(0, 7);
                if (itemMonth !== monthFilter) {
                    return false;
                }
            }
            return true;
        })
        .sort((a, b) => {
            if (a.date === b.date) {
                return (b.id || 0) - (a.id || 0);
            }
            return b.date.localeCompare(a.date);
        });
}

function renderStats() {
    if (!statsMonthInput) {
        return;
    }

    const selectedMonth = statsMonthInput.value;
    let monthItems = [];

    if (selectedMonth) {
        monthItems = expenses.filter((item) => item.date && item.date.slice(0, 7) === selectedMonth);
    } else {
        monthItems = [];
    }

    let monthTotal = 0;
    for (const item of monthItems) {
        monthTotal += Number(item.amount) || 0;
    }
    if (monthTotalEl) {
        monthTotalEl.textContent = formatCurrency(monthTotal);
    }

    if (!categoryPieCanvas) {
        return;
    }

    if (monthItems.length === 0) {
        if (categoryChart) {
            categoryChart.destroy();
            categoryChart = null;
        }
        categoryPieCanvas.style.display = "none";
        if (chartEmptyEl) {
            chartEmptyEl.hidden = false;
        }
        return;
    }

    categoryPieCanvas.style.display = "block";
    if (chartEmptyEl) {
        chartEmptyEl.hidden = true;
    }

    const categoryMap = new Map();
    for (const item of monthItems) {
        const key = item.category || "Khác";
        categoryMap.set(key, (categoryMap.get(key) || 0) + (Number(item.amount) || 0));
    }

    const labels = Array.from(categoryMap.keys());
    const data = labels.map((label) => categoryMap.get(label));

    const palette = [
        "#4f9bff",
        "#34d399",
        "#f59e0b",
        "#f87171",
        "#a78bfa",
        "#22d3ee",
        "#f472b6",
    ];

    const backgroundColor = labels.map((_, index) => palette[index % palette.length]);

    const chartData = {
        labels,
        datasets: [
            {
                data,
                backgroundColor,
                borderColor: "rgba(15, 23, 42, 0.8)",
                borderWidth: 2,
            },
        ],
    };

    if (categoryChart) {
        categoryChart.data = chartData;
        categoryChart.update();
        return;
    }

    categoryChart = new Chart(categoryPieCanvas, {
        type: "pie",
        data: chartData,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: "#e6e8ee",
                        boxWidth: 12,
                    },
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.label || "";
                            const value = context.raw || 0;
                            return `${label}: ${formatCurrency(value)}`;
                        },
                    },
                },
            },
        },
    });
}

function render() {
    const filtered = getFilteredExpenses();
    expenseListEl.innerHTML = "";

    if (filtered.length === 0) {
        emptyStateEl.hidden = false;
    } else {
        emptyStateEl.hidden = true;
    }

    let total = 0;
    for (const item of filtered) {
        total += Number(item.amount) || 0;

        const li = document.createElement("li");
        li.className = "expense-item";
        li.dataset.id = item.id;

        const main = document.createElement("div");
        main.className = "expense-main";

        const top = document.createElement("div");
        top.className = "expense-top";

        const category = document.createElement("span");
        category.className = "expense-category";
        category.textContent = item.category;

        const date = document.createElement("span");
        date.className = "expense-date";
        date.textContent = item.date.split("-").reverse().join("/");

        top.appendChild(category);
        top.appendChild(date);

        const note = document.createElement("p");
        note.className = "expense-note";
        note.textContent = item.note && item.note.trim() ? item.note : "Không có ghi chú";

        main.appendChild(top);
        main.appendChild(note);

        const actions = document.createElement("div");
        actions.className = "expense-actions";

        const amount = document.createElement("div");
        amount.className = "expense-amount";
        amount.textContent = formatCurrency(item.amount);

        const actionsRow = document.createElement("div");
        actionsRow.className = "expense-actions-row";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "btn-icon";
        editBtn.textContent = "Sửa";
        editBtn.addEventListener("click", () => {
            enterEditMode(item);
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn-icon btn-icon-danger";
        deleteBtn.textContent = "Xóa";
        deleteBtn.addEventListener("click", () => {
            handleDelete(item.id);
        });

        actionsRow.appendChild(editBtn);
        actionsRow.appendChild(deleteBtn);

        actions.appendChild(amount);
        actions.appendChild(actionsRow);

        li.appendChild(main);
        li.appendChild(actions);
        expenseListEl.appendChild(li);
    }

    totalAmountEl.textContent = formatCurrency(total);
    renderStats();
}

function handleDelete(id) {
    const confirmed = confirm("Bạn có chắc chắn muốn xóa khoản chi này không?");
    if (!confirmed) {
        return;
    }
    expenses = expenses.filter((item) => item.id !== id);
    saveExpenses();
    if (editingId === id) {
        resetForm();
    }
    render();
}

expenseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!validateForm()) {
        return;
    }

    const amountValue = Number(amountInput.value);
    const categoryValue = categorySelect.value;
    const dateValue = dateInput.value;
    const noteValue = noteInput.value.trim();

    if (editingId !== null) {
        expenses = expenses.map((item) => {
            if (item.id === editingId) {
                return {
                    ...item,
                    amount: amountValue,
                    category: categoryValue,
                    date: dateValue,
                    note: noteValue,
                };
            }
            return item;
        });
    } else {
        const newExpense = {
            id: Date.now(),
            amount: amountValue,
            category: categoryValue,
            date: dateValue,
            note: noteValue,
        };
        expenses.push(newExpense);
    }

    saveExpenses();
    resetForm();
    render();
});

cancelEditBtn.addEventListener("click", () => {
    resetForm();
});

function exportMonthToCsv() {
    if (!statsMonthInput) {
        return;
    }

    const selectedMonth = statsMonthInput.value;
    if (!selectedMonth) {
        alert("Vui lòng chọn tháng để xuất Excel");
        return;
    }

    const monthItems = expenses
        .filter((item) => item.date && item.date.slice(0, 7) === selectedMonth)
        .sort((a, b) => {
            if (a.date === b.date) {
                return (a.id || 0) - (b.id || 0);
            }
            return a.date.localeCompare(b.date);
        });

    if (monthItems.length === 0) {
        alert("Không có dữ liệu cho tháng đã chọn");
        return;
    }

    const headers = ["Ngày", "Danh mục", "Số tiền (VNĐ)", "Ghi chú"];
    const rows = [headers];

    for (const item of monthItems) {
        const dateStr = item.date ? item.date.split("-").reverse().join("/") : "";
        const amountStr = String(Number(item.amount) || 0);
        const noteStr = (item.note || "").replace(/\r?\n/g, " ");
        rows.push([dateStr, item.category || "", amountStr, noteStr]);
    }

    const csvContent = rows
        .map((row) =>
            row
                .map((cell) => {
                    const value = String(cell).replace(/"/g, '""');
                    if (/[",;\n]/.test(value)) {
                        return '"' + value + '"';
                    }
                    return value;
                })
                .join(",")
        )
        .join("\r\n");

    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `So_chi_tieu_${selectedMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

filterCategoryEl.addEventListener("change", render);
filterMonthEl.addEventListener("change", render);
if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
        filterCategoryEl.value = "all";
        filterMonthEl.value = "";
        render();
    });
}

if (statsMonthInput) {
    statsMonthInput.addEventListener("change", renderStats);
}

if (exportExcelBtn) {
    exportExcelBtn.addEventListener("click", exportMonthToCsv);
}

function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("./sw.js").catch((error) => {
                console.error("Không thể đăng ký Service Worker", error);
            });
        });
    }
}

function init() {
    loadExpenses();
    dateInput.value = getTodayISO();
    if (statsMonthInput && !statsMonthInput.value) {
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        statsMonthInput.value = `${today.getFullYear()}-${month}`;
    }
    registerServiceWorker();
    render();
}

init();
