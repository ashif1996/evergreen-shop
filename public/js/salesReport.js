const fetchReport = () => {
    const type = $('#type').val();
    const fromDate = $('#fromDate').val();
    const toDate = $('#toDate').val();
    const csrfToken = $('input[name="_csrf"]').val();

    $.ajax({
        url: '/sales/report/generate',
        method: 'GET',
        data: { type, fromDate, toDate },
        headers: { 'CSRF-Token': csrfToken },
        success: (response) => {
            $('#reportResults').show();
            $('#totalOrders').text(response.reportDetails.totalOrders);
            $('#totalAmount').text(`₹${response.reportDetails.totalAmount}`);
            $('#totalDiscount').text(`₹${response.reportDetails.totalDiscount}`);
    
            const table = $('#advancedTable').DataTable();
            table.clear();
            response.orders.forEach(order => {
                table.row.add([
                    order._id,
                    `${order.userId.firstName} ${order.userId.lastName}`, // Adjusted for userId
                    new Date(order.orderDate).toLocaleString(), // Adjusted for orderDate
                    order.orderItems.map(item => `${item.productId.name} - ${item.quantity} x - ₹${item.price}`).join('<br>'), // Adjusted for productId and item details
                    `${order.shippingAddress.address}, ${order.shippingAddress.city}, ${order.shippingAddress.state}`, // Adjusted for shippingAddress
                    `₹${order.totalPrice}`, // Adjusted for totalPrice
                    order.couponId ? order.couponId.code : '', // Adjusted for couponId
                    `₹${order.couponDiscount}`, // Adjusted for couponDiscount
                    `${order.paymentMethod}`
                ]).draw();
            });
        },
        error: (error) => {
            console.error(error);
            alert('Failed to fetch the report');
        }
    });
};

const downloadReport = (format) => {
    const type = $('#type').val();
    const fromDate = $('#fromDate').val();
    const toDate = $('#toDate').val();
    const csrfToken = $('meta[name="csrf-token"]').attr('content');

    // If format is 'pdf', generate the PDF using jsPDF
    if (format === 'pdf') {
        $.ajax({
            url: '/sales/report/generate',
            method: 'GET',
            data: { type, fromDate, toDate },
            headers: { 'CSRF-Token': csrfToken },
            success: (response) => {
                const { orders } = response;
                
                // Create a new jsPDF instance
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();

                // Add title to the PDF
                doc.text('Sales Report', 14, 15);
                doc.text(`From: ${fromDate} To: ${toDate}`, 14, 22);

                // Prepare the table data for autoTable
                const tableData = orders.map(order => ([
                    order._id,
                    `${order.userId.firstName} ${order.userId.lastName}`,
                    new Date(order.orderDate).toLocaleString(),
                    order.orderItems.map(item => `${item.productId.name} - ${item.quantity} x ₹${item.price}`).join('\n'),
                    `${order.shippingAddress.address}, ${order.shippingAddress.city}, ${order.shippingAddress.state}`,
                    `₹${order.totalPrice}`,
                    order.couponId ? order.couponId.code : 'N/A',
                    `₹${order.couponDiscount}`,
                    `${order.paymentMethod}`
                ]));

                // Define columns
                const columns = [
                    "Order ID", 
                    "Customer Name", 
                    "Order Date", 
                    "Items", 
                    "Shipping Address", 
                    "Total Price", 
                    "Coupon Code", 
                    "Coupon Discount", 
                    "Payment Method"
                ];

                // Add autoTable with data
                doc.autoTable({
                    head: [columns],
                    body: tableData,
                    startY: 30, // Starting position
                    theme: 'grid'
                });

                // Save the PDF
                doc.save(`sales_report_${fromDate}_to_${toDate}.pdf`);
            },
            error: (error) => {
                console.error(error);
                alert('Failed to generate the PDF report');
            }
        });
    } else {
        // For other formats, submit the form as usual
        const form = $('<form></form>').attr('action', '/sales/report/download').attr('method', 'post');
        form.append($('<input>').attr('type', 'hidden').attr('name', 'type').attr('value', type));
        form.append($('<input>').attr('type', 'hidden').attr('name', 'fromDate').attr('value', fromDate));
        form.append($('<input>').attr('type', 'hidden').attr('name', 'toDate').attr('value', toDate));
        form.append($('<input>').attr('type', 'hidden').attr('name', 'format').attr('value', format));
        form.append($('<input>').attr('type', 'hidden').attr('name', '_csrf').attr('value', csrfToken));
        form.appendTo('body').submit().remove();
    }
};

document.addEventListener('DOMContentLoaded', function() {
    // Event listener for the button click
    document.getElementById('generateReportBtn').addEventListener('click', function() {
        const fromDate = new Date(document.getElementById('fromDate').value);
        const toDate = new Date(document.getElementById('toDate').value);
        const today = new Date();
        let valid = true;

        // Clear previous error messages
        document.getElementById('fromDateError').innerHTML = '';
        document.getElementById('toDateError').innerHTML = '';

        // Check if From Date is in the future
        if (fromDate > today) {
            document.getElementById('fromDateError').innerHTML = 'From Date cannot be in the future.';
            valid = false;
        }

        // Check if To Date is in the future
        if (toDate > today) {
            document.getElementById('toDateError').innerHTML = 'To Date cannot be in the future.';
            valid = false;
        }

        // Check if To Date is earlier than From Date
        if (fromDate > toDate) {
            document.getElementById('toDateError').innerHTML = 'To Date cannot be earlier than From Date.';
            valid = false;
        }

        // If validation passes, proceed with fetching the report
        if (valid) {
            fetchReport();
        }
    });
});