import pdf from 'html-pdf';
import fs from 'fs';

// Generate daily attendance PDF
export const generateDailyPDF = (req, res) => {
    const htmlContent = `
    <html>
    <head>
        <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>Daily Attendance Report</h1>
        <table>
            <thead>
                <tr>
                    <th>Employee Name</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th>Work Mode</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${req.body.data.map(item => `
                    <tr>
                        <td>${item.full_name}</td>
                        <td>${item.check_in}</td>
                        <td>${item.check_out}</td>
                        <td>${item.work_mode}</td>
                        <td>${item.status}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>
    `;

    const fileName = `attendance_${new Date().toISOString().split('T')[0]}.pdf`;

    pdf.create(htmlContent).toFile(fileName, (err, result) => {
        if (err) {
            console.error("Error generating PDF:", err);
            return res.status(500).send("Error generating PDF");
        }
        res.download(result.filename, fileName, () => {
            fs.unlinkSync(result.filename);
        });
    });
};

// Generate weekly attendance PDF
export const generateWeeklyPDF = (req, res) => {
    const htmlContent = `
    <html>
    <head>
        <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>Weekly Attendance Report</h1>
        <table>
            <thead>
                <tr>
                    <th>Employee Name</th>
                    <th>Attendance</th>
                    <th>Absentees</th>
                    <th>Working Hours</th>
                    <th>Working Hours %</th>
                </tr>
            </thead>
            <tbody>
                ${req.body.data.map(item => `
                    <tr>
                        <td>${item.user.full_name}</td>
                        <td>${item.presentDays}</td>
                        <td>${item.absentDays}</td>
                        <td>${item.totalHoursWorked.toFixed(2)}</td>
                        <td>${item.workingHoursPercentage.toFixed(2)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>
    `;

    const fileName = `attendance_${new Date().toISOString().split('T')[0]}.pdf`;

    pdf.create(htmlContent).toFile(fileName, (err, result) => {
        if (err) {
            console.error("Error generating PDF:", err);
            return res.status(500).send("Error generating PDF");
        }
        res.download(result.filename, fileName, () => {
            fs.unlinkSync(result.filename);
        });
    });
};

// Generate filtered attendance PDF
export const generateFilteredPDF = (req, res) => {
    const htmlContent = `
    <html>
    <head>
        <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>Attendance Report filtered</h1>
        <table>
            <thead>
                <tr>
                    <th>Employee Name</th>
                    <th>Attendance</th>
                    <th>Absentees</th>
                    <th>Working Hours</th>
                    <th>Working Hours %</th>
                </tr>
            </thead>
            <tbody>
                ${req.body.data.map(item => `
                    <tr>
                        <td>${item.user.full_name}</td>
                        <td>${item.presentDays}</td>
                        <td>${item.absentDays}</td>
                        <td>${item.totalHoursWorked.toFixed(2)}</td>
                        <td>${item.workingHoursPercentage.toFixed(2)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>
    `;

    const fileName = `attendance_${new Date().toISOString().split('T')[0]}.pdf`;

    pdf.create(htmlContent).toFile(fileName, (err, result) => {
        if (err) {
            console.error("Error generating PDF:", err);
            return res.status(500).send("Error generating PDF");
        }
        res.download(result.filename, fileName, () => {
            fs.unlinkSync(result.filename);
        });
    });
};

// Generate monthly attendance PDF
export const generateMonthlyPDF = (req, res) => {
    const htmlContent = `
    <html>
    <head>
        <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>Monthly Attendance Report</h1>
        <table>
            <thead>
                <tr>
                    <th>Employee Name</th>
                    <th>Attendance</th>
                    <th>Absentees</th>
                    <th>Working Hours</th>
                    <th>Working Hours %</th>
                </tr>
            </thead>
            <tbody>
                ${req.body.data.map(item => `
                    <tr>
                        <td>${item.user.full_name}</td>
                        <td>${item.presentDays}</td>
                        <td>${item.absentDays}</td>
                        <td>${item.totalHoursWorked.toFixed(2)}</td>
                        <td>${item.workingHoursPercentage.toFixed(2)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>
    `;

    const fileName = `attendance_${new Date().toISOString().split('T')[0]}.pdf`;

    pdf.create(htmlContent).toFile(fileName, (err, result) => {
        if (err) {
            console.error("Error generating PDF:", err);
            return res.status(500).send("Error generating PDF");
        }
        res.download(result.filename, fileName, () => {
            fs.unlinkSync(result.filename);
        });
    });
};

// Generate filtered employee attendance PDF
export const generateFilteredEmployeePDF = (req, res) => {
    const htmlContent = `
    <html>
    <head>
        <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>Filtered Attendance Report of ${req.body.data[0].fullname}</h1>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Work Mode</th>
                </tr>
            </thead>
            <tbody>
                ${req.body.data.map(item => `
                    <tr>
                        <td>${item.date}</td>
                        <td>${item.status}</td>
                        <td>${item.Check_in}</td>
                        <td>${item.Check_out}</td>
                        <td>${item.workmode}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>
    `;

    const fileName = `attendance_${new Date().toISOString().split('T')[0]}.pdf`;

    pdf.create(htmlContent).toFile(fileName, (err, result) => {
        if (err) {
            console.error("Error generating PDF:", err);
            return res.status(500).send("Error generating PDF");
        }
        res.download(result.filename, fileName, () => {
            fs.unlinkSync(result.filename);
        });
    });
};

// Generate weekly employee attendance PDF
export const generateWeeklyEmployeePDF = (req, res) => {
    const htmlContent = `
    <html>
    <head>
        <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>Weekly Attendance Report of ${req.body.data[0].fullname}</h1>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Work Mode</th>
                </tr>
            </thead>
            <tbody>
                ${req.body.data.map(item => `
                    <tr>
                        <td>${item.date}</td>
                        <td>${item.status}</td>
                        <td>${item.Check_in}</td>
                        <td>${item.Check_out}</td>
                        <td>${item.workmode}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>
    `;

    const fileName = `attendance_${new Date().toISOString().split('T')[0]}.pdf`;

    pdf.create(htmlContent).toFile(fileName, (err, result) => {
        if (err) {
            console.error("Error generating PDF:", err);
            return res.status(500).send("Error generating PDF");
        }
        res.download(result.filename, fileName, () => {
            fs.unlinkSync(result.filename);
        });
    });
};

// Generate monthly employee attendance PDF
export const generateMonthlyEmployeePDF = (req, res) => {
    const htmlContent = `
    <html>
    <head>
        <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>Monthly Attendance Report of ${req.body.data[0].fullname}</h1>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Work Mode</th>
                </tr>
            </thead>
            <tbody>
                ${req.body.data.map(item => `
                    <tr>
                        <td>${item.date}</td>
                        <td>${item.status}</td>
                        <td>${item.Check_in}</td>
                        <td>${item.Check_out}</td>
                        <td>${item.workmode}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>
    `;

    const fileName = `attendance_${new Date().toISOString().split('T')[0]}.pdf`;

    pdf.create(htmlContent).toFile(fileName, (err, result) => {
        if (err) {
            console.error("Error generating PDF:", err);
            return res.status(500).send("Error generating PDF");
        }
        res.download(result.filename, fileName, () => {
            fs.unlinkSync(result.filename);
        });
    });
};
